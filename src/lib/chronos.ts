import type { ChronosIntent } from "../types";
import { anyTriggerMatches } from "./rubric";

/**
 * Deterministic chronos matcher (spec §8): map a trainee's typed phrase to a
 * pre-authored reveal the case declares, reusing the rubric string engine. No
 * LLM. Returns the first matching intent's target sim-time + reply, or null.
 * Never fabricates data: `targetAt` only names an authored event's `at`, which
 * the reveal rail materialises when the clock reaches it.
 */
export type ChronosMatch = { targetAt: number; reply: string };

export function matchChronos(text: string, intents: ChronosIntent[]): ChronosMatch | null {
  for (const intent of intents) {
    if (anyTriggerMatches(text, intent.triggers)) {
      return { targetAt: intent.targetAt, reply: intent.reply };
    }
  }
  return null;
}
