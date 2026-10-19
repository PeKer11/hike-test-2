"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button, Card } from "@/components/ui";
import {
  DEFAULT_PACE_MIN_PER_KM,
  type AssistantState,
  type BuildAction,
  type Candidate,
} from "@/lib/assistant/state";
import { createClient } from "@/lib/supabase/client";
import type { AssistantDefaults } from "@/lib/assistant/defaults";
import { AssistantSettings, PACE_PRESETS, useAssistantDefaults } from "./AssistantSettings";
import type { Attraction, Coordinates } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSummary {
  id: string;
  title: string;
}

interface AssistantReply {
  chatId: string;
  reply: string;
  state: AssistantState;
  action: BuildAction | null;
  askLimits?: boolean;
  choices?: string[] | null;
  paceKnown?: boolean;
  error?: string;
}

export interface AssistantBuild {
  origin: Coordinates;
  availableMinutes: number;
  walkingPaceMinPerKm: number;
  radiusMeters: number;
  maxEndDistanceFromOriginMeters?: number;
  stops: Attraction[];
}

interface AssistantChatProps {
  /** Where the walker is now (GPS or map pin). */
  origin: Coordinates | null;
  isBuilding: boolean;
  /** Places the chat has found, shown as pins on the map. */
  onPlacesChange: (places: Attraction[]) => void;
  onBuild: (build: AssistantBuild) => void;
  /** A place name in the chat was tapped: bring it into view on the map. */
  onFocusPlace: (coordinates: Coordinates) => void;
}

// Unstated limits mean "no limit": the planner's largest accepted values.
const NO_LIMIT_MINUTES = 480;
const NO_LIMIT_RADIUS_KM = 10;
const DEFAULT_PACE = DEFAULT_PACE_MIN_PER_KM;

/** Message text with markdown asterisks removed and known place names turned into tappable links. */
function renderMessage(
  content: string,
  places: Candidate[],
  onFocusPlace: (coordinates: Coordinates) => void,
) {
  const text = content.replace(/\*\*/g, "");
  // The model often shortens a name ("אתגר בטבע" for "אתגר בטבע - סולמות וחבלים"), so each
  // place answers to its full name and to the part before a dash, comma or bracket.
  const byName = new Map<string, Candidate>();
  for (const c of places) {
    const short = c.name.split(/\s[-–—]\s|,|\(/)[0].trim();
    for (const n of [c.name, short]) if (n.length >= 3 && !byName.has(n)) byName.set(n, c);
  }
  const names = [...byName.keys()].sort((x, y) => y.length - x.length);
  if (names.length === 0) return text;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`));
  return parts.map((part, i) => {
    const place = byName.get(part);
    if (!place) return part;
    return (
      <button
        key={i}
        type="button"
        className="font-semibold text-terra underline decoration-dotted underline-offset-2"
        onClick={() => onFocusPlace(place.coordinates)}
      >
        {part}
      </button>
    );
  });
}

type LimitKey = "timeMinutes" | "radiusKm" | "endDistanceKm" | "maxWalkKm";
type Limits = Record<LimitKey, number | null> & { paceMinPerKm?: number };

const LIMIT_ROWS: Array<{ key: LimitKey; label: string; unit: string; options: number[] }> = [
  { key: "timeMinutes", label: "Time available", unit: "min", options: [30, 60, 90, 120, 180] },
  { key: "radiusKm", label: "Search radius from you", unit: "km", options: [1, 2, 5, 10] },
  { key: "endDistanceKm", label: "End at most this far from the start", unit: "km", options: [1, 2, 5] },
  { key: "maxWalkKm", label: "Max walking distance", unit: "km", options: [3, 5, 8, 12] },
];

const NO_LIMITS: Limits = { timeMinutes: null, radiusKm: null, endDistanceKm: null, maxWalkKm: null };

function describeLimits(l: Limits): string {
  return (
    "Limits: " +
    LIMIT_ROWS.map((r) => `${r.label.toLowerCase()}: ${l[r.key] === null ? "no limit" : `${l[r.key]} ${r.unit}`}`).join("; ") +
    (l.paceMinPerKm ? `; walking pace: ${l.paceMinPerKm} min/km` : "")
  );
}

function LimitsBox({
  onConfirm,
  disabled,
  defaults,
  askPace,
}: {
  onConfirm: (l: Limits) => void;
  disabled: boolean;
  defaults: AssistantDefaults;
  askPace: boolean;
}) {
  // Starts from the walker's saved defaults (the gear menu); anything unset is "no limit".
  const [limits, setLimits] = useState<Limits>({
    timeMinutes: defaults.timeMinutes ?? null,
    radiusKm: defaults.radiusKm ?? null,
    endDistanceKm: defaults.endDistanceKm ?? null,
    maxWalkKm: defaults.maxWalkKm ?? null,
  });
  return (
    <div className="space-y-2 rounded-xl border border-charcoal/10 bg-white p-3">
      {LIMIT_ROWS.map((row) => (
        <div key={row.key} className="space-y-1">
          <p className="text-xs font-medium text-charcoal/70">{row.label}</p>
          <div className="flex flex-wrap items-center gap-1">
            {row.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setLimits((l) => ({ ...l, [row.key]: o }))}
                className={`rounded-full border px-2 py-1 text-xs ${
                  limits[row.key] === o ? "border-terra bg-terra text-white" : "border-charcoal/15"
                }`}
              >
                {o} {row.unit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLimits((l) => ({ ...l, [row.key]: null }))}
              className={`rounded-full border px-2 py-1 text-xs ${
                limits[row.key] === null ? "border-terra bg-terra text-white" : "border-charcoal/15"
              }`}
            >
              No limit
            </button>
            <input
              type="number"
              min={1}
              inputMode="decimal"
              placeholder="other"
              aria-label={`${row.label} (${row.unit})`}
              className="w-16 rounded-full border border-charcoal/15 px-2 py-1 text-xs"
              onChange={(e) => {
                const n = Number(e.target.value);
                setLimits((l) => ({ ...l, [row.key]: n > 0 ? n : null }));
              }}
            />
          </div>
        </div>
      ))}
      {askPace && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-charcoal/70">How fast do you usually walk? (once)</p>
          <div className="flex flex-wrap gap-1">
            {PACE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setLimits((l) => ({ ...l, paceMinPerKm: p.value }))}
                className={`rounded-full border px-2 py-1 text-xs ${
                  limits.paceMinPerKm === p.value ? "border-terra bg-terra text-white" : "border-charcoal/15"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <Button fullWidth disabled={disabled} onClick={() => onConfirm(limits)}>
        Confirm
      </Button>
    </div>
  );
}

function toAttraction(c: Candidate): Attraction {
  return {
    id: c.id,
    name: c.name,
    coordinates: c.coordinates,
    category: c.category === "area" ? "landmark" : c.category,
    avgVisitMinutes: c.category === "food" ? 45 : 30,
    tags: { source: "assistant", placeId: c.placeId },
  };
}

export function AssistantChat({ origin, isBuilding, onPlacesChange, onBuild, onFocusPlace }: AssistantChatProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [showChats, setShowChats] = useState(false);
  const [places, setPlaces] = useState<Candidate[]>([]);
  const [text, setText] = useState("");
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [askPace, setAskPace] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { defaults, setDefaults } = useAssistantDefaults();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refreshChats = useCallback(async () => {
    const { data } = await createClient()
      .from("assistant_chats")
      .select("id, title")
      .order("updated_at", { ascending: false })
      .limit(30);
    setChats((data ?? []) as ChatSummary[]);
  }, []);

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending]);

  const openChat = async (id: string) => {
    const supabase = createClient();
    const [{ data: rows }, { data: chat }] = await Promise.all([
      supabase
        .from("assistant_messages")
        .select("role, content")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })
        .limit(400),
      supabase.from("assistant_chats").select("state").eq("id", id).maybeSingle(),
    ]);
    setChatId(id);
    setMessages((rows ?? []) as Message[]);
    const candidates = ((chat?.state as Partial<AssistantState> | null)?.candidates ?? []) as Candidate[];
    setPlaces(candidates);
    onPlacesChange(candidates.map(toAttraction));
    setShowChats(false);
    setError(null);
  };

  const newChat = () => {
    setChatId(null);
    setMessages([]);
    setPlaces([]);
    onPlacesChange([]);
    setShowChats(false);
    setError(null);
  };

  const deleteChat = async (id: string) => {
    await createClient().from("assistant_chats").delete().eq("id", id);
    if (id === chatId) newChat();
    void refreshChats();
  };

  const send = async (event: FormEvent | null, override?: { message: string; limits?: Limits }) => {
    event?.preventDefault();
    const message = override?.message ?? text.trim();
    if (!message || pending) return;
    setLimitsOpen(false);
    setChoices([]);
    if (!override) setText("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message, origin, defaults, ...(override?.limits ? { limits: override.limits } : {}) }),
      });
      const data = (await response.json()) as AssistantReply;
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setChatId(data.chatId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setPlaces(data.state.candidates);
      onPlacesChange(data.state.candidates.map(toAttraction));
      setLimitsOpen(data.askLimits === true);
      setAskPace(data.paceKnown === false && defaults.paceMinPerKm === undefined);
      setChoices(data.choices ?? []);
      if (data.action) {
        const { params, stops } = data.action;
        onBuild({
          origin: data.action.origin,
          availableMinutes: params.timeMinutes ?? NO_LIMIT_MINUTES,
          walkingPaceMinPerKm: params.paceMinPerKm ?? DEFAULT_PACE,
          radiusMeters: (params.radiusKm ?? NO_LIMIT_RADIUS_KM) * 1000,
          maxEndDistanceFromOriginMeters:
            params.endDistanceKm === undefined ? undefined : params.endDistanceKm * 1000,
          stops: stops.map(toAttraction),
        });
      }
      void refreshChats();
    } catch {
      setError("Could not reach the assistant. Check your connection.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-forest">Plan with Traike</h2>
        <div className="flex gap-2 text-xs">
          <button type="button" className="underline text-charcoal/70" onClick={() => setShowChats((v) => !v)}>
            Chats ({chats.length})
          </button>
          <button type="button" className="underline text-charcoal/70" onClick={newChat}>
            New chat
          </button>
          <button
            type="button"
            aria-label="Assistant settings"
            title="Settings"
            className={`text-base leading-none ${settingsOpen ? "text-terra" : "text-charcoal/70"}`}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙
          </button>
        </div>
      </div>

      {settingsOpen && <AssistantSettings defaults={defaults} onChange={setDefaults} />}

      {showChats && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-charcoal/10 bg-white p-1">
          {chats.length === 0 && <li className="px-2 py-1 text-xs text-charcoal/50">No chats yet.</li>}
          {chats.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-cream/70">
              <button
                type="button"
                dir="auto"
                className={`flex-1 truncate text-start text-sm ${c.id === chatId ? "font-semibold text-terra" : ""}`}
                onClick={() => void openChat(c.id)}
              >
                {c.title}
              </button>
              <button
                type="button"
                aria-label="Delete chat"
                className="text-xs text-charcoal/50 hover:text-red-600"
                onClick={() => void deleteChat(c.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={listRef} className="max-h-72 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-charcoal/60">
            Tell me where you are and what you feel like — places, food, nature. I will find them and plan the walk
            with you.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            dir="auto"
            className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
              m.role === "user" ? "ms-8 bg-charcoal/10" : "me-8 bg-white"
            }`}
          >
            {m.role === "assistant" ? renderMessage(m.content, places, onFocusPlace) : m.content}
          </div>
        ))}
        {limitsOpen && !pending && (
          <LimitsBox
            disabled={pending}
            defaults={defaults}
            askPace={askPace}
            onConfirm={(l) => {
              if (l.paceMinPerKm) setDefaults({ paceMinPerKm: l.paceMinPerKm });
              void send(null, { message: describeLimits(l), limits: l });
            }}
          />
        )}
        {choices.length > 0 && !pending && (
          <div className="flex flex-wrap gap-1">
            {choices.map((c) => (
              <button
                key={c}
                type="button"
                className="rounded-full border border-terra px-3 py-1 text-sm text-terra"
                onClick={() => void send(null, { message: c })}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {pending && <p className="text-xs text-charcoal/50">Thinking…</p>}
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <form onSubmit={(e) => void send(e)} className="space-y-2">
        <textarea
          dir="auto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          placeholder="I want to see Habima Square, the Jaffa port, and a good market"
          className="w-full rounded-md border border-charcoal/15 px-2 py-2 text-sm focus:border-terra focus:outline-none"
        />
        <Button type="submit" fullWidth disabled={pending || isBuilding || !text.trim()}>
          {isBuilding ? "Building your walk…" : "Send"}
        </Button>
      </form>
    </Card>
  );
}
