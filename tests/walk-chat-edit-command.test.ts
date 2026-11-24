import { describe, expect, it } from "vitest";

import { editCommand } from "@/lib/walk/chat/edit-command";

describe("editCommand", () => {
  it("add commands", () => {
    for (const t of ["תוסיף שני מקומות", "תוסיפו לי קפה", "תכניס מקום יפה", "Add two places", "please include a park", "put a cafe on the way"])
      expect(editCommand(t), t).toBe("add");
  });
  it("drop commands", () => {
    for (const t of ["תוריד את המוזיאון", "תדלג על העצירה הראשונה", "remove the museum", "skip the next one"])
      expect(editCommand(t), t).toBe("drop");
  });
  it("questions, small talk and mixed commands are not commands", () => {
    for (const t of ["מה יש פה יפה?", "what is nice nearby?", "תוסיף קפה ותוריד את המוזיאון", "is there water?", "address book"])
      expect(editCommand(t), t).toBeNull();
  });
});
