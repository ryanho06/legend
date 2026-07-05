# STATUS: Legend

> Living state. Update at the end of every working block so a fresh session can resume from here after `/clear`.

Last updated: 2026-07-05
Branch / worktree: main
Session commit range: cce42a4..dc9f29b (9 commits)

## Done
- Restored the lost Chart Review + Results work from Claude Code file-history after
  an accidental hard reset, committed (71d79a9). Recovery recipe in project memory
  ([[claude-file-history-recovery]]).
- Note-feedback loop, all 3 SPEC phases shipped + browser-verified: scoring engine
  (626be84), cholangitis001 rubric + model note (ca57026), Wrap-Up UI (4a1efe7).
- Usable prototype (713ed9f): sign-in gate, Sign publishes a user note and opens
  Wrap-Up feedback, Pend files Incomplete, notes text search / urgent marks /
  multi-tab preview.
- Reading polish (1306d4f): letter-page note rendering + reflow, pixel-locked notes
  list, slim sidebar, sign-out via the user bubble.
- Demo polish (dc9f29b): removed unused global search, deletable user notes with an
  "always ignore" confirm, "Mount Verdant Hospital" rename, equal-width preview tabs.
- Handoff: reconciled README + SPEC + CLAUDE.md against the code (this session).

## In flight
- Nothing. Prototype loop is demo-ready for the hackathon.

## Ideas / later
- Persist open (unsigned) drafts; only signed/pended notes survive reload today.
- LLM judge layer for paraphrase-heavy rubric items (schema already judge-agnostic).
- SmartText note-editing helper (next editor feature after the demo).
- Second case: once one case bundles documents.ts + encounters.ts + rubric.ts, new
  cases are data-only.
- Epic-inspired backlog: hover previews, "new since last viewed", AI chart summary.

## Blocked / decisions needed
- None.

## Notes for next session
- Verify target: `npm test` (43 tests, 5 files), `npx tsc -b`, `npm run lint`.
  Lint carries ONE pre-existing error in StickyNotePopup.tsx
  (react-hooks/immutability) that predates all this work — do not "fix" as a drive-by.
- Unsigned note drafts are in-memory only (App.tsx useState); sign or pend before a
  reload or they're lost. Signed/pended user notes persist in localStorage.
- The editor body is contentEditable HTML; scoring/reflow go through the pure libs
  (`noteText.ts`, `reflow.ts`), which use string transforms not DOMParser so node
  tests and the browser agree.
- NEVER leave verified work uncommitted (the June work sat 18 days and a hard reset
  destroyed it).
- Nothing pushed this session; `git push` needs explicit approval.
