# STATUS: Legend

> Living state. Update at the end of every working block so a fresh session can resume from here after `/clear`.

Last updated: 2026-07-05
Branch / worktree: main
Latest session commit range: 47ee20b..54a1ea1 (tab restructure + doc reconcile)
Prior session: cce42a4..dc9f29b (note-feedback loop + prototype build)

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
- Tab restructure (5efaed9, 54a1ea1): land on Notes; Wrap-Up removed from the main tab
  strip and moved to a floating, resizable "Performance" dock (WrapUpDock, opens on
  Sign); "Results" tab relabeled "Labs & Tests" + redundant Labs chart sub-tab removed
  (LabsPanel.tsx deleted); shared LetterPage extracted so note AND report previews use
  the same Epic stationery; preview tabs narrower + freeze-on-close.
- Handoff doc reconciles (this session + prior): README, SPEC, CLAUDE.md match the code.

## In flight
- Nothing mid-change; the prototype loop is demo-ready.

## Next concrete step
- Deploy a live demo to Cloudflare Pages. It's a static Vite SPA (no backend; all
  state is localStorage), so: build with `npm run build` (outputs `dist/`), then
  Cloudflare Pages with build command `npm run build`, output dir `dist`. Add an SPA
  fallback (redirect `/*` -> `/index.html`) if deep links 404. No env vars or secrets.
  A prior "deploy docs (Cloudflare Pages)" commit was made then dropped in an
  accidental reset (see prior handoff); re-author fresh.

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
- Note feedback is a floating "Performance" dock (`WrapUpDock`), NOT a main tab; it
  opens on Sign. If a doc or comment says "Wrap-Up tab", it's stale.
