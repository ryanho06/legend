import type { CaseRubric, RubricItem, RubricResult, RubricTrigger } from "../types";
import { wordCount } from "./noteText";

/** Deterministic rubric scoring of a plain-text note. Pure; no React. */

const FUZZY_MIN_LENGTH = 5;
const WORDS_PER_PENALTY_POINT = 25;
const MAX_WORD_PENALTY = 10;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True when the strings are equal or one single-character edit apart. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  let i = 0;
  let j = 0;
  let edited = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (edited) return false;
    edited = true;
    if (short.length === long.length) i += 1; // substitution
    j += 1; // insertion into the longer string (or the substituted char)
  }
  return true; // any trailing char in `long` is the single allowed edit
}

/** Exact for short tokens; one typo allowed for tokens of 5+ characters. */
function tokenMatches(noteToken: string, phraseToken: string): boolean {
  if (phraseToken.length < FUZZY_MIN_LENGTH) return noteToken === phraseToken;
  return withinOneEdit(noteToken, phraseToken);
}

/** The phrase's tokens must appear consecutively in the note. */
function phraseMatches(noteTokens: string[], phrase: string): boolean {
  const phraseTokens = tokenize(phrase);
  if (phraseTokens.length === 0) return false;
  for (let start = 0; start + phraseTokens.length <= noteTokens.length; start += 1) {
    if (phraseTokens.every((token, k) => tokenMatches(noteTokens[start + k], token))) {
      return true;
    }
  }
  return false;
}

function triggerMatches(noteTokens: string[], trigger: RubricTrigger): boolean {
  return trigger.every((group) => group.some((phrase) => phraseMatches(noteTokens, phrase)));
}

function itemMatches(noteTokens: string[], item: RubricItem): boolean {
  return item.triggers.some((trigger) => triggerMatches(noteTokens, trigger));
}

/**
 * True if the text satisfies ANY of the given triggers (rubric matching rules:
 * AND across a trigger's groups, OR of synonyms within a group, fuzzy on 5+
 * letter tokens). Exported so the chronos matcher reuses one string engine.
 */
export function anyTriggerMatches(text: string, triggers: RubricTrigger[]): boolean {
  const noteTokens = tokenize(text);
  return triggers.some((trigger) => triggerMatches(noteTokens, trigger));
}

/** A section counts only when some line starts with one of its header synonyms. */
function findSection(lineTokens: string[][], group: string[]): string | null {
  for (const synonym of group) {
    const headerTokens = tokenize(synonym);
    const found = lineTokens.some(
      (line) =>
        headerTokens.length <= line.length &&
        headerTokens.every((token, k) => tokenMatches(line[k], token)),
    );
    if (found) return synonym;
  }
  return null;
}

export function scoreNote(text: string, rubric: CaseRubric): RubricResult {
  const noteTokens = tokenize(text);
  const lineTokens = text.split("\n").map(tokenize);

  const items = rubric.items.map((item) => ({
    item,
    matched: itemMatches(noteTokens, item),
  }));

  const earned = items.reduce((sum, r) => sum + (r.matched ? r.item.weight : 0), 0);
  const possible = items.reduce((sum, r) => sum + r.item.weight, 0);
  const criticalMisses = items
    .filter((r) => r.item.critical && !r.matched)
    .map((r) => r.item);

  const words = wordCount(text);
  const overshoot = words - rubric.wordBand.max;
  const wordPenalty =
    overshoot > 0
      ? Math.min(MAX_WORD_PENALTY, Math.ceil(overshoot / WORDS_PER_PENALTY_POINT))
      : 0;

  const sectionsFound = rubric.sections
    .map((group) => findSection(lineTokens, group))
    .filter((synonym): synonym is string => synonym !== null);

  const pdqi: RubricResult["pdqi"] = {};
  for (const { item, matched } of items) {
    for (const dimension of item.pdqi) {
      const entry = (pdqi[dimension] ??= { matched: 0, total: 0 });
      entry.total += 1;
      if (matched) entry.matched += 1;
    }
  }

  return {
    items,
    earned,
    possible,
    criticalMisses,
    words,
    wordPenalty,
    sectionsFound,
    sectionsExpected: rubric.sections.length,
    pdqi,
    total: Math.max(0, earned - wordPenalty),
  };
}
