import { describe, expect, test } from "vitest";
import type { RoundSpec } from "../types";
import { currentRound, nextRoundAt } from "./rounds";

const rounds: RoundSpec[] = [
  { at: 0, encounterId: "enc-admission", label: "Day 1" },
  { at: 54000, encounterId: "enc-d2", label: "Day 2", npcNoteId: "npc-d2" },
  { at: 140400, encounterId: "enc-d3", label: "Day 3", npcNoteId: "npc-d3" },
];

describe("currentRound", () => {
  test("returns the round at exactly simNow", () => {
    expect(currentRound(rounds, 54000)?.encounterId).toBe("enc-d2");
  });
  test("returns the latest round at or before simNow", () => {
    expect(currentRound(rounds, 60000)?.encounterId).toBe("enc-d2");
  });
  test("returns round 0 at simNow 0", () => {
    expect(currentRound(rounds, 0)?.encounterId).toBe("enc-admission");
  });
  test("returns null for an empty schedule", () => {
    expect(currentRound([], 100)).toBeNull();
  });
});

describe("nextRoundAt", () => {
  test("returns the next round strictly after simNow", () => {
    expect(nextRoundAt(rounds, 0)).toBe(54000);
    expect(nextRoundAt(rounds, 54000)).toBe(140400);
  });
  test("returns null at or past the last round", () => {
    expect(nextRoundAt(rounds, 140400)).toBeNull();
    expect(nextRoundAt(rounds, 200000)).toBeNull();
  });
  test("returns null for an empty schedule", () => {
    expect(nextRoundAt([], 0)).toBeNull();
  });
});
