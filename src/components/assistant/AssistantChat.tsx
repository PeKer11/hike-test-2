"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { recognitionLang, textLang, useSpeechInput } from "@/lib/speech/recognition";
import { speak, stopSpeaking, ttsSupported } from "@/lib/walk/tts";

import { Button } from "@/components/ui";
import { CloseIcon, ImageIcon, MicIcon, PlanIcon, SlidersIcon, SpeakerIcon, StopIcon, WarnIcon } from "@/components/ui/icons";
import {
  DEFAULT_PACE_MIN_PER_KM,
  type AssistantState,
  type BuildAction,
  type Candidate,
  type WalkParams,
  visitMinutes,
} from "@/lib/assistant/state";
import { dwellMinutes, legPace } from "@/lib/walk/timing";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/hooks/useHydrated";
import type { AssistantDefaults } from "@/lib/assistant/defaults";
import type { CurrentWalk } from "@/lib/assistant/current-walk";
import { AssistantSettings, PACE_PRESETS, paceLabel, useAssistantDefaults, type AssistantLang } from "./AssistantSettings";
import { StartLocationPicker } from "./StartLocationPicker";
import type { Attraction, Coordinates } from "@/lib/types";
import { ACCESS_PROFILES } from "@/lib/walk/access";
import { BTN_ALT, BTN_ALT_SM, chipCell } from "@/components/ui/panel-style";
import { isExploreRequest } from "@/lib/walk/chat/explore";

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
  /** The walker stated a pace (not the default): a mid-walk rebuild uses it instead of the walk's own. */
  paceExplicit?: boolean;
  /** Route rules the walker stated; sent with every (re)build of this walk. */
  routeRules?: { noRepeat?: boolean; avoidStreets?: string[]; avoidDangerous?: boolean; stayInArea?: string; restMinutes?: number; access?: "stroller" | "wheelchair"; maxGradePct?: number };
  /** The route the assistant checked: the planner shows this one for this build. */
  geometry?: Coordinates[];
  /** The time limit was set in this turn: mid-walk, availableMinutes means minutes from now. */
  timeExplicit?: boolean;
  /** An end limit was stated in this turn (0 is "back where I started"): mid-walk it applies to the rebuild. */
  endExplicit?: boolean;
}

interface AssistantChatProps {
  /** Where the walker is now (GPS or map pin). */
  origin: Coordinates | null;
  isBuilding: boolean;
  /** Places the chat has found, shown as pins on the map. */
  onPlacesChange: (places: Attraction[]) => void;
  /** Resolves false when the route could not be built, so the chat can say the map did not change. */
  onBuild: (build: AssistantBuild) => Promise<boolean> | void;
  /** The walk on the map right now, read at send time so "extend" knows what to extend. */
  getCurrentWalk?: () => CurrentWalk | null;
  /** Saved places the walker queued for this walk; the assistant must include them. */
  queuedPlaces?: { name: string; coordinates: Coordinates }[];
  /** A walk is in progress: the chat plans from where the walker is now, not the original start. */
  walking?: boolean;
  /** A place name in the chat was tapped: bring it into view on the map. */
  onFocusPlace: (coordinates: Coordinates) => void;
  /** A walk has been built and can be started. */
  walkReady: boolean;
  onStart: (simulate: boolean) => void;
  /** The walker picked a start point (GPS or searched place). */
  onSetOrigin: (coordinates: Coordinates) => void;
  /** Only a rough (IP-city) position is known: show that area, without choosing a start. */
  onFocusArea?: (coordinates: Coordinates) => void;
  /** Text to put in the message box (e.g. "like my last walk, but here"); a new `tick` puts it there again. */
  prefill?: { text: string; tick: number } | null;
  /** The words of the chat's own chrome (the planner's language). The assistant answers in the language it is written to. */
  lang?: AssistantLang;
}

/** The chat's own labels. What is sent to the assistant (theme messages, the limits summary) stays in the walker's language or English. */
const COPY = {
  en: {
    title: "Plan with Traike",
    chats: (n: number) => `Chats (${n})`,
    newChat: "New chat",
    settingsTitle: "Preferences",
    settingsAria: "Assistant preferences",
    noChats: "No chats yet.",
    deleteChat: "Delete chat",
    clickToCopy: "Click to copy",
    copied: "Copied",
    readAloud: "Read aloud",
    stopReading: "Stop reading",
    startWalk: "Start walk",
    simulate: "Simulate (10×)",
    thinking: "Thinking…",
    placeholder: "I want to see Habima Square, the Jaffa port, and a good market",
    addImage: "Add image",
    removeImage: "Remove image",
    customWalk: "Custom Walk",
    dictate: "Dictate",
    stopDictation: "Stop dictation",
    dictHe: "Dictation language: Hebrew. Tap for English",
    dictEn: "Dictation language: English. Tap for Hebrew",
    building: "Building your walk…",
    loading: "Loading…",
    send: "Send",
    stop: "Stop",
    unreachable: "Could not reach the assistant. Check your connection.",
    wrong: "Something went wrong. Try again.",
    aiDown: "The assistant isn't available right now, try again.",
    busyNow: "Still working on your last message.",
    resting: "The assistant is resting for today. Try again tomorrow.",
    limits: {
      timeMinutes: "Time available",
      radiusKm: "Search radius from you",
      endDistanceKm: "End at most this far from the start",
      maxWalkKm: "Max walking distance",
      min: "min",
      km: "km",
      backToStart: "Back to start",
      noLimit: "No limit",
      other: "other",
      pace: "How fast do you usually walk? (once)",
      confirm: "Confirm",
    },
  },
  he: {
    title: "תכנון עם טרייק",
    chats: (n: number) => `שיחות (${n})`,
    newChat: "שיחה חדשה",
    settingsTitle: "העדפות",
    settingsAria: "העדפות העוזר",
    noChats: "אין שיחות עדיין.",
    deleteChat: "מחיקת שיחה",
    clickToCopy: "לחצו להעתקה",
    copied: "הועתק",
    readAloud: "הקראה",
    stopReading: "עצירת הקראה",
    startWalk: "התחלת הליכה",
    simulate: "הדמיה (פי 10)",
    thinking: "חושב…",
    placeholder: "אני רוצה לעבור בכיכר הבימה, שוק טוב ולסיים בנמל יפו לקראת שקיעה",
    addImage: "הוספת תמונה",
    removeImage: "הסרת תמונה",
    customWalk: "הליכה משלי",
    dictate: "הכתבה",
    stopDictation: "עצירת הכתבה",
    dictHe: "שפת ההכתבה: עברית. הקישו לאנגלית",
    dictEn: "שפת ההכתבה: אנגלית. הקישו לעברית",
    building: "בונה את המסלול…",
    loading: "טוען…",
    send: "שליחה",
    stop: "עצירה",
    unreachable: "לא הצלחתי להגיע לעוזר. בדקו את החיבור.",
    wrong: "משהו השתבש. נסו שוב.",
    aiDown: "העוזר לא זמין כרגע, נסו שוב",
    busyNow: "עדיין עובד על ההודעה הקודמת שלכם.",
    resting: "העוזר נח להיום. נסו שוב מחר.",
    limits: {
      timeMinutes: "זמן פנוי",
      radiusKm: "רדיוס חיפוש ממך",
      endDistanceKm: "לסיים עד מרחק זה מההתחלה",
      maxWalkKm: "מרחק הליכה מרבי",
      min: "דק׳",
      km: "ק״מ",
      backToStart: "חזרה להתחלה",
      noLimit: "ללא הגבלה",
      other: "אחר",
      pace: "באיזה קצב אתם הולכים בדרך כלל? (פעם אחת)",
      confirm: "אישור",
    },
  },
} as const;

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
  // A "⚠" in a reply (the assistant's own warnings) is drawn with the set's warning icon, not the font's glyph.
  return content
    .replace(/\*\*/g, "")
    .split(/⚠\s*/)
    .map((segment, i) => (
      <Fragment key={i}>
        {i > 0 ? <WarnIcon className="me-1.5 inline h-[17px] w-[17px] align-[-3px] text-terra" /> : null}
        {renderPlaces(segment, places, onFocusPlace)}
      </Fragment>
    ));
}

function renderPlaces(text: string, places: Candidate[], onFocusPlace: (coordinates: Coordinates) => void) {
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
  lang,
  defaults,
  askPace,
  initial,
}: {
  onConfirm: (l: Limits) => void;
  disabled: boolean;
  lang: AssistantLang;
  defaults: AssistantDefaults;
  askPace: boolean;
  /** Limits the walker already stated in chat; they win over the saved defaults. */
  initial?: Partial<Limits>;
}) {
  const L = COPY[lang].limits;
  // Starts from the walker's saved defaults (the gear menu); anything unset is "no limit".
  const [limits, setLimits] = useState<Limits>({
    timeMinutes: initial?.timeMinutes ?? defaults.timeMinutes ?? null,
    radiusKm: initial?.radiusKm ?? defaults.radiusKm ?? null,
    endDistanceKm: initial?.endDistanceKm ?? defaults.endDistanceKm ?? null,
    maxWalkKm: initial?.maxWalkKm ?? defaults.maxWalkKm ?? null,
  });
  return (
    <div className="space-y-2 rounded-xl border border-charcoal/10 bg-paper p-3">
      {LIMIT_ROWS.map((row) => (
        <div key={row.key} className="space-y-1">
          <p className="text-xs font-medium text-charcoal/70">{L[row.key]}</p>
          <div className="flex flex-wrap items-center gap-1">
            {row.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setLimits((l) => ({ ...l, [row.key]: o }))}
                className={chipCell(limits[row.key] === o)}
              >
                {o === 0 ? L.backToStart : `${o} ${row.unit === "min" ? L.min : L.km}`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLimits((l) => ({ ...l, [row.key]: null }))}
              className={chipCell(limits[row.key] === null)}
            >
              {L.noLimit}
            </button>
            <input
              type="number"
              min={1}
              inputMode="decimal"
              placeholder={L.other}
              aria-label={`${L[row.key]} (${row.unit === "min" ? L.min : L.km})`}
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
          <p className="text-xs font-medium text-charcoal/70">{L.pace}</p>
          <div className="flex flex-wrap gap-1">
            {PACE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setLimits((l) => ({ ...l, paceMinPerKm: p.value }))}
                className={chipCell(limits.paceMinPerKm === p.value)}
              >
                {paceLabel(p, lang, false)}
              </button>
            ))}
          </div>
        </div>
      )}
      <Button fullWidth disabled={disabled} onClick={() => onConfirm(limits)}>
        {L.confirm}
      </Button>
    </div>
  );
}

const BUSY_RETRIES = 75;
const BUSY_RETRY_MS = 2000;

/** The theme chips. `id` is the English label (what a picked chip is remembered by); `message` is what the assistant is sent. */
const THEMES = [
  { id: "Must-see Places", label: { en: "Must-see Places", he: "אתרי חובה" }, message: { en: "Show me the must-see places", he: "הראו לי את אתרי החובה" }, image: "/images/assistant/must-see.jpg" },
  { id: "Food & Markets", label: { en: "Food & Markets", he: "אוכל ושווקים" }, message: { en: "I want good food and markets", he: "אני רוצה אוכל טוב ושווקים" }, image: "/images/assistant/food.jpg" },
  { id: "Viewpoints & Scenery", label: { en: "Viewpoints & Scenery", he: "תצפיות ונוף" }, message: { en: "I want viewpoints and scenery", he: "אני רוצה תצפיות ונוף" }, image: "/images/assistant/viewpoints.jpg" },
  { id: "Nature & Parks", label: { en: "Nature & Parks", he: "טבע ופארקים" }, message: { en: "I want nature and parks", he: "אני רוצה טבע ופארקים" }, image: "/images/assistant/nature.jpg" },
  { id: "Hidden Gems", label: { en: "Hidden Gems", he: "פינות נסתרות" }, message: { en: "Show me hidden gems", he: "הראו לי פינות נסתרות" }, image: "/images/assistant/hidden.jpg" },
];

function toAttraction(c: Candidate, params?: WalkParams): Attraction {
  const plan = params?.stops?.[c.id];
  return {
    id: c.id,
    name: c.name,
    coordinates: c.coordinates,
    category: c.category === "area" ? "landmark" : c.category,
    avgVisitMinutes: dwellMinutes(params?.stops, c.id, visitMinutes(c.category)),
    ...(plan?.pace !== undefined ? { legPaceMinPerKm: legPace(params?.stops, c.id, (params?.paceMinPerKm ?? DEFAULT_PACE) * (params?.access ? ACCESS_PROFILES[params.access].paceFactor : 1)) } : {}),
    tags: { source: "assistant", placeId: c.placeId },
  };
}

export function AssistantChat({ origin, isBuilding, onPlacesChange, onBuild, getCurrentWalk, queuedPlaces, walking, onFocusPlace, walkReady, onStart, onSetOrigin, onFocusArea, prefill, lang = "en" }: AssistantChatProps) {
  const t = COPY[lang];
  const getCurrentWalkRef = useRef(getCurrentWalk);
  getCurrentWalkRef.current = getCurrentWalk;
  const queuedRef = useRef(queuedPlaces ?? []);
  queuedRef.current = queuedPlaces ?? [];
  const walkingRef = useRef(walking ?? false);
  walkingRef.current = walking ?? false;
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [showChats, setShowChats] = useState(false);
  const [places, setPlaces] = useState<Candidate[]>([]);
  const [statedLimits, setStatedLimits] = useState<Partial<Limits>>({});
  // The server HTML is typable but dead until hydration: keep it disabled so nothing typed there is lost.
  const hydrated = useHydrated();
  const [text, setText] = useState("");
  useEffect(() => {
    if (prefill) setText(prefill.text);
  }, [prefill]);
  const dictationBase = useRef("");
  // The browser recognises one language per tap and cannot tell Hebrew from English by ear: the walker picks it (עב / EN).
  const [micLang, setMicLang] = useState<"he" | "en" | null>(null);
  const mic = useSpeechInput(
    (spoken) => setText(dictationBase.current ? `${dictationBase.current} ${spoken}` : spoken),
    () => micLang ?? recognitionLang(text, typeof navigator === "undefined" ? "" : navigator.language),
  );
  const shownMicLang = micLang ?? recognitionLang(text, typeof navigator === "undefined" ? "" : navigator.language);
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => setCanSpeak(ttsSupported()), []);
  // Which reply is being read aloud, so its button can stop it. The browser has no "finished" callback through speak(), so poll.
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  useEffect(() => {
    if (speakingIdx === null) return;
    const id = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) setSpeakingIdx(null);
    }, 400);
    return () => window.clearInterval(id);
  }, [speakingIdx]);
  useEffect(() => () => stopSpeaking(), []);
  const [themes, setThemes] = useState<string[]>([]);
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
    onPlacesChange(mentionedPlaces(lastReply, candidates).map((c) => toAttraction(c)));
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

  // The send in flight, with what to put back if the walker undoes it.
  const inflight = useRef<{ ctl: AbortController; restore: { text: string; themes: string[]; images: string[]; choices: string[]; limitsOpen: boolean; count: number; typedOverride: boolean } } | null>(null);

  const undoSend = (failure?: string) => {
    const cur = inflight.current;
    if (!cur) return;
    inflight.current = null;
    cur.ctl.abort();
    // The browser dropping the request does not always stop the server's turn: tell it to stop (and stop spending).
    void fetch("/api/assistant/cancel", { method: "POST", keepalive: true }).catch(() => undefined);
    const r = cur.restore;
    setMessages((m) => m.slice(0, r.count));
    if (!r.typedOverride) {
      setText((t) => (t.trim() ? t : r.text));
      setThemes(r.themes);
      setImages(r.images);
    }
    setChoices(r.choices);
    setLimitsOpen(r.limitsOpen);
    setPending(false);
    setError(failure ?? null);
  };

  const send = async (event: FormEvent | null, override?: { message: string; limits?: Limits }) => {
    event?.preventDefault();
    const typed = override?.message ?? [...THEMES.filter((th) => themes.includes(th.id)).map((th) => th.message[lang]), text.trim()].filter(Boolean).join(". ");
    const sentImages = override ? [] : images;
    const message = typed || (sentImages.length ? "🖼" : "");
    if (!message || pending || isBuilding) return;
    const ctl = new AbortController();
    inflight.current = { ctl, restore: { text, themes, images, choices, limitsOpen, count: messages.length, typedOverride: !!override } };
    setLimitsOpen(false);
    setChoices([]);
    if (!override) {
      setText("");
      setThemes([]);
      setImages([]);
    }
    setError(null);
    setMessages((m) => [...m, { role: "user", content: sentImages.length ? `${message} 🖼×${sentImages.length}` : message }]);
    setPending(true);
    try {
      const currentWalk = getCurrentWalkRef.current?.() ?? null;
      const body = JSON.stringify({ chatId, message: typed, ...(currentWalk ? { current: currentWalk } : {}), origin, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, defaults, ...(queuedRef.current.length ? { queued: queuedRef.current } : {}), ...(walkingRef.current ? { walking: true } : {}), ...(sentImages.length ? { images: sentImages } : {}), ...(override?.limits ? { limits: override.limits } : {}), ...(isExploreRequest(typed) ? { explore: true } : {}) });
      // 409 "busy": an earlier turn of this user is still finishing on the server (e.g. one that was stopped).
      // Wait for it instead of leaving an unanswered bubble; Stop still cancels the wait.
      let response: Response;
      let data: AssistantReply;
      for (let attempt = 0; ; attempt++) {
        response = await fetch("/api/assistant", { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body });
        data = (await response.json()) as AssistantReply;
        if (response.status !== 409 || (data as { code?: string }).code !== "busy" || attempt >= BUSY_RETRIES) break;
        await new Promise((resolve) => window.setTimeout(resolve, BUSY_RETRY_MS));
        if (ctl.signal.aborted) return;
      }
      if (!response.ok) {
        // Nothing was answered: take the message back out of the thread and put the draft back.
        // The server's own text is English: the chat shows its localized line for the code it knows, never the raw text.
        const code = (data as { code?: string }).code;
        undoSend(code === "llm_unavailable" ? t.aiDown : code === "busy" ? t.busyNow : code === "budget" ? t.resting : lang === "en" ? (data.error ?? t.wrong) : t.wrong);
        return;
      }
      setChatId(data.chatId);
      // The model can move the start (set_start); the box and map must follow, or the next message would undo it.
      const so = data.state.origin;
      if (so && !walkingRef.current && (!origin || Math.abs(so.lat - origin.lat) > 1e-6 || Math.abs(so.lng - origin.lng) > 1e-6)) onSetOrigin(so);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setPlaces(data.state.candidates);
      onPlacesChange(mentionedPlaces(data.reply, data.state.candidates).map((c) => toAttraction(c)));
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
        const built = onBuild({
          origin: data.action.origin,
          timeExplicit: data.action.timeStated === true,
          availableMinutes: params.timeMinutes ?? NO_LIMIT_MINUTES,
          paceExplicit: data.action.paceStated === true,
          endExplicit: data.action.endStated === true,
          walkingPaceMinPerKm: (params.paceMinPerKm ?? DEFAULT_PACE) * (params.access ? ACCESS_PROFILES[params.access].paceFactor : 1),
          radiusMeters: (params.radiusKm ?? NO_LIMIT_RADIUS_KM) * 1000,
          maxEndDistanceFromOriginMeters:
            params.endDistanceKm === undefined ? undefined : params.endDistanceKm * 1000,
          stops: stops.map((c) => toAttraction(c, params)),
          fixedOrder: data.action.ordered === true,
          geometry: data.action.geometry,
          routeRules: {
            noRepeat: params.noRepeat,
            avoidStreets: params.avoidStreets,
            avoidDangerous: params.avoidDangerous,
            stayInArea: params.stayInArea,
            ...(data.action.restMin ? { restMinutes: data.action.restMin } : {}),
            ...(params.access ? { access: params.access, ...(params.maxGradePct ? { maxGradePct: params.maxGradePct } : {}) } : {}),
          },
        });
        // Not awaited: the chat stops waiting as before. If the route could not be built, say so instead of leaving "extended" standing.
        void Promise.resolve(built).then((shown) => {
          if (shown !== false) return;
          const he = /[\u0590-\u05FF]/.test(data.reply);
          setMessages((m) => [...m, { role: "assistant", content: he ? "⚠ המפה לא עודכנה: לא הצלחתי לבנות את המסלול החדש. לנסות שוב?" : "⚠ The map was not updated: the new route could not be built. Try again?" }]);
        });
      }
      void refreshChats();
    } catch {
      if (ctl.signal.aborted) return; // undone by the walker
      setError(t.unreachable);
    } finally {
      // Only the newest send may clear the waiting state; an undone one already did.
      if (inflight.current?.ctl === ctl) {
        inflight.current = null;
        setPending(false);
      }
    }
  };

  return (
    <div className={`@container relative overflow-hidden bg-cream font-app-sans ${walking ? "rounded-[14px] shadow-tk-soft" : "-mx-4 border-b border-tk-hair"}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-y border-tk-hair bg-tk-bar px-4 py-2">
        <span className="whitespace-nowrap text-[15px] font-semibold text-tk-ink">
          {t.title}
        </span>
        <div className="flex grow items-center gap-[12px] whitespace-nowrap text-[14px] leading-none text-tk-body">
          <button type="button" className="underline decoration-1 underline-offset-[2px] hover:text-tk-ink" onClick={() => setShowChats((v) => !v)}>
            {t.chats(chats.length)}
          </button>
          <button type="button" className="underline decoration-1 underline-offset-[2px] hover:text-tk-ink" onClick={newChat}>
            {t.newChat}
          </button>
          <button
            type="button"
            aria-label={t.settingsAria}
            aria-expanded={settingsOpen}
            className={`ms-auto flex min-h-[22px] items-center gap-1.5 transition-colors ${
              settingsOpen ? "text-tk-send" : "text-tk-body hover:text-tk-send"
            }`}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <SlidersIcon className="h-[18px] w-[18px]" />
            {t.settingsTitle}
          </button>
        </div>
      </div>

      <div className="pb-[13px]">
        <StartLocationPicker origin={origin} onPick={onSetOrigin} onApproximate={onFocusArea} lang={lang} />
        {settingsOpen && (
          <div className="mx-[17px] mt-[8px]">
            <AssistantSettings defaults={defaults} onChange={setDefaults} lang={lang} />
          </div>
        )}

        {showChats && (
          <ul className="mx-[17px] mt-[8px] max-h-40 space-y-1 overflow-y-auto rounded-[10px] border border-tk-line bg-tk-bubble p-1">
            {chats.length === 0 && <li className="px-2 py-1 text-xs text-charcoal/50">{t.noChats}</li>}
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
                  aria-label={t.deleteChat}
                  className="flex h-6 w-6 items-center justify-center text-charcoal/50 hover:text-red-600"
                  onClick={() => void deleteChat(c.id)}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div ref={listRef} className={`mx-[17px] mt-[10px] empty:hidden ${messages.length > 0 ? "max-h-72 space-y-2 overflow-y-auto" : "space-y-2"}`}>
          {messages.map((m, i) => (
            <div
              key={i}
              dir="auto"
              title={copiedAt === i ? undefined : t.clickToCopy}
              onClick={(e) => {
                // A drag-selection or a click on a place link keeps its own meaning; a plain click copies the message.
                if (window.getSelection()?.toString() || (e.target as HTMLElement).closest("button, a")) return;
                void navigator.clipboard?.writeText(m.content).then(() => {
                  setCopiedAt(i);
                  window.setTimeout(() => setCopiedAt((cur) => (cur === i ? null : cur)), 1200);
                });
              }}
              className={`relative cursor-pointer whitespace-pre-wrap px-[14px] py-[9px] text-[15px] leading-[1.55] ${
                m.role === "user"
                  ? "ms-8 rounded-[13px] rounded-br-[4px] bg-tk-ink text-tk-card"
                  : "me-8 rounded-[13px] rounded-bl-[4px] bg-tk-bubble text-tk-body shadow-[0_2px_6px_rgba(110,80,50,0.12)]"
              }`}
            >
              {m.role === "assistant" ? renderMessage(m.content, places, onFocusPlace) : m.content}
              {m.role === "assistant" && canSpeak && (
                <button
                  type="button"
                  aria-label={speakingIdx === i ? t.stopReading : t.readAloud}
                  title={speakingIdx === i ? t.stopReading : t.readAloud}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (speakingIdx === i) {
                      stopSpeaking();
                      setSpeakingIdx(null);
                      return;
                    }
                    stopSpeaking();
                    setSpeakingIdx(speak(m.content, textLang(m.content), true) ? i : null);
                  }}
                  className="mt-1 block opacity-60 hover:opacity-100"
                >
                  {speakingIdx === i ? <StopIcon className="h-[18px] w-[18px]" /> : <SpeakerIcon className="h-[18px] w-[18px]" />}
                </button>
              )}
              {copiedAt === i && <span className="absolute -top-2 end-2 rounded-full bg-tk-ink px-2 text-[10px] text-tk-card">{t.copied}</span>}
            </div>
          ))}
          {limitsOpen && !pending && (
            <LimitsBox
              disabled={pending}
              lang={lang}
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
            <div className="flex flex-wrap gap-2">
              {choices.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="min-h-11 rounded-[10px] border-[1.5px] border-terra bg-cream px-3 text-[14px] font-semibold text-tk-check"
                  onClick={() => void send(null, { message: c })}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {walkReady && !pending && !isBuilding && (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onStart(false)}>{t.startWalk}</Button>
              <Button variant="secondary" onClick={() => onStart(true)}>
                {t.simulate}
              </Button>
            </div>
          )}
          {pending && <p className="text-[13px] text-charcoal/60">{t.thinking}</p>}
        </div>

        {(error || mic.error) && <p className="mx-[17px] mt-2 text-[13px] text-red-700">{error ?? mic.error}</p>}

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
            disabled={!hydrated}
            placeholder={t.placeholder}
            className="block min-h-[76px] w-full resize-y rounded-[10px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-3 py-2 text-[16px] leading-[1.5] text-tk-ink placeholder:text-charcoal/50 focus:outline-2 focus:outline-offset-1 focus:outline-forest"
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
              className={BTN_ALT_SM}
            >
              <ImageIcon />
              {t.addImage}
            </button>
            {images.map((src, i) => (
              <span key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-[34px] w-[34px] rounded-[5px] object-cover" />
                <button
                  type="button"
                  aria-label={t.removeImage}
                  onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute -right-[6px] -top-[6px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-tk-ink text-on-accent"
                >
                  <CloseIcon className="h-[10px] w-[10px] [&_path]:[stroke-width:2.6]" />
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
              className="-mx-[17px] flex cursor-grab select-none gap-[7px] active:cursor-grabbing overflow-x-auto px-[17px] pb-[6px] [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-track]:mx-[17px] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-paper [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-tk-send"
            >
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  aria-pressed={themes.includes(th.id)}
                  onClick={() => setThemes((cur) => (cur.includes(th.id) ? cur.filter((l) => l !== th.id) : [...cur, th.id]))}
                  className={`${chipCell(themes.includes(th.id))} shrink-0 gap-2 whitespace-nowrap pe-3 ps-1.5 text-[15px]`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={th.image} alt="" aria-hidden className="h-[30px] w-[30px] rounded-[6px] object-cover" />
                  {th.label[lang]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className={`${chipCell(false)} shrink-0 gap-2 whitespace-nowrap !border-dashed bg-transparent text-[15px]`}
              >
                <PlanIcon className="h-5 w-5" />{t.customWalk}
              </button>
            </div>
          )}
          <div className="flex items-center gap-[8px]">
            {mic.supported && (
              <button
                type="button"
                onClick={() => {
                  if (mic.listening) return mic.stop();
                  dictationBase.current = text.trim();
                  mic.start();
                }}
                aria-label={mic.listening ? t.stopDictation : t.dictate}
                aria-pressed={mic.listening}
                title={mic.listening ? t.stopDictation : t.dictate}
                className={`${BTN_ALT} w-12 shrink-0 !px-0 ${mic.listening ? "animate-pulse !border-terra !bg-terra !text-on-accent" : ""}`}
              >
                <MicIcon />
              </button>
            )}
            {mic.supported && (
              <button
                type="button"
                disabled={mic.listening}
                onClick={() => setMicLang(shownMicLang === "he" ? "en" : "he")}
                aria-label={shownMicLang === "he" ? t.dictHe : t.dictEn}
                title={shownMicLang === "he" ? t.dictHe : t.dictEn}
                className={`${BTN_ALT} shrink-0 !px-3 !text-[14px]`}
              >
                {shownMicLang === "he" ? "עב" : "EN"}
              </button>
            )}
            <button
              type="submit"
              disabled={!hydrated || pending || isBuilding || (!text.trim() && images.length === 0 && themes.length === 0)}
              className="block h-12 min-w-0 flex-1 rounded-full bg-terra text-[16px] font-semibold leading-none text-on-accent shadow-[0_3px_0_var(--tk-lip)] transition-colors hover:bg-terra/90 active:translate-y-[2px] active:shadow-[0_1px_0_var(--tk-lip)] disabled:cursor-not-allowed disabled:bg-terra/40 disabled:shadow-none"
            >
              {isBuilding ? t.building : !hydrated ? t.loading : t.send}
            </button>
            {pending && (
              <button
                type="button"
                onClick={() => undoSend()}
                aria-label={t.stop}
                title={t.stop}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tk-ink text-tk-card transition-opacity hover:opacity-85"
              >
                <span aria-hidden className="block h-[13px] w-[13px] rounded-[2px] bg-current" />
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
}
