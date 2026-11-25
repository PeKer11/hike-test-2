import { describe, expect, it } from "vitest";

import { editCommand } from "@/lib/walk/chat/edit-command";
import { ADD_WORDS_HE, parseIntent } from "@/lib/walk/chat/intent";

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

  it("every Hebrew add verb, with and without a ו- prefix, is both an add command and a longer intent", () => {
    expect(ADD_WORDS_HE.length).toBeGreaterThanOrEqual(8);
    for (const verb of ADD_WORDS_HE) {
      for (const sentence of [`${verb} אטרקציה`, `ו${verb} אטרקציה`, `בעצם בא לי עד חצי ק״מ רדיוס ו${verb} אטרקציה`]) {
        expect(editCommand(sentence), sentence).toBe("add");
        expect(parseIntent(sentence, []).intent, sentence).toBe("longer");
      }
    }
  });

  it("the sentence from the phone parses as longer, not unknown", () => {
    expect(parseIntent("בעצם בא לי עד חצי ק״מ רדיוס ותוסיף אטרקציה", []).intent).toBe("longer");
    expect(parseIntent("בעצם בא לי עד חצי ק״מ רדיוס ותוסיפי אטרקציה", []).intent).toBe("longer");
  });
});
