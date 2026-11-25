"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Coordinates } from "@/lib/types";
import { isAffirm, isDecline } from "@/lib/walk/chat/affirm";
import type { ProposalPreview } from "@/lib/walk/chat/proposal";
import { CHAT_COPY, noMatchText } from "@/lib/walk/chat/chat-copy";
import { parseIntent, radiusFromText, type ParsedIntent } from "@/lib/walk/chat/intent";
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
const MAX_MESSAGES = 20;
const MAX_TEXT = 200;
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
  /** The walker said no to the proposal: it is closed and nothing ran. */
  declined?: boolean;
  /** The numbers under a proposal card; set by the planner's dry-run, absent for plain replies. */
  preview?: ProposalPreview;
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
  /** Close a proposal with no change (the card's No, or a typed no). */
  decline: (messageId: number) => void;
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
      [...prev.map((m) => (actions.length > 0 && m.actions.length > 0 && !m.used ? { ...m, superseded: true } : m)), { id, role, text, actions, used: false }].slice(-MAX_MESSAGES),
    );
    return id;
  }, []);

  const replace = useCallback((id: number, text: string, actions: ChatAction[] = []) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text, actions } : actions.length > 0 && m.actions.length > 0 && !m.used ? { ...m, superseded: true } : m)),
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

  const decline = useCallback((messageId: number) => {
    const message = messagesRef.current.find((m) => m.id === messageId);
    if (!message || message.used || usedIds.current.has(messageId)) return;
    usedIds.current.add(messageId);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, used: true, declined: true } : m)));
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
      if (isDecline(text)) {
        const newest = [...messagesRef.current].reverse().find((m) => m.role === "app");
        if (newest && !newest.used && !newest.superseded && !usedIds.current.has(newest.id) && newest.actions.length > 0) {
          decline(newest.id);
          return;
        }
      }
      if (isAffirm(text)) {
        const newest = [...messagesRef.current].reverse().find((m) => m.role === "app");
        if (newest && newest.id === affirmReplyId.current) {
          // A second yes while (or just after) the first one ran: nothing to do, and no model turn.
          affirmReplyId.current = push("app", lang === "he" ? "כבר על זה" : "Already on it");
          return;
        }
        if (newest && !newest.used && !newest.superseded && !usedIds.current.has(newest.id) && newest.actions.length > 0) {
          const index = newest.actions.length === 1 ? 0 : -1;
          if (index >= 0) {
            affirmReplyId.current = push("app", lang === "he" ? "מטפלים בזה…" : "On it…");
            runAction(newest.id, index);
            return;
          }
        }
      }
      const legacy = (modelDown = false) => {
      const parsed = parseIntent(text, ctx.stops);
      if (parsed.intent !== "unknown") {
        const reply = resolveChat(parsed, ctx, lang);
        const radius = radiusFromText(text);
        const actions = radius ? reply.actions.map((a) => (a.kind === "add-stop" ? { ...a, radiusM: radius } : a)) : reply.actions;
        const id = push("app", reply.text, actions);
        autoRun(id, text, actions);
        return;
      }
      if (!isSignedIn) {
        push("app", `${CHAT_HELP_TEXT[lang]} ${copy.signIn}`);
        return;
      }
      // The free chat just found the model unavailable: a second model call would fail the same way.
      if (modelDown) {
        push("app", copy.aiDown);
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
          if (data.code === "llm_unavailable") return fail(copy.aiDown);
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
      const radiusM = radiusFromText(text);
      // The card the walker has not answered yet: the model's next proposal replaces it, so it must know what is in it.
      const openCard = [...messagesRef.current].reverse().find((m) => m.role === "app" && !m.used && !m.superseded && m.actions.some((a) => a.kind === "proposal"));
      const openAction = openCard?.actions.find((a) => a.kind === "proposal");
      const pendingCard = openAction?.kind === "proposal" ? { adds: openAction.adds.map((a) => a.name), drops: openAction.dropNames, headBack: openAction.headBack } : null;
      const history = messagesRef.current
        .filter((m) => m.id !== thinkingId && m.text !== copy.thinking && m.text !== "")
        .slice(-6)
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      if (history[history.length - 1]?.content !== text) history.push({ role: "user", content: text });
      void (async () => {
        let fellBack = false;
        let modelDown = false;
        try {
          const res = await (doFetch ?? fetch)("/api/walk-assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history, position: ctx.position, stops: ctx.stops.map((s) => s.name), timing: ctx.timing, ...(pendingCard ? { pending: pendingCard } : {}), ...(radiusM ? { radiusM } : {}) }),
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
            proposal?: { adds?: Array<{ name: string; coordinates: Coordinates; distM?: number }>; skipStopIndexes?: number[]; headBack?: boolean };
            noMatch?: "none_near" | "outside_radius" | "search_limit";
            code?: string;
          };
          if (res.status === 429) {
            replace(thinkingId, data.code === "budget" ? copy.budget : copy.tooFast);
            return;
          }
          if (!res.ok || typeof data.reply !== "string") {
            fellBack = true;
            modelDown = data.code === "llm_unavailable";
            return;
          }
          if (data.noMatch) {
            replace(thinkingId, noMatchText(lang, data.noMatch, radiusM ?? undefined));
            return;
          }
          const fresh = getContext() ?? ctx;
          const p = data.proposal;
          if (p) {
            const adds = (p.adds ?? []).filter((a) => a.name && a.coordinates);
            // The index points into the stops sent with the message; a stop reached meanwhile must not shift it.
            const drops = (p.skipStopIndexes ?? []).flatMap((i) => {
              const sent = ctx.stops[i];
              const st = sent && fresh.stops.find((x) => x.id === sent.id);
              return st ? [st] : [];
            });
            if (p.headBack || adds.length + drops.length > 0) {
              replace(thinkingId, "", [
                { kind: "proposal", adds, dropStopIds: drops.map((d) => d.id), dropNames: drops.map((d) => d.name), headBack: p.headBack === true, label: "" },
              ]);
              return;
            }
          }
          replace(thinkingId, data.reply || (lang === "he" ? "לא הצלחתי לענות, נסו שוב." : "I couldn't answer, try again."));
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
            legacy(modelDown);
          }
        }
      })();
    },
    [push, replace, runAction, decline],
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

  return { messages, pending, llmUsed, send, openTick, openWith, runAction, decline, reset };
}
