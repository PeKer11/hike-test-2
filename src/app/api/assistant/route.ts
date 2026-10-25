import { NextResponse } from "next/server";

import { assistantRateLimiter, callerKey, rateLimitedResponse } from "@/lib/api/rate-limit";
import {
  KEEP_RECENT,
  SUMMARIZE_AFTER,
  summarizeConversation,
} from "@/lib/assistant/summary";
import { defaultParams, parseDefaults, tasteNote } from "@/lib/assistant/defaults";
import { EMPTY_STATE, type AssistantState } from "@/lib/assistant/state";
import { getPreferredCategoryWeights, getProfileDefaults } from "@/lib/preferences/preference-store";
import { runAssistantTurn, type TurnMessage } from "@/lib/assistant/turn";
import { selectFactsForPrompt } from "@/lib/preferences/fact-extractor";
import { getStandingFacts, learnFactsFromText } from "@/lib/preferences/fact-store";
import { runMeteredTurn } from "@/lib/llm/llm-client";
import { LlmBudgetExceededError } from "@/lib/llm/types";
import { placesNote } from "@/lib/assistant/places-note";
import { listPlaces } from "@/lib/places/saved-places";
import { createClient } from "@/lib/supabase/server";
import { listMyWalks } from "@/lib/walks/saved-walks";

const MAX_MESSAGE_CHARS = 1000;
/** Chats kept per walker; the oldest is deleted when a new one starts. */
const MAX_CHATS = 5;
const MAX_STORED_MESSAGES = 400;

interface AssistantRequest {
  chatId?: unknown;
  message?: unknown;
  /** Where the walker is now (GPS or map pin); only used while no start is set. */
  origin?: unknown;
  limits?: unknown;
  /** Names of saved places the walker queued for this walk. */
  queued?: unknown;
  /** True while a walk is in progress: origin is the walker's live position and replaces the chat's start. */
  walking?: unknown;
  defaults?: unknown;
  /** Screenshots/photos the walker attached, as data URLs. Seen by the model only, never stored. */
  images?: unknown;
}

const MAX_IMAGES = 5;

/** The walker queued these saved places for this walk: they are stops they chose, not suggestions. */
function queuedNote(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const names = value
    .map((v) => {
      if (typeof v === "string") return v;
      if (typeof v !== "object" || v === null) return "";
      const { name, coordinates: c } = v as { name?: unknown; coordinates?: { lat?: unknown; lng?: unknown } };
      if (typeof name !== "string") return "";
      const at = typeof c?.lat === "number" && typeof c?.lng === "number" ? ` (exact spot ${c.lat.toFixed(5)},${c.lng.toFixed(5)})` : "";
      return name + at;
    })
    .map((v) => v.replace(/[\r\n;]+/g, " ").trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 8);
  return names.length
    ? `\nThe walker already queued these saved places as stops for this walk: ${names.join("; ")}. Look each up with search_place and include it in the proposed stops without asking again. When a search returns several similar places (a theatre, a square, an archive), pick the one closest to the exact spot given, not the best-known one.`
    : "";
}
const MAX_IMAGE_CHARS = 1_500_000;
const IMAGE_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function parseImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.length <= MAX_IMAGE_CHARS && IMAGE_URL.test(v))
    .slice(0, MAX_IMAGES);
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
    limitsSettled: s.limitsSettled === true,
  };
}

/**
 * One walker message in a persisted chat. The model only sees the stored
 * summary plus the recent messages; the chat, its messages and the working
 * state (places found, limits) are stored under the walker's own RLS session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = assistantRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  let body: AssistantRequest;
  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const images = parseImages(body.images);
  const typed = typeof body.message === "string" ? body.message.trim() : "";
  const message = typed || (images.length ? "(attached image)" : "");
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
    // Only the newest MAX_CHATS chats are kept; older ones (and their messages,
    // by cascade) are deleted. TODO: a paid tier with a higher limit.
    const { data: stale } = await supabase
      .from("assistant_chats")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(MAX_CHATS, MAX_CHATS + 50);
    if (stale && stale.length > 0) {
      await supabase.from("assistant_chats").delete().in("id", stale.map((c) => c.id as string));
    }
  }

  // The gear-menu defaults seed a NEW chat's limits; the learned pace backs them up.
  const defaults = parseDefaults(body.defaults);
  if (!body.chatId) {
    state = { ...state, params: { ...defaultParams(defaults), ...state.params } };
  }
  const [learned, profile] = await Promise.all([
    getPreferredCategoryWeights(supabase, user.id).catch(() => new Map()),
    getProfileDefaults(supabase, user.id).catch(() => null),
  ]);
  if (!state.params.paceMinPerKm && profile?.walkingPaceMinPerKm) {
    state = { ...state, params: { ...state.params, paceMinPerKm: profile.walkingPaceMinPerKm } };
  }
  const taste = tasteNote(defaults, learned);
  const facts = selectFactsForPrompt(await getStandingFacts(supabase, user.id), new Date());
  const savedPlaces = await listPlaces(supabase, user.id).catch(() => []);
  const memoryNote =
    (facts.length
      ? `\nWhat you already remember about this walker (use it, do not ask again): ${facts.map((f) => f.text).join("; ")}.`
      : "") +
    placesNote(savedPlaces) +
    queuedNote(body.queued) +
    (body.walking === true ? "\nThe walker is in the middle of a walk, at the start point given. Plan from here, and never propose places they already passed." : "");
  const origin = parseOrigin(body.origin);
  // Mid-walk the walker has moved: plan from here, not from where the chat first started.
  if (origin && (!state.origin || body.walking === true)) state = { ...state, origin };
  // Answers from the tap-to-choose limits boxes: null / missing = no limit.
  if (typeof body.limits === "object" && body.limits !== null) {
    const l = body.limits as Record<string, unknown>;
    const pick = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 10000 ? v : undefined);
    state = {
      ...state,
      limitsSettled: true,
      params: {
        ...state.params,
        timeMinutes: pick(l.timeMinutes),
        radiusKm: pick(l.radiusKm),
        // 0 = "back to start", a real answer, so it must survive the pick.
        endDistanceKm: l.endDistanceKm === 0 ? 0 : pick(l.endDistanceKm),
        maxWalkKm: pick(l.maxWalkKm),
        ...(pick(l.paceMinPerKm) ? { paceMinPerKm: pick(l.paceMinPerKm) } : {}),
      },
    };
  }
  history = [...history, { role: "user", content: message, ...(images.length ? { images } : {}) }];

  try {
    const result = await runMeteredTurn(
      { userId: user.id, ip: callerKey(request) },
      3,
      async (choice, effort) => {
        const turn = await runAssistantTurn({ summary, history, state, choice, effort, tasteNote: taste, memoryNote, loadWalks: () => listMyWalks(supabase, user.id, 50) });
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

    // Lasting facts Sol chose to keep go through the same store as the
    // prompt-learned ones (dedupe, contradiction, cap, "forget everything").
    for (const fact of (result.turn.remembered ?? []).slice(0, 3)) {
      await learnFactsFromText(supabase, user.id, fact, { userId: user.id, ip: callerKey(request) }).catch(() => null);
    }

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
      askLimits: result.turn.askLimits ?? false,
      choices: result.turn.choices ?? null,
      paceKnown: Boolean(result.turn.state.params.paceMinPerKm),
    });
  } catch (error) {
    if (error instanceof LlmBudgetExceededError) {
      return NextResponse.json(
        { code: "budget", error: "The assistant is resting for today. Try again tomorrow." },
        { status: 429 },
      );
    }
    console.error("[assistant] turn failed:", error);
    return NextResponse.json({ error: "The assistant could not answer. Try again." }, { status: 502 });
  }
}
