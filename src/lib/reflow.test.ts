import { describe, expect, test } from "vitest";
import { reflowNoteBody } from "./reflow";

describe("reflowNoteBody", () => {
  test("merges hard-wrapped lines within a paragraph", () => {
    const body = "constant CENTRAL\nEPIGASTRIC pain radiating to the back, worse\nafter meals.";
    expect(reflowNoteBody(body)).toBe(
      "constant CENTRAL EPIGASTRIC pain radiating to the back, worse after meals.",
    );
  });

  test("keeps blank lines as paragraph breaks", () => {
    const body = "First paragraph ends\nhere.\n\nSecond paragraph starts here.";
    expect(reflowNoteBody(body)).toBe(
      "First paragraph ends here.\n\nSecond paragraph starts here.",
    );
  });

  test("keeps dash and numbered list items on their own lines", () => {
    const body = "PLAN:\n1. Sepsis six. Blood cultures\nsent.\n- Metformin held";
    expect(reflowNoteBody(body)).toBe(
      "PLAN:\n1. Sepsis six. Blood cultures sent.\n- Metformin held",
    );
  });

  test("merges wrapped continuations of list items and trims their indent", () => {
    const body = "- Metformin 500 mg PO BD (recommend\n  HOLD during this acute illness).";
    expect(reflowNoteBody(body)).toBe(
      "- Metformin 500 mg PO BD (recommend HOLD during this acute illness).",
    );
  });

  test("keeps all-caps headings and Label: lines", () => {
    const body = "HISTORY OF PRESENT ILLNESS:\nAmelia Hart is unwell.\nObs: T 38.6, HR 112.";
    expect(reflowNoteBody(body)).toBe(
      "HISTORY OF PRESENT ILLNESS:\nAmelia Hart is unwell.\nObs: T 38.6, HR 112.",
    );
  });

  test("keeps timeline rows starting with a clock time", () => {
    const body = "CARE TIMELINE:\n05:50  Arrived in ED\n06:40  Seen by ED provider";
    expect(reflowNoteBody(body)).toBe(body);
  });

  test("keeps short capitalized standalone lines (user section headers, signatures)", () => {
    const body = "Impression\nAcute cholangitis with sepsis.\nPlan\nUrgent ERCP today.";
    expect(reflowNoteBody(body)).toBe(body);
    const letter = "Kind regards,\nDr R. Shah";
    expect(reflowNoteBody(letter)).toBe(letter);
  });

  test("keeps a break after a line that ends with a colon", () => {
    const body = "ALLERGIES:\n- Penicillin — rash.";
    expect(reflowNoteBody(body)).toBe(body);
  });

  test("keeps bracketed status lines", () => {
    const body = "Tolerating sips.\n[Draft — not yet signed.]";
    expect(reflowNoteBody(body)).toBe(body);
  });
});
