# STATUS: Legend

> Living state. Update at the end of every working block so a fresh session can resume from here after `/clear`.

Last updated: 2026-07-04
Branch / worktree: main

## Done
- Chart Review redesign + encounter receipts + Results module: recovered from
  Claude Code file-history after an accidental hard reset, verified green,
  committed as 71d79a9.
- Note-feedback loop specced in SPEC.md (rubric checklist scoring, PDQI-9 framing,
  deterministic matcher first, LLM judge later).
- README roadmap section added (cites PDQI-9 / Stetson 2012 for the hackathon story).
- Phase 1 (scoring engine): rubric types in types.ts, src/lib/noteText.ts +
  src/lib/rubric.ts, vitest wired up (`npm test`), 22 tests green, TDD (watched red
  first). tsc green; lint has only the pre-existing StickyNotePopup error.

- Phase 2 (rubric content): 14 weighted items + model note in
  src/data/patients/cholangitis001/rubric.ts; content tests pin the model note to
  its own rubric and a dangerous note to both safety catches.
- Phase 3 (Wrap-up UI): WrapUpModule + FeedbackReport wired into the wrapup tab.
  Browser-verified end to end: draft -> submit -> unsafe-omission banner, category
  hits/misses, conciseness, PDQI-9 chips, model-note reveal; last attempt persists
  in localStorage. Found + fixed a real htmlToPlainText bug in the process (leading
  unwrapped text node merged into the next line, killing section detection).

## In flight
- Nothing. Feature complete through SPEC Phase 3.

## Ideas / later
- Persist open note drafts (currently in-memory; a page reload drops them).
- LLM judge layer for paraphrase-heavy rubric items (schema already judge-agnostic).
- Second case once the hackathon story is set.

## Blocked / decisions needed
- None.

## Notes for next session
- NEVER leave verified work uncommitted. The June work sat 18 days uncommitted and a
  hard reset destroyed it; recovery recipe is in project memory
  (claude-file-history-recovery).
- Wrap-up tab already exists in MainTab ("wrapup") rendering PlaceholderModule; the
  feedback UI replaces that in Phase 3.
- Note drafts are in-memory only (App.tsx useState); the editor body is contentEditable
  HTML, so scoring needs the noteText.ts plain-text extraction.
- Pre-existing lint error in StickyNotePopup.tsx (react-hooks/immutability) predates
  all of this; do not "fix" it as a drive-by.
