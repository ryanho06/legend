import { describe, expect, test } from "vitest";
import type { ChronosIntent } from "../types";
import { matchChronos } from "./chronos";

const intents: ChronosIntent[] = [
  {
    triggers: [
      [["culture", "cultures", "sensitivity", "sensitivities", "micro"]],
      [["organism", "coli"]],
      [["antibiotic", "antibiotics", "abx"], ["which", "narrow", "de-escalate", "change"]],
    ],
    targetAt: 208800,
    reply: "Cultures back: E. coli, sensitivities attached.",
  },
];

describe("matchChronos", () => {
  test("matches a single-word culture query", () => {
    expect(matchChronos("any word on the cultures?", intents)?.targetAt).toBe(208800);
  });
  test("matches the organism synonym", () => {
    expect(matchChronos("has the organism been identified", intents)?.targetAt).toBe(208800);
  });
  test("matches the two-group antibiotic intent", () => {
    expect(matchChronos("which antibiotic should we narrow to", intents)?.targetAt).toBe(208800);
  });
  test("does not match an unrelated query", () => {
    expect(matchChronos("can I have a coffee", intents)).toBeNull();
  });
  test("requires both groups of the antibiotic trigger", () => {
    // "antibiotics" alone (no which/narrow/de-escalate/change) must not match via that trigger.
    expect(matchChronos("continue the antibiotics", intents)).toBeNull();
  });
  test("returns the reply on a match", () => {
    expect(matchChronos("cultures?", intents)?.reply).toContain("E. coli");
  });
});
