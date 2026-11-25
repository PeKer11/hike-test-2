import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkChatBox } from "@/components/walk/WalkChatBox";
import { WalkHud } from "@/components/walk/WalkHud";
import type { WalkChat } from "@/lib/hooks/useWalkChat";

afterEach(cleanup);

function chatWith(over: Partial<WalkChat> = {}): WalkChat {
  return { messages: [], pending: false, llmUsed: 0, send: vi.fn(), openTick: 0, openWith: vi.fn(), runAction: vi.fn(), reset: vi.fn(), ...over };
}

describe("WalkChatBox", () => {
  it("is a pill that expands to an input capped at 200 chars and sends on submit", () => {
    const chat = chatWith();
    render(<WalkChatBox chat={chat} lang="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.maxLength).toBe(200);
    fireEvent.change(input, { target: { value: "cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(chat.send).toHaveBeenCalledWith("cafe");
    expect(input.value).toBe("");
  });

  it("leads Ask with the chat bubble, and minimises with a chevron icon rather than a text glyph", () => {
    render(<WalkChatBox chat={chatWith()} lang="en" />);
    expect(screen.getByRole("button", { name: "Ask" }).querySelector("svg path")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const minimise = screen.getByRole("button", { name: "Minimize" });
    expect(minimise.querySelector("svg")).not.toBeNull();
    expect(minimise.textContent).toBe("");
  });

  it("shows action buttons until one has been used", () => {
    const messages = [
      { id: 1, role: "app" as const, text: "I can drop Stop b.", actions: [{ kind: "drop" as const, stopId: "b", label: "Skip Stop b" }], used: false },
    ];
    const chat = chatWith({ messages });
    const { rerender } = render(<WalkChatBox chat={chat} lang="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Stop b" }));
    expect(chat.runAction).toHaveBeenCalledWith(1, 0);
    rerender(<WalkChatBox chat={chatWith({ messages: [{ ...messages[0], used: true }] })} lang="en" />);
    expect(screen.queryByRole("button", { name: "Skip Stop b" })).toBeNull();
  });

  it("hides the buttons of a superseded reply, and outlines the singles next to a combined chip", () => {
    const messages = [
      { id: 1, role: "app" as const, text: "old", actions: [{ kind: "drop" as const, stopId: "b", label: "Skip old" }], used: false, superseded: true },
      {
        id: 2, role: "app" as const, text: "new", used: false,
        actions: [
          { kind: "apply-changes" as const, adds: [], dropStopIds: ["a", "b"], label: "Apply both" },
          { kind: "drop" as const, stopId: "a", label: "Skip a" },
        ],
      },
    ];
    render(<WalkChatBox chat={chatWith({ messages })} lang="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.queryByRole("button", { name: "Skip old" })).toBeNull();
    expect(screen.getByRole("button", { name: "Apply both" }).className).toContain("tk-btn-primary");
    expect(screen.getByRole("button", { name: "Skip a" }).className).toContain("tk-btn-secondary");
  });

  it("renders in the HUD between the alert and the pills", () => {
    render(
      <WalkHud alert={null} stats={null} onDetails={vi.fn()} onEndWalk={vi.fn()} chat={<WalkChatBox chat={chatWith()} lang="he" />} />,
    );
    expect(screen.getByRole("button", { name: "שאלו" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /End walk/i })).toBeTruthy();
  });
});

type Msg = WalkChat["messages"][number];
const msg = (id: number, role: "user" | "app", text: string, extra: Partial<Msg> = {}): Msg => ({ id, role, text, actions: [], used: false, ...extra });

/** Gives the list fixed geometry (600 tall, 160 visible) and a settable scrollTop. */
function fakeScroll(list: HTMLElement, start: number) {
  let top = start;
  Object.defineProperty(list, "scrollHeight", { configurable: true, get: () => 600 });
  Object.defineProperty(list, "clientHeight", { configurable: true, get: () => 160 });
  Object.defineProperty(list, "scrollTop", { configurable: true, get: () => top, set: (v: number) => { top = v; } });
  Object.defineProperty(list, "scrollTo", { configurable: true, value: (o: { top: number }) => { top = o.top; } });
  return {
    set: (v: number) => { top = v; fireEvent.scroll(list); },
    get: () => top,
  };
}

describe("WalkChatBox scrolling", () => {
  const base = [msg(1, "user", "hi"), msg(2, "app", "hello")];
  const setup = (messages: Msg[]) => {
    const view = render(<WalkChatBox chat={chatWith({ messages })} lang="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const list = screen.getByRole("list");
    return { view, list };
  };
  const again = (view: ReturnType<typeof render>, messages: Msg[]) =>
    view.rerender(<WalkChatBox chat={chatWith({ messages })} lang="en" />);

  it("does not pull the list down on a re-render with the same messages", () => {
    const { view, list } = setup(base);
    const s = fakeScroll(list, 0);
    s.set(0);
    again(view, [...base]);
    again(view, [...base]);
    expect(s.get()).toBe(0);
  });

  it("leaves a walker who scrolled up where they are when an app message arrives", () => {
    const { view, list } = setup(base);
    const s = fakeScroll(list, 0);
    s.set(0);
    again(view, [...base, msg(3, "app", "more")]);
    expect(s.get()).toBe(0);
  });

  it("follows a new message when the walker is at the bottom", () => {
    const { view, list } = setup(base);
    const s = fakeScroll(list, 440);
    s.set(440);
    again(view, [...base, msg(3, "app", "more")]);
    expect(s.get()).toBe(600);
  });

  it("always scrolls down for the walker's own new message", () => {
    const { view, list } = setup(base);
    const s = fakeScroll(list, 0);
    s.set(0);
    again(view, [...base, msg(3, "user", "mine")]);
    expect(s.get()).toBe(600);
  });

  it("follows a reply that replaces the thinking line (same id, new text) while at the bottom", () => {
    const { view, list } = setup([msg(1, "user", "hi"), msg(2, "app", "Thinking…")]);
    const s = fakeScroll(list, 440);
    s.set(440);
    again(view, [msg(1, "user", "hi"), msg(2, "app", "A much longer reply")]);
    expect(s.get()).toBe(600);
  });

  it("keeps a swipe on the list from scrolling the sheet behind it", () => {
    const { list } = setup(base);
    expect(list.className).toContain("overscroll-contain");
    expect(list.className).toContain("touch-pan-y");
  });

  it("offers a round down button when a reply lands while the walker reads up, and it jumps to the newest", () => {
    const { view, list } = setup(base);
    const s = fakeScroll(list, 0);
    s.set(0);
    expect(screen.queryByRole("button", { name: "Newest messages" })).toBeNull();
    again(view, [...base, msg(3, "app", "more")]);
    fireEvent.click(screen.getByRole("button", { name: "Newest messages" }));
    expect(s.get()).toBe(600);
    expect(screen.queryByRole("button", { name: "Newest messages" })).toBeNull();
  });

  it("has no down button when the walker is at the bottom", () => {
    const { view, list } = setup(base);
    const s = fakeScroll(list, 440);
    s.set(440);
    again(view, [...base, msg(3, "app", "more")]);
    expect(screen.queryByRole("button", { name: "Newest messages" })).toBeNull();
  });
});
