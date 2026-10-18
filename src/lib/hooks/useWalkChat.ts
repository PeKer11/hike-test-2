"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CHAT_COPY } from "@/lib/walk/chat/chat-copy";
import { parseIntent, type ParsedIntent } from "@/lib/walk/chat/intent";
import {
  CHAT_HELP_TEXT,
  resolveChat,
  type ChatAction,
  type ChatContext,
  type ChatLang,
} from "@/lib/walk/chat/reply";

export const MAX_CHAT_LLM_PER_WALK = 15;
export const CHAT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_MESSAGES = 6;
const MAX_TEXT = 200;

export interface ChatMessage {
  id: number;
  role: "user" | "app";
  text: string;
  actions: ChatAction[];
  /** True once the walker tapped one of the actions; the buttons are then gone. */
  used: boolean;
}

export interface WalkChatDeps {
  lang: ChatLang;
  isSignedIn: boolean;
  /** Stops ahead, nearby amenities and position, read at send time. Null when no walk is on. */
  getContext: () => ChatContext | null;
  /** Runs a tapped action (the planner owns what each one does). */
  onAction: (action: ChatAction) => void;
  doFetch?: typeof fetch;
}

export interface WalkChat {
  messages: ChatMessage[];
  pending: boolean;
  llmUsed: number;
  send: (text: string) => void;
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
  const [pending, setPending] = useState(false);
  const [llmUsed, setLlmUsed] = useState(0);
  const llmUsedRef = useRef(0);
  const nextId = useRef(1);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const push = useCallback((role: ChatMessage["role"], text: string, actions: ChatAction[] = []) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { id, role, text, actions, used: false }].slice(-MAX_MESSAGES));
    return id;
  }, []);

  const replace = useCallback((id: number, text: string, actions: ChatAction[] = []) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text, actions } : m)));
  }, []);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, MAX_TEXT);
      if (!text) return;
      const { lang, isSignedIn, getContext, doFetch } = depsRef.current;
      const copy = CHAT_COPY[lang];
      push("user", text);

      const ctx = getContext();
      if (!ctx) {
        push("app", copy.noWalk);
        return;
      }
      const parsed = parseIntent(text, ctx.stops);
      if (parsed.intent !== "unknown") {
        const reply = resolveChat(parsed, ctx, lang);
        push("app", reply.text, reply.actions);
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
          const reply = resolveChat(intent, fresh, lang);
          replace(thinkingId, reply.text, reply.actions);
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
    },
    [push, replace],
  );

  const runAction = useCallback((messageId: number, actionIndex: number) => {
    const message = messagesRef.current.find((m) => m.id === messageId);
    const action = message?.actions[actionIndex];
    if (!message || message.used || !action || usedIds.current.has(messageId)) return;
    usedIds.current.add(messageId);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, used: true } : m)));
    depsRef.current.onAction(action);
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    llmUsedRef.current = 0;
    setLlmUsed(0);
    setPending(false);
    usedIds.current.clear();
    setMessages([]);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { messages, pending, llmUsed, send, runAction, reset };
}
