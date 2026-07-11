import type { RoundSpec } from "../types";

/**
 * Round-schedule helpers for the action-keyed sim-clock (Plan 4, spec §7). Pure;
 * no React, no server. `rounds` is the case's authored schedule (ascending `at`);
 * these tolerate any order and an empty schedule (a static case), returning null.
 */

/** The latest round whose sim-time has arrived (`at <= simNow`), or null. */
export function currentRound(rounds: RoundSpec[], simNow: number): RoundSpec | null {
  let found: RoundSpec | null = null;
  for (const round of rounds) {
    if (round.at <= simNow && (found === null || round.at > found.at)) found = round;
  }
  return found;
}

/** The smallest round `at` strictly greater than `simNow`, or null if none remains. */
export function nextRoundAt(rounds: RoundSpec[], simNow: number): number | null {
  let next: number | null = null;
  for (const round of rounds) {
    if (round.at > simNow && (next === null || round.at < next)) next = round.at;
  }
  return next;
}
