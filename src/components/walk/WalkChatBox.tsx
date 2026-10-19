"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { WalkChat } from "@/lib/hooks/useWalkChat";
import { CHAT_COPY } from "@/lib/walk/chat/chat-copy";
import type { ChatLang } from "@/lib/walk/chat/reply";

const SHOWN_MESSAGES = 6; // the last three exchanges

/** The in-walk "Ask" pill: expands to one input and the last few replies. Lives in the HUD stack. */
export function WalkChatBox({ chat, lang }: { chat: WalkChat; lang: ChatLang }) {
  const copy = CHAT_COPY[lang];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    if (chat.openTick > 0) setOpen(true);
  }, [chat.openTick]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || chat.pending) return;
    chat.send(text);
    setText("");
  };

  if (!open) {
    return (
      <div className="pointer-events-none flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto rounded-full border border-forest/20 bg-cream/95 px-4 py-2 text-xs font-semibold text-forest shadow-[0_4px_20px_rgba(30,61,47,0.12)] backdrop-blur transition hover:bg-forest/10"
        >
          {copy.ask}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="walk-chat"
      className="pointer-events-auto space-y-2 rounded-2xl border border-forest/15 bg-cream/95 p-3 shadow-[0_4px_20px_rgba(30,61,47,0.12)] backdrop-blur"
    >
      {chat.messages.length > 0 && (
        <ul
          ref={(el) => {
            if (el) el.scrollTop = el.scrollHeight;
          }}
          className="max-h-40 space-y-1.5 overflow-y-auto"
          aria-live="polite"
        >
          {chat.messages.slice(-SHOWN_MESSAGES).map((m) => (
            <li key={m.id} dir="auto" className={m.role === "user" ? "text-end" : "text-start"}>
              <p
                className={`inline-block rounded-xl px-3 py-1.5 text-xs ${
                  m.role === "user" ? "bg-forest/10 text-forest" : "bg-white text-charcoal/80"
                }`}
              >
                {m.text}
              </p>
              {!m.used && m.actions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {m.actions.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => chat.runAction(m.id, i)}
                      className="rounded-full bg-terra px-3 py-1 text-xs font-semibold text-white transition hover:bg-terra/90"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          dir="auto"
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          placeholder={copy.placeholder}
          aria-label={copy.ask}
          className="min-w-0 flex-1 rounded-full border border-charcoal/15 bg-white px-3 py-1.5 text-base focus:border-terra focus:outline-none sm:text-sm"
        />
        <button
          type="submit"
          disabled={chat.pending || text.trim().length === 0}
          className="rounded-full bg-forest px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {copy.send}
        </button>
      </form>
    </div>
  );
}
