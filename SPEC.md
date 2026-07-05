# Spec: Note feedback loop (Wrap-up)

Status: DONE. All three phases shipped and browser-verified (commits 626be84,
ca57026, 4a1efe7). One deviation from the plan below: plain-text extraction uses a
string transform (`src/lib/noteText.ts`) rather than DOMParser, so node tests and the
browser agree. Feedback lives in the Wrap-Up tab; Sign both publishes the note and
opens the report. The remaining roadmap items (LLM judge, more cases) are in README.

Previous spec (Chart Review table redesign + encounter receipts): DONE, both phases
verified in browser. Its decisions are folded into CLAUDE.md (Architecture, Gotchas).

The plan below is kept as the design record of what shipped.

## Goal

Close the practice loop: read chart, write note, submit, get scored feedback.
One case with a complete loop is a trainer; without it the app is a reading exercise.
This feature also defines what a "case" must contain (rubric + model note), so it
gates adding more cases.

## Decisions (locked)

- **Rubric checklist, not note similarity.** Score against per-case rubric items
  (required findings, safety catches), never fuzzy-distance to a model note.
  Literature: checklist/rubric assessment grounded in the case beats holistic
  similarity, and ungrounded feedback misleads learners.
- **Model note is a reveal, not a target.** Shown side by side with the student
  note only after scoring.
- **Deterministic client-side matcher first.** No backend, no API keys, reproducible.
  The rubric schema is judge-agnostic so a Claude-based judge can later score
  paraphrase-heavy items per rubric item without a rewrite (explicitly out of scope
  for this spec).
- **PDQI-9 framing, honestly scoped.** Each rubric item tags the PDQI-9 dimensions
  it evidences (official names: up-to-date, accurate, thorough, useful, organized,
  comprehensible, succinct, synthesized, internally consistent). v1 operationalizes
  three deterministically: thorough (checklist coverage), organized (section
  detection), succinct (word-count band). The feedback report says exactly that;
  do not claim to measure the judgment-heavy dimensions.
- **Verbosity is penalized, never rewarded.** Note bloat is a real documentation
  failure; a per-note-type word band with a linear penalty beyond `max`, capped.
- **Testing:** add `vitest` (dev dependency) for the pure scoring libs. Tests first
  for the matcher.

## Data model

`src/types.ts` additions:

```ts
/** OR over triggers; a trigger is AND over groups; a group is OR over synonyms. */
export type RubricTrigger = string[][];

export type RubricItem = {
  id: string;
  /** Shown in feedback, e.g. "Recognizes the obstructive LFT pattern". */
  label: string;
  category: "findings" | "assessment" | "plan" | "safety";
  /** Points awarded when matched. */
  weight: number;
  /** Missed critical item = "unsafe omission" banner, not just lost points. */
  critical?: boolean;
  triggers: RubricTrigger[];
  /** Teaching text shown after scoring (why it matters, where it was in the chart). */
  explanation: string;
  /** PDQI-9 dimensions this item evidences. */
  pdqi: PdqiDimension[];
};

export type CaseRubric = {
  caseId: string;
  noteType: string;              // which draft type this rubric applies to (v1: ward round / progress note)
  items: RubricItem[];
  wordBand: { target: number; max: number };
  /** Section headers whose presence scores "organized" (e.g. S/O/A/P or Impression/Plan). */
  sections: string[][];          // OR within a group, all groups expected
  modelNote: string;             // consultant-standard note, plain text
};
```

Per-case content lives in `src/data/patients/cholangitis001/rubric.ts`.

## Scoring libs (pure, unit-tested)

- `src/lib/noteText.ts`: contentEditable HTML -> plain text (DOMParser), word count.
- `src/lib/rubric.ts`: `scoreNote(text: string, rubric: CaseRubric): RubricResult`.
  - Normalize: lowercase, strip punctuation, collapse whitespace.
  - Match: phrase = token sequence; per-token exact for short tokens, Levenshtein <= 1
    for tokens of 5+ chars (typo tolerance). Item matches if any trigger matches;
    trigger matches if every group has a hit.
  - Result: per-item matched/missed, coverage score, critical misses, word count vs
    band with penalty, sections found, per-PDQI-dimension rollup, total.

No React imports in either lib.

## UI (Wrap-up tab)

`MainTab` already has `"wrapup"`; replace its `PlaceholderModule` with
`src/components/wrapup/WrapUpModule.tsx`:

1. Pick one of the open note drafts (reuse `NoteDraft[]` state lifted in `App.tsx`);
   empty state points the user at the Notes tab.
2. "Submit for feedback" runs `scoreNote` and renders `FeedbackReport`:
   - Score header + unsafe-omission banner when any `critical` item missed.
   - Matched/missed items grouped by category, each with its `explanation`.
   - Conciseness meter (words vs band) and sections found.
   - PDQI-9 dimension chips with the honest-scope caption.
   - Model note reveal, side by side with the submitted note.
   - Keep the standard synthetic-data disclaimer in the report header.
3. Persist the last attempt per case with `usePersistentState`
   (drafts themselves are currently in-memory; that stays as is for v1).

## cholangitis001 rubric content (author in Phase 2, against the actual case data)

Roughly 12 items. Must include the case's teaching spine; exact wording and triggers
get authored against `documents.ts` / `encounters.ts`, not invented:

- Safety (critical): penicillin allergy vs the prescribed antibiotic (the catch);
  hold metformin in sepsis.
- Findings: atypical epigastric (not RUQ) pain; fever/rigors + jaundice; obstructive
  LFT pattern; lipase only mildly raised (against pancreatitis); US dilated CBD with
  obstructing stone; cultures pending, no growth at 48h.
- Assessment: acute cholangitis, TG18 grade stated; sepsis recognized.
- Plan: urgent ERCP; antibiotics + fluids; cultures/lactate chase; escalation status.

Do not change existing clinical wording in case data; the rubric references it.

## Build order

1. **Phase 1: engine.** Types, `noteText.ts`, `rubric.ts`, vitest setup, tests green
   (matcher edge cases: synonyms, typos, AND-groups, word band, sections).
2. **Phase 2: content.** `rubric.ts` for cholangitis001 + model note.
3. **Phase 3: UI.** WrapUpModule + FeedbackReport + persistence; verify in browser
   (submit a good note, a dangerous note missing the allergy catch, a bloated note).

Each phase lands with `tsc -b` + `npm run lint` green before the next starts.

## Constraints (carried)

- `MainTab`/`ChartTab` stay in sync with `tabs.ts`.
- One stylesheet (`src/App.css`); no CSS modules.
- Preserve the synthetic-data disclaimer everywhere a report renders.
- No backend; all case data typed and static.
