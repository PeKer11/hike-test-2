import { NextResponse } from "next/server";

import { callerKey, chatRateLimiter, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  KEEP_RECENT,
  SUMMARIZE_AFTER,
  summarizeConversation,
} from "@/lib/assistant/summary";
import { EMPTY_STATE, type AssistantState } from "@/lib/assistant/state";
import { runAssistantTurn, type TurnMessage } from "@/lib/assistant/turn";
import { runMeteredTurn } from "@/lib/llm/llm-client";
import { LlmBudgetExceededError } from "@/lib/llm/types";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGE_CHARS = 1000;
const MAX_STORED_MESSAGES = 400;

interface AssistantRequest {
  chatId?: unknown;
  message?: unknown;
  /** Where the walker is now (GPS or map pin); only used while no start is set. */
  origin?: unknown;
}

function parseOrigin(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function asState(raw: unknown): AssistantState {
  const s = (raw ?? {}) as Partial<AssistantState>;
  return {
    origin: s.origin ?? null,
    params: s.params ?? {},
    candidates: Array.isArray(s.candidates) ? s.candidates : [],
    chosen: Array.isArray(s.chosen) ? s.chosen : [],
  };
}

/**
 * One walker message in a persisted chat. The model only sees the stored
 * summary plus the recent messages; the chat, its messages and the working
 * state (places found, limits) are stored under the walker's own RLS session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = chatRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  let body: AssistantRequest;
  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 1 || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "message must be 1-1000 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to chat with the assistant.", code: "signin" }, { status: 401 });
  }

  // Load or create the chat.
  let chatId = typeof body.chatId === "string" ? body.chatId : null;
  let summary: string | null = null;
  let summarizedCount = 0;
  let state: AssistantState = { ...EMPTY_STATE };
  let history: TurnMessage[] = [];
  let totalMessages = 0;

  if (chatId) {
    const { data: chat } = await supabase
      .from("assistant_chats")
      .select("summary, summarized_count, state")
      .eq("id", chatId)
      .maybeSingle();
    if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    summary = chat.summary;
    summarizedCount = chat.summarized_count;
    state = asState(chat.state);
    const { data: rows } = await supabase
      .from("assistant_messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(MAX_STORED_MESSAGES);
    const all = (rows ?? []) as TurnMessage[];
    totalMessages = all.length;
    history = all.slice(summarizedCount);
  } else {
    const { data: created, error } = await supabase
      .from("assistant_chats")
      .insert({ user_id: user.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "Could not start the chat." }, { status: 500 });
    }
    chatId = created.id as string;
  }

  const origin = parseOrigin(body.origin);
  if (origin && !state.origin) state = { ...state, origin };
  history = [...history, { role: "user", content: message }];

  try {
    const result = await runMeteredTurn(
      { userId: user.id, ip: callerKey(request) },
      3,
      async (choice, effort) => {
        const turn = await runAssistantTurn({ summary, history, state, choice, effort });
        let billed = turn.billedMicros;
        let newSummary = summary;
        let newSummarized = summarizedCount;
        const unsummarized = history.length + 1;
        if (unsummarized >= SUMMARIZE_AFTER) {
          const fold = [...history, { role: "assistant" as const, content: turn.reply }];
          const old = fold.slice(0, fold.length - KEEP_RECENT);
          try {
            const s = await summarizeConversation(summary, old, choice, effort);
            billed += s.billedMicros;
            if (s.summary) {
              newSummary = s.summary;
              newSummarized = summarizedCount + old.length;
            }
          } catch {
            // Keep the old summary; try again next turn.
          }
        }
        return { value: { turn, newSummary, newSummarized }, billedMicros: billed };
      },
    );

    const reply = result.turn.reply || "…";
    await supabase.from("assistant_messages").insert([
      { chat_id: chatId, user_id: user.id, role: "user", content: message },
      { chat_id: chatId, user_id: user.id, role: "assistant", content: reply },
    ]);
    await supabase
      .from("assistant_chats")
      .update({
        state: result.turn.state,
        summary: result.newSummary,
        summarized_count: result.newSummarized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId);
    void totalMessages;

    return NextResponse.json({
      chatId,
      reply,
      state: result.turn.state,
      action: result.turn.action ?? null,
    });
  } catch (error) {
    if (error instanceof LlmBudgetExceededError) {
      return NextResponse.json(
        { code: "budget", error: "The assistant is resting for today. Try again tomorrow." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "The assistant could not answer. Try again." }, { status: 502 });
  }
}
