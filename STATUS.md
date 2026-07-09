# STATUS: Legend

> Living state. Update at the end of every working block so a fresh session can resume from here after `/clear`.

Last updated: 2026-07-09
Branch / worktree: main
Latest session: backend research + plan for user accounts (see "Next concrete step"
and "Blocked / decisions needed"). Prior sessions: hierarchy system + case fleet
(68e1f64..8574cee), multi-case foundation (8d694ea registry, dec89c0 patient
switching, CASE_AUTHORING.md), Cloudflare deploy + README + mobile gate
(3b04aeb..70c80ca), tab restructure (47ee20b..54a1ea1), note feedback
(cce42a4..dc9f29b).

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
- Live demo deployed to Cloudflare **Workers static assets** (not Pages; Pages is legacy
  for new projects): https://legend.ryanho06.workers.dev. Config in `wrangler.jsonc`
  (`not_found_handling: "single-page-application"` handles deep links). Redeploy:
  `npm run build` then `npx wrangler deploy`. Auth via `npx wrangler login`.
- Mobile gate (70c80ca): narrow-portrait viewports get a "rotate or use a laptop"
  card (RotateGate); sign-in placeholders no longer suggest the patient's own name.
- Multi-case foundation, all 3 SPEC phases shipped + browser-verified:
  - Registry refactor (8d694ea): patient.json/summary/bloods moved into the case
    folder; `CaseBundle` registry (`data/patients/index.ts`); `CaseContext`/`useCase`
    replaces static case imports; `patient.caseId` renamed `mrn`.
  - Patient switching (dec89c0): Epic-style chart tabs below the top bar
    (PatientTabBar, freeze-on-close), full-screen Patient Lists activity grouped by
    specialty (PatientListPage, hamburger opens it, last-tab-close returns to it),
    per-case `CaseUiState` map so drafts/tabs survive switches, sign-out sweeps all
    `legend*` keys except the delete-confirm preference.
  - CASE_AUTHORING.md: the Cowork-facing contract for generating new cases
    (folder layout, type rules, rubric + required rubric.test.ts, registry hookup,
    acceptance checklist).
- Hierarchy system + editor upgrades (68e1f64..8574cee): fy/st3/consultant grades
  at sign-in, per-case task + minGrade, -1000 overreach panel on signing above
  grade, patient list sorted easiest-first with Hierarchy column/filter; SmartText
  bundle-aware builds (PROGRESS embeds vitals+labs, new PTWR shell); edit/addendum
  on owned notes; rubric trigger hygiene (PROGRESS auto-text can never score,
  registry-wide guard test); README rewritten for judges.
- Case fleet: 16 case folders exist (cholangitis001 reference + 15 generated).
  Case generation is DONE for now — do not queue more from CASE_BACKLOG.md.
- Context shift (2026-07-09): the hackathon application did NOT come through.
  Judges no longer matter; optimize for real users and the product roadmap, not
  a demo. Memory [[legend-hackathon-context]] updated to match.

## In flight
- `src/data/patients/hyponatraemia001/` is a deliberately uncommitted partial case
  (bloods.ts + patient.json only, NOT in the registry, so the build is unaffected).
  Ryan's call (2026-07-09): leave it on disk; CASE_BACKLOG.md now carries an
  IN PROGRESS note telling the next case-generation run to resume it.
- .gitignore + CLAUDE.md carry uncommitted modifications not made in this session;
  .graphifyignore untracked. Left alone per Ryan (commit scope was CASE_BACKLOG.md
  + session doc updates only).

## Next concrete step
Pivot from content to backend: user accounts -> server persistence -> Patient
Message + LLM attending feedback. Researched 2026-07-09 (Cloudflare-native, primary
sources); recommended stack:
- Worker `main` script + Hono router on the existing static-assets deploy:
  `wrangler.jsonc` gains `"main"` + `assets.run_worker_first: ["/api/*"]`
  (documented SPA-with-API recipe; `not_found_handling` unchanged).
- better-auth >= 1.5 (native D1 support: `database: env.DB`, no ORM adapter) +
  Google social login + the anonymous plugin (guest sessions keep first-use
  friction at zero; `onLinkAccount` migrates guest work into the real account).
  No email/password: bcrypt/argon2 unusable in workerd, PBKDF2 capped at 100k
  iterations; delegating password proof to Google is the accepted Workers
  pattern. Official docs cover the whole stack (better-auth installation page
  has the Workers `nodejs_compat` flag; 1.5 blog documents the D1 binding;
  Hono has an official "Better Auth on Cloudflare" example). Known bug: skip
  `cookieCache` + KV secondary storage (logout bug, open as of Feb 2026).
- D1 for everything (users, sessions, notes, attempts, messages). Durable Objects
  only if Patient Message ever goes real-time/WebSocket.
- Stay on the Workers FREE tier (Ryan 2026-07-09; working model first). This is
  fine because Google-only auth means no CPU-heavy hashing, and an LLM proxy is
  I/O-bound (awaiting Anthropic doesn't consume the 10ms CPU budget). D1 free
  tier (500MB/db, ~5M row reads + 100k row writes per day) dwarfs the workload.
  Revisit Paid only if email/password auth or heavy compute ever lands.
- Patient Message scope (Ryan 2026-07-09): one chat channel per patient. All
  HCPs involved in that patient (note authors, nurse, doctors, pharmacist,
  microbiologist) are LLM-played personas grounded in the case bundle; the
  trainee asks quick MDT questions on the channel (e.g. "spiking 39, switch to
  oral vanc?") and gets in-character, case-accurate replies/pushback (e.g.
  micro: wound culture is gram-negative only, blood cultures clear — continue
  metro + cipro IV). Async request/response, D1 rows, no real-time transport.
- Phases: (0) persist unsigned drafts to localStorage now, ~1-2h, no accounts
  needed; (1) Worker+Hono foundation ~0.5d; (2) better-auth accounts ~1.5-2d;
  (3) notes/attempts persistence API + one-shot `POST /api/import` localStorage
  migration ~1.5-2d; (4) Patient Message channel + authenticated LLM proxy
  route. Full PLAN.md to be written per-phase.

## Ideas / later
- LLM judge layer for paraphrase-heavy rubric items (schema already judge-agnostic).
- Epic-inspired backlog: hover previews, "new since last viewed", AI chart summary.
- Remaining CASE_BACKLOG.md seeds (parked; resume after the backend pivot).

## Blocked / decisions needed
- None. All four backend-pivot decisions landed 2026-07-09: (a) Google-only +
  guest mode confirmed; (b) Workers free tier until a working model exists;
  (c) Patient Message = per-patient MDT chat channel with LLM HCP personas (see
  scope above); (d) commit CASE_BACKLOG.md only, hyponatraemia001 stays on disk
  with a resume note in the backlog.

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
