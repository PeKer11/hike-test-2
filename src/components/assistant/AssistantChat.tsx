"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button, Card } from "@/components/ui";
import type { AssistantState, BuildAction, Candidate } from "@/lib/assistant/state";
import { createClient } from "@/lib/supabase/client";
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
}

// Unstated limits mean "no limit": the planner's largest accepted values.
const NO_LIMIT_MINUTES = 480;
const NO_LIMIT_RADIUS_KM = 10;
const DEFAULT_PACE = 15;

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

export function AssistantChat({ origin, isBuilding, onPlacesChange, onBuild }: AssistantChatProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [showChats, setShowChats] = useState(false);
  const [text, setText] = useState("");
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
    onPlacesChange(candidates.map(toAttraction));
    setShowChats(false);
    setError(null);
  };

  const newChat = () => {
    setChatId(null);
    setMessages([]);
    onPlacesChange([]);
    setShowChats(false);
    setError(null);
  };

  const deleteChat = async (id: string) => {
    await createClient().from("assistant_chats").delete().eq("id", id);
    if (id === chatId) newChat();
    void refreshChats();
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || pending) return;
    setText("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message, origin }),
      });
      const data = (await response.json()) as AssistantReply;
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setChatId(data.chatId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      onPlacesChange(data.state.candidates.map(toAttraction));
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
        </div>
      </div>

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
            {m.content}
          </div>
        ))}
        {pending && <p className="text-xs text-charcoal/50">Thinking…</p>}
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <form onSubmit={send} className="space-y-2">
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
