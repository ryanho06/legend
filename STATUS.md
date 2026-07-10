# STATUS: Legend

> Living state. Update at the end of every working block so a fresh session can resume from here after `/clear`.

Last updated: 2026-07-10
Branch / worktree: main
Latest session: Phase 3 server-side notes/attempts BUILT and browser-verified
(990d551..93ab9ea: trainee notes, addenda, and wrap-up attempts moved from
localStorage to D1 via a session-gated Hono router; see Done entry below).
Same day, earlier: Phase 2 real accounts SHIPPED (7ee4b06..5d8b502: better-auth
at /api/auth, anonymous guests + Google, persona on the user table, D1
migrations local+remote, session-gated SPA; secrets in prod; live
/api/auth/ok + anonymous sign-in verified). Same day, earlier still: Phase 1
foundation shipped (d1f43d8..d7659a5). Prior sessions: hierarchy system +
case fleet (68e1f64..8574cee), multi-case foundation (8d694ea registry,
dec89c0 patient switching, CASE_AUTHORING.md), Cloudflare deploy + README +
mobile gate (3b04aeb..70c80ca), tab restructure (47ee20b..54a1ea1), note
feedback (cce42a4..dc9f29b).

## Done
- Phase 3 server-side notes/attempts (2026-07-10, 990d551..93ab9ea, subagent-driven off
  SPEC+PLAN, all 11 tasks review-clean, browser-verified 8/8): trainee notes,
  addenda, and wrap-up attempts moved from localStorage to D1, scoped to the
  better-auth `user.id`. `src/worker/work.ts` is the session-gated Hono router
  (GET /api/cases/:caseId/work, POST notes, PUT/DELETE /api/notes/:id, POST
  addenda, PUT/DELETE attempt); client side is `src/lib/api.ts` (fetch wrapper)
  + `src/hooks/useCaseWork.ts` (the hook `PatientWorkspace` reads/writes
  through). Guest-to-Google re-key on account link (`src/worker/rekey.ts` via
  better-auth's `onLinkAccount`, runs before the anon user is deleted) and a
  daily anon-user purge (`src/worker/purge.ts`, cron `17 3 * * *` in
  `wrangler.jsonc`; worker default export is now `{ fetch, scheduled }`).
  Deleted the dead client plumbing: `src/lib/wrapupAttempt.ts`, `isOwnNote`,
  `generateHcpId` (client copy), and the three localStorage work keys
  (`legend-user-notes-*`, `legend-addenda-*`, `legend-wrapup-*`). Browser
  click-through 8/8 PASS (pend/reload/reopen/sign/reload/clear-report/reload/
  addendum/reload/delete/reload/sign-out-new-guest-isolation/localStorage
  audit), no console or network errors. Migration 0002 (the new tables) is
  applied locally only; remote D1 is still on 0001 pending the T13 ship gate.
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
  for new projects): https://legend.ryanhocn.workers.dev. Config in `wrangler.jsonc`
  (`not_found_handling: "single-page-application"` handles deep links). Redeploy:
  `npm run deploy` ONLY (build-first). Since the Cloudflare vite plugin (phase 1),
  a bare `wrangler deploy` without a fresh build falls back to the source
  wrangler.jsonc, which has no assets directory — it would ship a worker-only
  bundle and take the live SPA down. Auth via `npx wrangler login`.
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
- Phase 1 backend foundation (2026-07-10, d1f43d8..d7659a5, subagent-driven off
  PLAN.md, every task review-clean, browser-verified 7/7, DEPLOYED by Ryan +
  live-verified): Hono worker at `src/worker/index.ts` (basePath /api, GET
  /api/health with D1 `SELECT 1` probe -> {"ok":true,"db":true} in prod); D1
  `legend-db` provisioned (id e0fcc134-51b7-477f-a4cc-23786fafeb6f, WEUR; remote
  is empty, local replica in .wrangler/state, migrations start phase 2);
  wrangler.jsonc in SPA+API shape (main + run_worker_first ["/api/*"] +
  nodejs_compat, assets.directory removed — vite plugin manages output);
  @cloudflare/vite-plugin so `npm run dev` = SPA + workerd + local D1 in one
  process; tsconfig.worker.json project reference (workerd types via generated,
  committed, eslint-ignored worker-configuration.d.ts — regen with
  `npm run cf-typegen` after binding changes); vitest pinned to vitest.config.ts.
  Live URL corrected everywhere: legend.ryanhocn.workers.dev (ryanho06 was wrong
  in docs). Suite now 182 tests / 23 files.

## In flight
- `hyponatraemia001` FINISHED 2026-07-10 (was the parked partial): full case built
  (summary/documents/encounters/rubric + rubric.test.ts, registry entry). 71F
  confusion+fall, Na 118 mislabelled ?dehydration with saline still running and Na
  climbing 118→124, dual culprits indapamide+sertraline, seizure filed as a "funny
  turn". General Medicine, minGrade fy, progress note. tsc + 189 tests + lint green.
  Case registry is now 17 folders.
- Dynamic patients: research complete 2026-07-10 (5-stream sweep), writeup in repo
  `DYNAMIC_PATIENTS.md`. Recommended direction: event-sourcing (`case_event` log) +
  action-keyed sim clock + lazy reveal on read; pre-authored/locked chart content for
  the rubric, LLM for prose only; Patient Message on the same event stream. Six product
  decisions still Ryan's (sim-time model, rubric fairness, v1 content policy, graded vs
  formative, multiplayer scope column, branch count). Not specced or approved yet.
- Session 2026-07-09/10 commit range: `8574cee..HEAD` (backend pivot: research,
  phase 1, phase 2, handoff doc reconciliation). Nothing pushed (standing rule:
  never push without Ryan's approval).

## Next concrete step
Ship phase 3 (Task 13, Ryan-gated — none of this runs without his explicit go):
- Remote D1 migration: `npx wrangler d1 migrations apply legend-db --remote`.
  Applies `migrations/0002_user_work.sql` (user_note, note_addendum,
  wrapup_attempt tables); prod `legend-db` is still on 0001 only, so the work
  router has no tables to write to in prod until this runs.
- `npm run deploy` (build + wrangler deploy). A bare `wrangler deploy` ships
  the worker with no assets and takes the live SPA down — never run it alone.
- Live checks after deploy: `/api/health` `{ok:true,db:true}`, `/api/auth/ok`,
  SPA root + a deep link both 200.
- Google-link check: as a guest, pend/sign a note, then link a Google account
  and confirm the note/attempt re-key onto the Google user (`rekeyUserWork`,
  `src/worker/rekey.ts`) and the old anonymous row is gone.
- After T13 ships, phase 3 is fully closed. Next on the roadmap: phase 4,
  Patient Message (per-patient MDT chat, LLM personas) — not specced yet; see
  `DYNAMIC_PATIENTS.md` for the dynamic-patients research that feeds it.

Historical context (phases 1-3, all now shipped/built, kept for the record):
- Phase 1 (Worker+Hono foundation): SHIPPED 2026-07-10 (d1f43d8..d7659a5).
- Phase 2 (better-auth accounts): SHIPPED 2026-07-10 (7ee4b06..HEAD at the
  time) — 3 secrets in prod (`wrangler secret put`), remote migrations
  applied (auth tables live in prod legend-db), deployed (version 86c78d99).
  Ryan clicked through the live Google flow and confirmed the avatar renders:
  phase 2 fully closed. A couple of curl-test anonymous rows exist in prod
  (harmless; the anon-GC item below covers cleanup, and phase 3's purge.ts
  now handles it going forward).
- Phase 3 (server-side notes/attempts): BUILT and browser-verified 2026-07-10,
  see the Done entry above. Its entry warnings from the phase-2 final review
  are now resolved: ownership keys on better-auth `user.id` (`work.ts`
  middleware), anonymous users get a daily purge (`purge.ts` + cron), and
  `generateHcpId`'s client copy is deleted (the worker keeps its own, kept
  deliberately separate from SPA code per the `tsconfig.worker.json` split).
  `baseURL` still derives from the request origin — revisit if a custom
  domain is ever added.
- No email/password auth: bcrypt/argon2 unusable in workerd, PBKDF2 capped at
  100k iterations; Google-only auth is the accepted Workers pattern. Staying
  on the Workers FREE tier (Ryan 2026-07-09) remains fine post phase 3: no
  CPU-heavy hashing, D1 free tier headroom is enormous relative to the
  workload. Revisit Paid only if heavy compute ever lands.
- Patient Message scope (Ryan 2026-07-09, unchanged, still the phase-4 plan):
  one chat channel per patient. All HCPs involved in that patient (note
  authors, nurse, doctors, pharmacist, microbiologist) are LLM-played
  personas grounded in the case bundle; the trainee asks quick MDT questions
  on the channel (e.g. "spiking 39, switch to oral vanc?") and gets
  in-character, case-accurate replies/pushback (e.g. micro: wound culture is
  gram-negative only, blood cultures clear — continue metro + cipro IV).
  Async request/response, D1 rows, no real-time transport.
- Phase 0 dispute (2026-07-09): Ryan believes unsigned drafts already survive
  reload; the code says otherwise — drafts live in `caseUi.editors`, plain
  `useState` at App.tsx:49 (and `openCaseIds` App.tsx:46), wiped on reload.
  What persists is pended/signed notes. Awaiting Ryan's recheck: either Pend
  was the observed mechanism (then phase 0 is optional polish or declared
  done-by-design) or an unsigned tab really survived F5 (then it's a bug hunt).

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
- NEXT CONCRETE STEP: Task 13 ship gate for phase 3 (remote D1 migration +
  `npm run deploy` + live checks + Google-link check, all Ryan-gated) — see
  "Next concrete step" above. Phase 3's spec/plan/build/browser-verify are
  all done; only the deploy is outstanding.
- Verify target: `npm test` (186 tests, 24 files, node pool), `npm run
  test:workers` (17 tests, real local D1), `npx tsc -b`, `npm run lint`
  (clean — the old StickyNotePopup.tsx error was fixed in the F1 fix wave;
  generated `worker-configuration.d.ts` is eslint-ignored), `npm run build`
  (emits `dist/client` + `dist/legend` since the Cloudflare vite plugin).
- Deploy is `npm run deploy` ONLY; remote D1 migrations
  (`npx wrangler d1 migrations apply legend-db --remote`) always gated on Ryan.
- SDD execution ledger for this whole pivot: `.superpowers/sdd/progress.md`.
- Unsigned note drafts are in-memory only (App.tsx useState); sign or pend before a
  reload or they're lost. Signed/pended user notes persist server-side in D1
  (phase 3), keyed to the better-auth account.
- The editor body is contentEditable HTML; scoring/reflow go through the pure libs
  (`noteText.ts`, `reflow.ts`), which use string transforms not DOMParser so node
  tests and the browser agree.
- NEVER leave verified work uncommitted (the June work sat 18 days and a hard reset
  destroyed it).
- Note feedback is a floating "Performance" dock (`WrapUpDock`), NOT a main tab; it
  opens on Sign. If a doc or comment says "Wrap-Up tab", it's stale.
