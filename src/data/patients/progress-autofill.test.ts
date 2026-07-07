import { describe, expect, test } from "vitest";
import { caseRegistry } from "./index";
import { SMART_PHRASES } from "../../lib/smarttext";
import { htmlToPlainText } from "../../lib/noteText";
import { scoreNote } from "../../lib/rubric";

/**
 * Scoring-integrity guard for every registered case: the PROGRESS SmartText
 * template auto-embeds real vitals and lab lines, and that text alone must
 * never satisfy a rubric item — points are for interpretation, not for data
 * the template pasted in. If this fails for a new case, tighten the offending
 * trigger with an interpretive word (see the trigger-hygiene note in
 * CASE_AUTHORING.md) rather than weakening this test.
 */
describe("PROGRESS auto-text scores zero rubric items", () => {
  const progress = SMART_PHRASES.find((p) => p.id === "PROGRESS")!;
  for (const bundle of caseRegistry) {
    test(bundle.id, () => {
      const text = htmlToPlainText(progress.build(bundle, "01/01/2026")).replace(
        /\*\*\*/g,
        "",
      );
      const matched = scoreNote(text, bundle.rubric)
        .items.filter((r) => r.matched)
        .map((r) => `${r.item.id}: ${r.item.label}`);
      expect(matched).toEqual([]);
    });
  }
});
