"use client";

import { useEffect, useState, type FormEvent } from "react";

import { ChatIcon, ChevronDownIcon } from "@/components/ui/icons";
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
      <div className="flex min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tk-btn tk-btn-primary w-full"
        >
          <ChatIcon />
          {copy.ask}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="walk-chat"
      className="basis-full space-y-2 rounded-2xl bg-forest/5 p-3"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Minimize"
          className="flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 text-forest/70 hover:bg-forest/10"
        >
          <ChevronDownIcon />
        </button>
      </div>
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
                className={`inline-block rounded-xl px-3 py-1.5 text-[15px] ${
                  m.role === "user" ? "bg-forest/10 text-forest" : "bg-paper text-charcoal/80"
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
                      className="min-h-9 rounded-full bg-terra px-3 text-[13px] font-semibold text-on-accent transition hover:bg-terra/90"
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
          className="min-h-11 min-w-0 flex-1 rounded-full bg-paper px-4 text-base shadow-tk-soft focus:outline-none focus:ring-2 focus:ring-terra/30"
        />
        <button
          type="submit"
          disabled={chat.pending || text.trim().length === 0}
          className="min-h-11 rounded-full bg-forest px-4 text-[15px] font-semibold text-on-accent disabled:opacity-50"
        >
          {copy.send}
        </button>
      </form>
    </div>
  );
}
