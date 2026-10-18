import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkChatBox } from "@/components/walk/WalkChatBox";
import { WalkHud } from "@/components/walk/WalkHud";
import type { WalkChat } from "@/lib/hooks/useWalkChat";

afterEach(cleanup);

function chatWith(over: Partial<WalkChat> = {}): WalkChat {
  return { messages: [], pending: false, llmUsed: 0, send: vi.fn(), runAction: vi.fn(), reset: vi.fn(), ...over };
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

  it("renders in the HUD between the alert and the pills", () => {
    render(
      <WalkHud alert={null} stats={null} onDetails={vi.fn()} onEndWalk={vi.fn()} chat={<WalkChatBox chat={chatWith()} lang="he" />} />,
    );
    expect(screen.getByRole("button", { name: "שאלו" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /End walk/i })).toBeTruthy();
  });
});
