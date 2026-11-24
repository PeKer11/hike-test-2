"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Coordinates } from "@/lib/types";
import { isAffirm } from "@/lib/walk/chat/affirm";
import { editCommand } from "@/lib/walk/chat/edit-command";
import { CHAT_COPY } from "@/lib/walk/chat/chat-copy";
import { parseIntent, type ParsedIntent } from "@/lib/walk/chat/intent";
import {
  CHAT_HELP_TEXT,
  plannerHandoff,
  resolveChat,
  type ChatAction,
  type ChatContext,
  type ChatLang,
} from "@/lib/walk/chat/reply";

export const MAX_CHAT_LLM_PER_WALK = 15;
export const CHAT_REQUEST_TIMEOUT_MS = 10_000;
const FREE_CHAT_TIMEOUT_MS = 30_000;
const MAX_MESSAGES = 6;
const MAX_TEXT = 200;
/** Most places or stops one typed command may add or remove without a tap. */
const MAX_AUTO_APPLY = 3;
// "take me to X" is a command, not a question: a single detour offer runs without another tap.
const GO_WORDS = /take (me|us)|bring (me|us)|go to|lead (me|us)|קח|תיקח|קחו|תקח|נלך|לך |סע |תוביל|הובל/i;

export interface ChatMessage {
  id: number;
  role: "user" | "app";
  text: string;
  actions: ChatAction[];
  /** True once the walker tapped one of the actions; the buttons are then gone. */
  used: boolean;
  /** A newer reply brought its own buttons: these ones are stale and are hidden. */
  superseded?: boolean;
}

const COMBINED_LABEL_MAX = 60;

/** The start of the app's own line for an action it just ran: "Adding" / "Removing". */
const runVerb = (a: ChatAction, lang: ChatLang) =>
  a.kind === "add-place" ? (lang === "he" ? "מוסיפים" : "Adding") : lang === "he" ? "מורידים" : "Removing";

/** The combined chip's text: the places by name, drops with a minus, a count when the names run long. */
function combinedLabel(lang: ChatLang, addNames: string[], dropNames: string[]): string {
  const items = [...(addNames.length > 0 ? [addNames.join(" + ")] : []), ...dropNames.map((n) => `−${n}`)];
  const head = addNames.length > 0 ? (lang === "he" ? "להוסיף" : "Add") : lang === "he" ? "להסיר" : "Remove";
  const named = `${head}: ${items.join(", ")}`;
  if (named.length <= COMBINED_LABEL_MAX) return named;
  const n = addNames.length + dropNames.length;
  if (dropNames.length === 0) return lang === "he" ? `להוסיף את ${n} המקומות` : n === 2 ? "Add both places" : `Add ${n} places`;
  return lang === "he" ? `לבצע ${n} שינויים` : `Apply ${n} changes`;
}

export interface WalkChatDeps {
  lang: ChatLang;
  isSignedIn: boolean;
  /** Stops ahead, nearby amenities and position, read at send time. Null when no walk is on. */
  getContext: () => ChatContext | null;
  /** Runs a tapped action (the planner owns what each one does). */
  onAction: (action: ChatAction) => void;
  /** Try the free-form model chat first (the server decides who may); falls back to keywords. */
  freeChat?: boolean;
  doFetch?: typeof fetch;
}

export interface WalkChat {
  messages: ChatMessage[];
  pending: boolean;
  llmUsed: number;
  send: (text: string) => void;
  /** Bumps each time something outside asks for the chat box to open. */
  openTick: number;
  /** Open the chat box and send `text` as the walker's first words. */
  openWith: (text: string) => void;
  runAction: (messageId: number, actionIndex: number) => void;
  /** Clear the conversation and the per-walk question count (call when a walk ends). */
  reset: () => void;
}

/**
 * The in-walk chat. Keyword commands are answered on the device; only an
 * unrecognised sentence from a signed-in walker goes to /api/walk-chat, and
 * that request carries the typed words and the remaining stop names only.
 * Every outcome ends in a visible reply.
 */
export function useWalkChat(deps: WalkChatDeps): WalkChat {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const usedIds = useRef(new Set<number>());
  // The "On it…" reply of the last typed yes: while it is the newest reply, another yes is a no-op.
  const affirmReplyId = useRef<number | null>(null);
  const [pending, setPending] = useState(false);
  const [llmUsed, setLlmUsed] = useState(0);
  const llmUsedRef = useRef(0);
  const nextId = useRef(1);
  const freeChatOff = useRef(false);
  const [openTick, setOpenTick] = useState(0);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const push = useCallback((role: ChatMessage["role"], text: string, actions: ChatAction[] = []) => {
    const id = nextId.current++;
    setMessages((prev) =>
      [...prev.map((m) => (actions.length > 0 && m.actions.length > 0 ? { ...m, superseded: true } : m)), { id, role, text, actions, used: false }].slice(-MAX_MESSAGES),
    );
    return id;
  }, []);

  const replace = useCallback((id: number, text: string, actions: ChatAction[] = []) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text, actions } : actions.length > 0 && m.actions.length > 0 ? { ...m, superseded: true } : m)),
    );
  }, []);

  const runAction = useCallback((messageId: number, actionIndex: number) => {
    const message = messagesRef.current.find((m) => m.id === messageId);
    const action = message?.actions[actionIndex];
    if (!message || message.used || !action || usedIds.current.has(messageId)) return;
    usedIds.current.add(messageId);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, used: true } : m)));
    depsRef.current.onAction(action);
  }, []);

  const autoRun = (id: number, text: string, actions: ChatAction[]) => {
    if (actions.length !== 1 || actions[0].kind !== "detour" || !GO_WORDS.test(text)) return;
    usedIds.current.add(id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, used: true } : m)));
    depsRef.current.onAction(actions[0]);
  };

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, MAX_TEXT);
      if (!text) return;
      const { lang, isSignedIn, getContext, doFetch, freeChat } = depsRef.current;
      const copy = CHAT_COPY[lang];
      push("user", text);

      const ctx = getContext();
      if (!ctx) {
        push("app", copy.noWalk);
        return;
      }
      // A typed "yes" confirms the proposal in the newest app reply, on the device, with no model call.
      // Only the newest reply counts (an older proposal is not what "ok" answers), and a reply still
      // being fetched is newest too, so nothing older runs while it is pending.
      if (isAffirm(text)) {
        const newest = [...messagesRef.current].reverse().find((m) => m.role === "app");
        if (newest && newest.id === affirmReplyId.current) {
          // A second yes while (or just after) the first one ran: nothing to do, and no model turn.
          affirmReplyId.current = push("app", lang === "he" ? "כבר על זה" : "Already on it");
          return;
        }
        if (newest && !newest.used && !usedIds.current.has(newest.id) && newest.actions.length > 0) {
          const applyAll = newest.actions.findIndex((a) => a.kind === "apply-changes");
          const index = applyAll >= 0 ? applyAll : newest.actions.length === 1 ? 0 : -1;
          if (index >= 0) {
            affirmReplyId.current = push("app", lang === "he" ? "מטפלים בזה…" : "On it…");
            runAction(newest.id, index);
          } else {
            push("app", lang === "he" ? "על איזה מהם? אפשר ללחוץ על הכפתור" : "Which one? Tap its button");
          }
          return;
        }
      }
      const legacy = () => {
      const parsed = parseIntent(text, ctx.stops);
      if (parsed.intent !== "unknown") {
        const reply = resolveChat(parsed, ctx, lang);
        const id = push("app", reply.text, reply.actions);
        autoRun(id, text, reply.actions);
        return;
      }
      if (!isSignedIn) {
        push("app", `${CHAT_HELP_TEXT[lang]} ${copy.signIn}`);
        return;
      }
      if (llmUsedRef.current >= MAX_CHAT_LLM_PER_WALK) {
        push("app", copy.capReached);
        return;
      }

      llmUsedRef.current += 1;
      setLlmUsed(llmUsedRef.current);
      const myRequest = ++requestId.current;
      const thinkingId = push("app", copy.thinking);
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
      const stale = () => myRequest !== requestId.current;
      const fail = (message: string) => {
        if (!stale()) replace(thinkingId, message);
      };

      void (async () => {
        try {
          const res = await (doFetch ?? fetch)("/api/walk-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, stops: ctx.stops.map((s) => s.name.slice(0, 80)).slice(0, 12), lang }),
            signal: controller.signal,
          });
          const data = (await res.json().catch(() => ({}))) as {
            intent?: ParsedIntent["intent"];
            amenity?: ParsedIntent["amenity"] | null;
            stopIndex?: number | null;
            code?: string;
          };
          if (stale()) return;
          if (res.status === 401) return fail(copy.signIn);
          if (res.status === 429) return fail(data.code === "budget" ? copy.budget : copy.tooFast);
          if (!res.ok || typeof data.intent !== "string") return fail(copy.network);

          const stopId =
            typeof data.stopIndex === "number" ? ctx.stops[data.stopIndex]?.id : undefined;
          const intent: ParsedIntent = {
            intent: data.intent,
            ...(data.amenity ? { amenity: data.amenity } : {}),
            ...(stopId ? { stopId } : {}),
          };
          const fresh = getContext() ?? ctx;
          // Signed in and still not understood: the planner chat (Sol) can take it, so offer that instead of a hint.
          const reply = intent.intent === "unknown" ? plannerHandoff(text, lang) : resolveChat(intent, fresh, lang);
          replace(thinkingId, reply.text, reply.actions);
          autoRun(thinkingId, text, reply.actions);
        } catch {
          fail(controller.signal.aborted ? copy.timeout : copy.network);
        } finally {
          clearTimeout(timer);
          if (!stale()) {
            abortRef.current = null;
            setPending(false);
          }
        }
      })();
      };

      if (!isSignedIn || !freeChat || freeChatOff.current) return legacy();
      // Free-form model chat first (owner only for now); anything else falls back to the keyword chat.
      const myRequest = ++requestId.current;
      const thinkingId = push("app", copy.thinking);
      setPending(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), FREE_CHAT_TIMEOUT_MS);
      const stale = () => myRequest !== requestId.current;
      const command = editCommand(text);
      const history = messagesRef.current
        .filter((m) => m.id !== thinkingId && m.text !== copy.thinking)
        .slice(-6)
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      if (history[history.length - 1]?.content !== text) history.push({ role: "user", content: text });
      void (async () => {
        let fellBack = false;
        try {
          const res = await (doFetch ?? fetch)("/api/walk-assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history, position: ctx.position, stops: ctx.stops.map((s) => s.name), timing: ctx.timing, ...(command ? { autoApply: command } : {}) }),
            signal: controller.signal,
          });
          if (stale()) return;
          if (res.status === 403) {
            freeChatOff.current = true;
            fellBack = true;
            return;
          }
          const data = (await res.json().catch(() => ({}))) as {
            reply?: string;
            actions?: Array<{ kind: string; name?: string; coordinates?: Coordinates; stopIndex?: number }>;
            code?: string;
          };
          if (res.status === 429) {
            replace(thinkingId, data.code === "budget" ? copy.budget : copy.tooFast);
            return;
          }
          if (!res.ok || typeof data.reply !== "string") {
            fellBack = true;
            return;
          }
          const fresh = getContext() ?? ctx;
          const actions: ChatAction[] = [];
          for (const a of data.actions ?? []) {
            if (a.kind === "add-place" && a.name && a.coordinates) {
              actions.push({ kind: "add-place", name: a.name, coordinates: a.coordinates, label: lang === "he" ? `להוסיף את ${a.name}` : `Add ${a.name}` });
            } else if (a.kind === "skip-stop" && typeof a.stopIndex === "number" && ctx.stops[a.stopIndex]) {
              // The index points into the stops sent with the message; a stop reached meanwhile must not shift it.
              const sent = ctx.stops[a.stopIndex];
              const st = fresh.stops.find((x) => x.id === sent.id);
              if (st) actions.push({ kind: "drop", stopId: st.id, label: lang === "he" ? `לדלג על ${st.name}` : `Skip ${st.name}` });
            } else if (a.kind === "head-back") {
              actions.push({ kind: "head-back", label: lang === "he" ? "חזרה להתחלה" : "Head back" });
            }
          }
          // A typed command ("תוסיף שני מקומות") is carried out at once; anything else the reply proposes stays a button.
          const kind = command === "add" ? "add-place" : command === "drop" ? "drop" : null;
          const toRun = kind ? actions.filter((a) => a.kind === kind).slice(0, MAX_AUTO_APPLY) : [];
          const shown = actions.filter((a) => !toRun.includes(a));
          // Several proposals in one reply: one extra button that applies them all in a single rebuild.
          const adds = shown.flatMap((a) => (a.kind === "add-place" ? [{ name: a.name, coordinates: a.coordinates }] : []));
          const dropStopIds = shown.flatMap((a) => (a.kind === "drop" ? [a.stopId] : []));
          const dropNames = (ids: string[]) => ids.map((id) => fresh.stops.find((x) => x.id === id)?.name ?? "");
          if (adds.length + dropStopIds.length > 1) {
            shown.unshift({
              kind: "apply-changes",
              adds,
              dropStopIds,
              label: combinedLabel(lang, adds.map((a) => a.name), dropNames(dropStopIds)),
            });
          }
          const why = data.reply || (toRun.length > 0 ? "" : lang === "he" ? "לא הצלחתי לענות, נסו שוב." : "I couldn't answer, try again.");
          let line = "";
          if (toRun.length > 0) {
            const names = toRun.map((a) => (a.kind === "add-place" ? a.name : a.kind === "drop" ? dropNames([a.stopId])[0] : ""));
            const head = runVerb(toRun[0], lang);
            line = `${head}: ${names.join(", ")}.`;
          }
          replace(thinkingId, [line, why].filter(Boolean).join(" "), shown);
          if (toRun.length === 1) depsRef.current.onAction(toRun[0]);
          else if (toRun.length > 1) {
            const runAdds = toRun.flatMap((a) => (a.kind === "add-place" ? [{ name: a.name, coordinates: a.coordinates }] : []));
            const runDrops = toRun.flatMap((a) => (a.kind === "drop" ? [a.stopId] : []));
            depsRef.current.onAction({
              kind: "apply-changes",
              adds: runAdds,
              dropStopIds: runDrops,
              label: combinedLabel(lang, runAdds.map((a) => a.name), dropNames(runDrops)),
            });
          }
        } catch {
          if (controller.signal.aborted) replace(thinkingId, copy.timeout);
          else fellBack = true;
        } finally {
          clearTimeout(timer);
          if (!stale()) {
            abortRef.current = null;
            setPending(false);
          }
          if (fellBack && !stale()) {
            setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
            legacy();
          }
        }
      })();
    },
    [push, replace, runAction],
  );

  const openWith = useCallback(
    (text: string) => {
      setOpenTick((n) => n + 1);
      send(text);
    },
    [send],
  );

  const reset = useCallback(() => {
    requestId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    llmUsedRef.current = 0;
    setLlmUsed(0);
    setPending(false);
    usedIds.current.clear();
    affirmReplyId.current = null;
    setMessages([]);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { messages, pending, llmUsed, send, openTick, openWith, runAction, reset };
}
