import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";

afterEach(cleanup);

// Feedback round 2026-11-22, item 8: privacy is on the app's type and rows, in a 720px column.
describe("the privacy page", () => {
  it("keeps its draft note and every section, on the app's rows and type", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("note").textContent).toBe("Draft for legal review. Not final.");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Privacy");
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("font-app-serif");
    const bars = screen.getAllByRole("heading", { level: 2 });
    expect(bars).toHaveLength(8);
    for (const bar of bars) expect(bar.className).toContain("tk-bar");
  });

  it("is the app's type and a 720px column, not the old Heebo card", () => {
    render(<PrivacyPage />);
    expect(document.querySelector("main")!.className).toContain("font-app-sans");
    expect(document.querySelector("main")!.className).not.toContain("font-brand");
    expect(document.querySelector("main > div")!.className).toContain("max-w-[720px]");
  });
});
