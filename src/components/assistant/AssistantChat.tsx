"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui";
import {
  DEFAULT_PACE_MIN_PER_KM,
  type AssistantState,
  type BuildAction,
  type Candidate,
} from "@/lib/assistant/state";
import { createClient } from "@/lib/supabase/client";
import type { AssistantDefaults } from "@/lib/assistant/defaults";
import { AssistantSettings, PACE_PRESETS, useAssistantDefaults } from "./AssistantSettings";
import { StartLocationPicker } from "./StartLocationPicker";
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
  /** The walker stated an order: visit the stops exactly as listed. */
  fixedOrder?: boolean;
  /** Route rules the walker stated; sent with every (re)build of this walk. */
  routeRules?: { noRepeat?: boolean; avoidStreets?: string[]; avoidDangerous?: boolean };
  /** The route the assistant checked: the planner shows this one for this build. */
  geometry?: Coordinates[];
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
  /** A walk has been built and can be started. */
  walkReady: boolean;
  onStart: (simulate: boolean) => void;
  /** The walker picked a start point (GPS or searched place). */
  onSetOrigin: (coordinates: Coordinates) => void;
}

const MAX_IMAGES = 5;

/** Shrinks an attached image to at most 1280px on its long side, as a JPEG data URL. */
async function toSmallDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
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

/** Candidates the reply talks about (by full or shortened name); all of them when it names none. */
function mentionedPlaces(reply: string, places: Candidate[]): Candidate[] {
  const hits = places.filter((c) => {
    const short = c.name.split(/\s[-–—]\s|,|\(/)[0].trim();
    return reply.includes(c.name) || (short.length >= 3 && reply.includes(short));
  });
  return hits.length > 0 ? hits : places;
}

type LimitKey = "timeMinutes" | "radiusKm" | "endDistanceKm" | "maxWalkKm";
type Limits = Record<LimitKey, number | null> & { paceMinPerKm?: number };

const LIMIT_ROWS: Array<{ key: LimitKey; label: string; unit: string; options: number[] }> = [
  { key: "timeMinutes", label: "Time available", unit: "min", options: [30, 60, 90, 120, 180] },
  { key: "radiusKm", label: "Search radius from you", unit: "km", options: [1, 2, 5, 10] },
  { key: "endDistanceKm", label: "End at most this far from the start", unit: "km", options: [0, 1, 2, 5] },
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
  initial,
}: {
  onConfirm: (l: Limits) => void;
  disabled: boolean;
  defaults: AssistantDefaults;
  askPace: boolean;
  /** Limits the walker already stated in chat; they win over the saved defaults. */
  initial?: Partial<Limits>;
}) {
  // Starts from the walker's saved defaults (the gear menu); anything unset is "no limit".
  const [limits, setLimits] = useState<Limits>({
    timeMinutes: initial?.timeMinutes ?? defaults.timeMinutes ?? null,
    radiusKm: initial?.radiusKm ?? defaults.radiusKm ?? null,
    endDistanceKm: initial?.endDistanceKm ?? defaults.endDistanceKm ?? null,
    maxWalkKm: initial?.maxWalkKm ?? defaults.maxWalkKm ?? null,
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
                {o === 0 ? "Back to start" : `${o} ${row.unit}`}
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
              value={limits[row.key] !== null && !row.options.includes(limits[row.key] as number) ? (limits[row.key] as number) : ""}
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

function GuideFigure() {
  const [fallback, setFallback] = useState(false);
  // guide.png is dropped in later; until then the old crop shows, softly faded.
  // The ref callback also catches a load error that fired before hydration.
  const check = (el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth === 0) setFallback(true);
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={check}
      data-mock="guide"
      alt=""
      aria-hidden
      onError={() => setFallback(true)}
      src={fallback ? "/images/assistant/guide.jpg" : "/images/assistant/guide.png"}
      data-fallback={fallback || undefined}
      className="pointer-events-none absolute bottom-0 left-0 z-10 h-[149px] w-[54%] object-contain object-left-bottom data-[fallback]:w-[100px] data-[fallback]:object-cover data-[fallback]:object-top data-[fallback]:[mask-image:radial-gradient(ellipse_70%_75%_at_50%_42%,#000_62%,transparent_100%)]"
    />
  );
}

const THEMES = [
  { label: "Must-see Places", message: "Show me the must-see places", image: "/images/assistant/must-see.jpg" },
  { label: "Food & Markets", message: "I want good food and markets", image: "/images/assistant/food.jpg" },
  { label: "Viewpoints & Scenery", message: "I want viewpoints and scenery", image: "/images/assistant/viewpoints.jpg" },
  { label: "Nature & Parks", message: "I want nature and parks", image: "/images/assistant/nature.jpg" },
  { label: "Hidden Gems", message: "Show me hidden gems", image: "/images/assistant/hidden.jpg" },
];

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

export function AssistantChat({ origin, isBuilding, onPlacesChange, onBuild, onFocusPlace, walkReady, onStart, onSetOrigin }: AssistantChatProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [showChats, setShowChats] = useState(false);
  const [places, setPlaces] = useState<Candidate[]>([]);
  const [statedLimits, setStatedLimits] = useState<Partial<Limits>>({});
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [askPace, setAskPace] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { defaults, setDefaults } = useAssistantDefaults();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [copiedAt, setCopiedAt] = useState<number | null>(null);
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
    const lastReply = [...((rows ?? []) as Message[])].reverse().find((m) => m.role === "assistant")?.content ?? "";
    onPlacesChange(mentionedPlaces(lastReply, candidates).map(toAttraction));
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

  const addImages = async (files: File[]) => {
    const urls = (await Promise.all(files.map(toSmallDataUrl))).filter((u): u is string => !!u);
    if (urls.length) setImages((cur) => [...cur, ...urls].slice(0, MAX_IMAGES));
  };

  const send = async (event: FormEvent | null, override?: { message: string; limits?: Limits }) => {
    event?.preventDefault();
    const typed = override?.message ?? text.trim();
    const sentImages = override ? [] : images;
    const message = typed || (sentImages.length ? "🖼" : "");
    if (!message || pending) return;
    setLimitsOpen(false);
    setChoices([]);
    if (!override) {
      setText("");
      setImages([]);
    }
    setError(null);
    setMessages((m) => [...m, { role: "user", content: sentImages.length ? `${message} 🖼×${sentImages.length}` : message }]);
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: typed, origin, defaults, ...(sentImages.length ? { images: sentImages } : {}), ...(override?.limits ? { limits: override.limits } : {}) }),
      });
      const data = (await response.json()) as AssistantReply;
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setChatId(data.chatId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setPlaces(data.state.candidates);
      onPlacesChange(mentionedPlaces(data.reply, data.state.candidates).map(toAttraction));
      setStatedLimits({
        timeMinutes: data.state.params.timeMinutes ?? null,
        radiusKm: data.state.params.radiusKm ?? null,
        endDistanceKm: data.state.params.endDistanceKm ?? null,
        maxWalkKm: data.state.params.maxWalkKm ?? null,
      });
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
          fixedOrder: data.action.ordered === true,
          geometry: data.action.geometry,
          routeRules: {
            noRepeat: params.noRepeat,
            avoidStreets: params.avoidStreets,
            avoidDangerous: params.avoidDangerous,
          },
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
    <div className="@container relative overflow-hidden rounded-tk-card bg-tk-card font-brand shadow-tk-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pl-[20px] pr-[14px] pt-[13px] @max-[340px]:pl-[14px] @max-[340px]:pr-[10px]">
        <span className="whitespace-nowrap font-display text-[22.2px] font-[650] leading-none tracking-[-0.01em] text-tk-ink @max-[340px]:text-[19px]">
          Plan with Traike
        </span>
        <div className="flex grow items-center gap-[12px] whitespace-nowrap text-[12.5px] leading-none text-[#2f3340] @max-[340px]:gap-[9px] @max-[340px]:text-[11.5px]">
          <button type="button" className="underline decoration-1 underline-offset-[2px] hover:text-tk-ink" onClick={() => setShowChats((v) => !v)}>
            Chats ({chats.length})
          </button>
          <button type="button" className="underline decoration-1 underline-offset-[2px] hover:text-tk-ink" onClick={newChat}>
            New chat
          </button>
          <button
            type="button"
            aria-label="Assistant settings"
            title="Settings"
            className={`ml-auto flex h-[22px] w-[22px] items-center justify-center transition-colors ${
              settingsOpen ? "text-tk-send" : "text-[#2b2d3a] hover:text-tk-send"
            }`}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="currentColor" fillRule="evenodd" aria-hidden>
              <path d="M20.43 10.29 L22.91 10.57 L22.91 13.43 L20.43 13.71 L19.17 16.75 L20.72 18.70 L18.70 20.72 L16.75 19.17 L13.71 20.43 L13.43 22.91 L10.57 22.91 L10.29 20.43 L7.25 19.17 L5.30 20.72 L3.28 18.70 L4.83 16.75 L3.57 13.71 L1.09 13.43 L1.09 10.57 L3.57 10.29 L4.83 7.25 L3.28 5.30 L5.30 3.28 L7.25 4.83 L10.29 3.57 L10.57 1.09 L13.43 1.09 L13.71 3.57 L16.75 4.83 L18.70 3.28 L20.72 5.30 L19.17 7.25Z M12 8.4a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pb-[13px]">
        <StartLocationPicker origin={origin} onPick={onSetOrigin} />
        {settingsOpen && (
          <div className="mx-[17px] mt-[8px]">
            <AssistantSettings defaults={defaults} onChange={setDefaults} />
          </div>
        )}

        {showChats && (
          <ul className="mx-[17px] mt-[8px] max-h-40 space-y-1 overflow-y-auto rounded-[10px] border border-tk-line bg-[#fffdf9] p-1">
            {chats.length === 0 && <li className="px-2 py-1 text-xs text-charcoal/50">No chats yet.</li>}
            {chats.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1 hover:bg-cream/70">
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

        {messages.length === 0 && (
          <>
            <div data-mock="scene" className="relative mt-[2px] min-h-[152px] pb-[57px] pt-[22px]">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(247,236,220,0)_0%,#f7ecdc_45%,#f3e2c9_100%)]" />
              {/* eslint-disable @next/next/no-img-element */}
              <img src="/images/traike/olive-leaves.svg" alt="" aria-hidden className="pointer-events-none absolute -left-[4px] top-[7px] z-0 w-[56px]" />
              <img src="/images/traike/olive-leaves.svg" alt="" aria-hidden className="pointer-events-none absolute left-[25%] top-[78px] z-0 w-[46px] -scale-x-100 opacity-90" />
              <GuideFigure />
              <svg aria-hidden viewBox="0 0 67 50" className="pointer-events-none absolute left-[27.6%] top-[55px] z-10 h-[22px] w-[30px]" fill="none" stroke="#c9653a" strokeWidth={6} strokeLinecap="round">
                <path d="M5 20 13 42M36 4 29 41M63 28 44 49" />
              </svg>
              <img src="/images/traike/route-trail.svg" alt="" aria-hidden className="pointer-events-none absolute right-[22px] top-[106px] z-10 w-[116px]" />
              <div data-mock="bubble" className="relative z-20 ml-[36.8%] mr-[3.4%] drop-shadow-[0_2px_5px_rgba(110,80,50,0.16)]">
                <svg aria-hidden viewBox="0 0 54 41" className="absolute -left-[13px] bottom-0 h-[18px] w-[24px]">
                  <path d="M29 3C29 15 22 22 10 27 24 31 38 37 54 41H29Z" fill="#fffcf7" />
                </svg>
                <p className="relative rounded-[13px] bg-tk-bubble pb-[11px] pl-[16px] pr-[8px] pt-[10px] text-[12.7px] leading-[17.5px] text-tk-body">
                  Tell me where you are and what you feel like — places, food, nature. I will find them and plan the
                  walk with you.
                </p>
              </div>
              <img src="/images/traike/olive-leaves.svg" alt="" aria-hidden className="pointer-events-none absolute -right-[2px] top-[119px] z-20 w-[34px] -scale-x-100 rotate-[25deg]" />
              {/* eslint-enable @next/next/no-img-element */}
            </div>
          </>
        )}

        <div ref={listRef} className={`mx-[17px] mt-[10px] empty:hidden ${messages.length > 0 ? "max-h-72 space-y-2 overflow-y-auto" : "space-y-2"}`}>
          {messages.map((m, i) => (
            <div
              key={i}
              dir="auto"
              title={copiedAt === i ? undefined : "Click to copy"}
              onClick={(e) => {
                // A drag-selection or a click on a place link keeps its own meaning; a plain click copies the message.
                if (window.getSelection()?.toString() || (e.target as HTMLElement).closest("button, a")) return;
                void navigator.clipboard?.writeText(m.content).then(() => {
                  setCopiedAt(i);
                  window.setTimeout(() => setCopiedAt((cur) => (cur === i ? null : cur)), 1200);
                });
              }}
              className={`relative cursor-pointer whitespace-pre-wrap px-[14px] py-[9px] text-[13px] leading-[1.4] ${
                m.role === "user"
                  ? "ms-8 rounded-[13px] rounded-br-[4px] bg-tk-ink text-tk-card"
                  : "me-8 rounded-[13px] rounded-bl-[4px] bg-tk-bubble text-tk-body shadow-[0_2px_6px_rgba(110,80,50,0.12)]"
              }`}
            >
              {m.role === "assistant" ? renderMessage(m.content, places, onFocusPlace) : m.content}
              {copiedAt === i && <span className="absolute -top-2 end-2 rounded-full bg-tk-ink px-2 text-[10px] text-tk-card">Copied</span>}
            </div>
          ))}
          {limitsOpen && !pending && (
            <LimitsBox
              disabled={pending}
              defaults={defaults}
              askPace={askPace}
              initial={statedLimits}
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
                  className="rounded-full border border-tk-send bg-white px-[10px] py-[4px] text-[12px] text-tk-wordmark"
                  onClick={() => void send(null, { message: c })}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {walkReady && !pending && !isBuilding && (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onStart(false)}>Start walk</Button>
              <Button variant="secondary" onClick={() => onStart(true)}>
                Simulate (10×)
              </Button>
            </div>
          )}
          {pending && <p className="text-xs text-charcoal/50">Thinking…</p>}
        </div>

        {error && <p className="mx-[17px] mt-2 text-[12px] text-red-700">{error}</p>}

        <form onSubmit={(e) => void send(e)} className="relative z-0 mt-[12px] space-y-[11px] px-[17px]">
          <textarea
            ref={inputRef}
            dir="auto"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
              if (files.length) {
                e.preventDefault();
                void addImages(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="I want to see Habima Square, the Jaffa port, and a good market"
            className="block w-full resize-y rounded-[6px] border border-tk-field bg-white px-[13px] py-[5px] text-[13.3px] leading-[19.5px] text-tk-body placeholder:text-[#8a8580] focus:border-tk-send focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-[7px]">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addImages([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={images.length >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-tk-field bg-white px-[10px] py-[3px] text-[12px] text-tk-body hover:border-tk-send disabled:cursor-not-allowed"
            >
              📎 Add image
            </button>
            {images.map((src, i) => (
              <span key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-[34px] w-[34px] rounded-[5px] object-cover" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute -right-[5px] -top-[5px] flex h-[15px] w-[15px] items-center justify-center rounded-full bg-tk-ink text-[10px] leading-none text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {!pending && !isBuilding && (
            // Theme shortcuts: one scrollable row between the input and Send; typing still works.
            <div
              onWheel={(e) => {
                if (e.deltaY) e.currentTarget.scrollLeft += e.deltaY;
              }}
              onMouseDown={(e) => {
                // Click-and-drag scrolling; a drag must not fire the pill under the cursor.
                const row = e.currentTarget;
                const startX = e.clientX;
                const startLeft = row.scrollLeft;
                let moved = false;
                const onMove = (ev: MouseEvent) => {
                  if (Math.abs(ev.clientX - startX) > 4) moved = true;
                  row.scrollLeft = startLeft - (ev.clientX - startX);
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                  if (moved) {
                    const block = (ev: MouseEvent) => ev.stopPropagation();
                    row.addEventListener("click", block, { capture: true, once: true });
                    setTimeout(() => row.removeEventListener("click", block, true), 0);
                  }
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              className="-mx-[17px] flex cursor-grab select-none gap-[7px] active:cursor-grabbing overflow-x-auto px-[17px] pb-[6px] [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-track]:mx-[17px] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-tk-send"
            >
              {THEMES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => void send(null, { message: t.message })}
                  className="flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border border-[#eadfce] bg-[#fffdf9] py-[4px] pe-[12px] ps-[4px] font-brand text-[12.5px] font-semibold tracking-[0.005em] text-tk-ink shadow-[0_1px_3px_rgba(50,32,16,0.12)] transition-colors hover:border-tk-send hover:bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.image} alt="" aria-hidden className="h-[22px] w-[22px] rounded-full object-cover" />
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border border-dashed border-tk-send/60 bg-transparent py-[4px] pe-[12px] ps-[8px] font-brand text-[12.5px] font-semibold text-tk-wordmark transition-colors hover:bg-white"
              >
                <span aria-hidden>📍</span>Custom Walk
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={pending || isBuilding || (!text.trim() && images.length === 0)}
            className="block h-[37px] w-full rounded-[9px] bg-tk-send text-[15.9px] font-medium leading-none text-white transition-colors hover:bg-[#c2643c] disabled:cursor-not-allowed"
          >
            {isBuilding ? "Building your walk…" : "Send"}
          </button>
        </form>

      </div>
    </div>
  );
}
