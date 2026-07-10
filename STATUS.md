# STATUS: Legend

> Living state. Update at the end of every working block so a fresh session can resume from here after `/clear`.

Last updated: 2026-07-10 (Dynamic Patients Plan 3, server engine, built + verified locally;
full suite green, final review Ready-to-ship + 1 fix applied, browser PASS; Ryan-gated ship
still pending; Plan 4 next)
Branch / worktree: main (this session NOT pushed, per standing rule)
Latest session (e26d448..1939dea, 11 commits): Dynamic Patients Plan 3 (server engine,
Model B) built subagent-driven off a written plan: migration 0004 `case_session`, the
`/api/cases/:caseId/session` clock router, the rekey line, extended `applyEvents` +
`AuthoredEvent`, the pure `revealEvents` filter, and the client wiring (`useCaseWork`
simNow/advanceSim, `PatientWorkspace` reveal composition). Full suite green: tsc clean,
219 node-pool tests (29 files), 33 workers-pool tests (4 files), lint clean, build emits
dist/client + dist/legend. Ships INERT: no case authors `events.ts` yet (that is Plan 4).
NOT pushed. See Done + In flight.
--- PRIOR session (8582e98..b63b37b, 11 commits): Dynamic Patients v1 started: SPEC
approved + committed (engine = Model B: server clock + client reveal, `case_event`
deferred), Plans 1 (time model) + 2 (applyEvents fold refactor) built subagent-driven,
review-clean, and browser-verified on cholangitis001.
--- PRIOR session (5d8b502..8582e98, 31 commits incl. 2 from a parallel session):
Phase 3 SHIPPED end-to-end (built, reviewed, browser-verified, deployed with
remote migrations 0002+0003; live write loop proven in prod), PLUS a post-ship
wave: profile/alias feature (ProfileMenu on the user bubble, user_alias table,
switch route, guest "Link Google account" button), quoted-secrets OAuth
incident root-caused and fixed live, TestList test patient, staff-ID display
on notes, permissions research doc. Live version 79d2a874 at
legend.ryanhocn.workers.dev. See Done entries below.
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
- Dynamic Patients Plan 3, server engine (Model B) (2026-07-10, 6526b88..1939dea, 10
  commits, subagent-driven off a written plan, all 7 tasks review-clean): migration 0004 adds
  `case_session(scope, caseId, simNow, updatedAt)` (PK(scope,caseId), FK
  scope->user(id) cascade); `src/worker/session.ts` is the session-gated clock router
  (`GET`/`PUT /api/cases/:caseId/session`, lazy-create at simNow=0 with a race-free
  re-read, last-write-wins PUT); `rekey.ts` re-keys `case_session` on account link
  (`UPDATE OR REPLACE ... SET scope`); `CaseEvent` grew four sim-reveal kinds
  (`result.release` / `encounter.append` / `vitals.append` / `flag.set`) plus
  `AuthoredEvent` (`{ at, seq, dedupeKey?, event }`), and `applyEvents` now also patches
  `encounters`, `summary.vitalsTrend`, and `flags`; `src/lib/reveal.ts`
  (`revealEvents(authored, simNow)`) is the pure client reveal filter; `useCaseWork`
  exposes `simNow`/`advanceSim` (forward-only, last-write-wins) and `PatientWorkspace`
  composes the authored reveal into the `applyEvents` fold. Ships INERT: no case
  authors `events.ts` yet (that is Plan 4). Full suite green (tsc, 219 node-pool
  tests/29 files, 33 workers-pool tests/4 files, lint, build). Final whole-branch review
  (opus) returned Ready-to-ship; its one elevated finding (a `Promise.all` that coupled the
  clock fetch to the notes load, so a `/session` failure, e.g. before the remote migration,
  would block the notes render) was fixed by fetching the clock independently and degrading
  to simNow=0 (commit 1939dea). Browser-verified PASS (chrome-devtools-axi, guest,
  cholangitis001): the live server ran Plan 3 code (GET /session -> 200 {simNow:0}), the
  chart rendered identically, zero console errors, note-sign flow intact. Caveat found during
  grounding (Flag 1): cholangitis001's static note `timestamp` epochs sit 24h behind
  its `anchor` (notes filed 15/06, anchor 16/06 17:00 UTC); the engine itself is
  unaffected (it compares `at`/`simNow` offsets, never static epochs), but Plan 4 must
  measure `events.ts` `at` offsets from the anchor deliberately. Outstanding ship gate
  (Ryan-gated, NOT done this plan): remote migration 0004 + `npm run deploy`.
- Post-ship wave (2026-07-10, after the phase-3 ship, ..c00f70b + docs):
  - Profile/aliases (opus agent, worktree, merged f083a58): user bubble opens
    `ProfileMenu` (persona, previous aliases, Switch, Sign out inside);
    `user_alias` table (migration 0003, applied LOCAL + REMOTE), session-gated
    `/api/profile/aliases` + `/switch` (dedicated route because hcpId is
    input:false). Guest "Link Google account" button added (c63b508) — the
    only UI path that triggers the onLinkAccount re-key; logout-then-Google
    orphans guest work BY DESIGN (per-user isolation).
  - Rekey fix (0dd36e9): alias rows follow the link and the outgoing guest
    persona is snapshotted as a previous alias (was: cascade-deleted).
    Helpers extracted to `src/worker/persona.ts` (avoids import cycle).
  - Staff ID on notes (c00f70b): authorId shown in note rows, preview header,
    and sign-off; disambiguates same-name authors.
  - TestList test patient (opus agent, 8150de6): `test001`, "Test, Test",
    MRN LEG-T00001, specialty "TestList"; sanctioned non-clinical exception
    documented in CASE_AUTHORING.md. Future multiplayer-permissions testbed.
  - Permissions research (opus agent, 78d26d3): docs/PERMISSIONS_RESEARCH.md.
    Recommendation: better-auth admin plugin + adminUserIds secret bootstrap +
    one-time invite codes; guests stay passwordless (purge cron handles junk);
    per-patient assignment ACL rows under a small global role set. KEY WARNING
    for phase 4: settle userId-vs-sessionId as the shared scope column for the
    ACL and the dynamic-patients case_event log TOGETHER, before either exists.
  - OAuth incident (live, root-caused via systematic debugging, docs 519af8f):
    prod Google secrets carried literal wrapping quotes (dotenv strips them
    locally; `wrangler secret put` stores them literally) -> Google rejected
    `"865...com"` with invalid_client. Fixed by re-putting clean values;
    gotcha documented in CLAUDE.md Secrets bullet. Google click-through +
    guest-link flow verified live by Ryan afterwards.
  - Shipped to prod at session end (Ryan-approved): remote migration 0003,
    deploy version 79d2a874 (cron visible), live checks green incl. profile
    routes; README refreshed (server-side persistence, profile, 16 cases);
    wrangler.jsonc observability logs enabled.
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
  audit), no console or network errors. (Superseded later the same day: T13
  shipped; remote D1 now carries 0001+0002+0003.)
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
- Case fleet: 17 registry folders = 16 clinical cases (cholangitis001 reference +
  15 generated, incl. hyponatraemia001 finished 2026-07-10) + the test001 TestList
  patient. Case generation is DONE for now — do not queue more from CASE_BACKLOG.md.
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
- Dynamic patients v1: SPEC approved + committed (`DYNAMIC_PATIENTS_SPEC.md`, e0ca413;
  Model B revision b63b37b). All 6 forks resolved (spec §15). Engine = **Model B**: server
  stores only `case_session.simNow`; the client reveals authored `events.ts` by that clock;
  NO `case_event` table in v1 (deferred to LLM/multiplayer). **Plan 1** (time model:
  `lib/simTime.ts` UTC epoch formatters, optional `CaseBundle.anchor` on cholangitis001,
  `buildUserNote`/`refileUserNote`/`buildAddendumBlock` now take `nowSec: number` and stamp
  sim-time) DONE (b604247..1e525a0). **Plan 2** (fold refactor: `lib/applyEvents.ts` +
  `CaseEvent` + `workToEvents`, PatientWorkspace folds via a NESTED `CaseContext.Provider`,
  hand-merge deleted) DONE (18b3d82..45a7e7d). Both browser-verified on cholangitis001.
  **Plan 3** (server engine: `case_session` migration + clock router + rekey line +
  sim-reveal `CaseEvent` kinds + `AuthoredEvent` + `revealEvents` + client wiring) DONE
  (6526b88..1939dea), full suite green, final review Ready-to-ship (1 fix applied),
  browser PASS; see the Done entry above for detail and the Flag-1 caveat. Ships INERT
  (no case authors `events.ts` yet). Plan 4 not written. NEXT: Plan 4 (product loop);
  see Next concrete step.
- Session 2026-07-10 commit range: `5d8b502..HEAD` (phase 3 spec/plan/build/
  ship + post-ship wave). Pushed to origin at session end with Ryan's approval.
  Prior range 8574cee..5d8b502 (backend pivot: research,
  phase 1, phase 2, handoff doc reconciliation). (standing rule:
  never push without Ryan's approval).

## Next concrete step
Write + execute **Dynamic Patients Plan 4** (product loop, on top of the Plan 3 engine).
Read FIRST: `DYNAMIC_PATIENTS_SPEC.md` §8 (chronos), §9 (NPC auto-progression), §10
(rubric fairness + leak safety), §11 (the `events.ts` authoring surface). Scope:
`cholangitis001` `events.ts` authoring (incl. the micro Final result reveal, NPC round
notes, a vitals trend, and chronos-driven intents); wire sign to call `advanceSim` plus
the chronos matcher itself; a rubric-fairness cursor on the attempt (score only against
what has actually been revealed); NPC suppression by `encounterId`; a contribution
tracker; an extended leak-guard covering every reachable sim-state, not just simNow=0;
a CI timeline walker that replays a case's `events.ts` end to end.

**Plan 4 authoring caveat (from grounding Flag 1):** cholangitis001's static note
`timestamp` epochs sit 24h behind its `anchor` (notes filed 15/06, anchor 16/06 17:00
UTC). The engine itself is unaffected: it compares `at`/`simNow` offsets, never static
epochs. But when authoring `events.ts` `at` offsets and reasoning about "N hours since
admission," decide deliberately whether the anchor or the static epochs are canonical,
and keep every reveal `at` offset measured from the anchor, not from the static notes.

Patient Message (old "phase 4", per-patient MDT chat, LLM personas; see the Patient
Message scope bullet below and docs/PERMISSIONS_RESEARCH.md) comes AFTER dynamic
patients and rides the deferred `case_event` log; its LLM proxy route needs per-user
rate limiting.

Phase 3 ship record (2026-07-10, fully closed):
- Remote migrations 0002+0003 applied; final live version 79d2a874 (an earlier
  same-day deploy was 45ebd225, pre-profile) with the purge cron live
  (`17 3 * * *` visible in deploy output).
- Live checks all green: /api/health {ok:true,db:true}, deep link 200,
  unauthenticated work route 401, anonymous sign-in 200, and the FULL prod
  write loop proven (POST note -> server UUID -> GET roundtrip -> DELETE 204
  -> empty).
- INCIDENT, found + fixed during ship: live Google OAuth failed with
  `Error 401: invalid_client`. Root cause: the prod GOOGLE_CLIENT_ID /
  GOOGLE_CLIENT_SECRET secret values carried literal wrapping double quotes
  (quoted values in `.dev.vars`-style source; dotenv strips quotes locally,
  `wrangler secret put` stores them literally — so localhost worked, prod
  sent `"865...com"` to Google). Fix: quotes stripped in `.dev.vars`, Ryan
  re-put both Google secrets from the clean values; live authorize URL now
  serves a clean client_id (no %22). Gotcha documented in CLAUDE.md (Secrets
  bullet). Implication: phase 2's "live Google confirmed" was probably a
  localhost observation.
- Google-link click-through: DONE by Ryan (link flow clean, notes carried
  over; this also proved the re-put GOOGLE_CLIENT_SECRET token exchange).
  The alias-history gap he found (guest persona not listed as a previous
  alias) was fixed in 0dd36e9. Note: the sanctioned carry-over path is
  LINKING from the live guest session (ProfileMenu button); logout-then-
  Google-login is two separate users by design.

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
- The CURRENT next concrete step is Dynamic Patients Plan 4 (see "Next concrete step"
  above). An older version of this bullet pointed at phase 3's ship gate; phase 3
  shipped long ago (see the Phase 3 ship record below and the Done section).
- Verify target: `npm test` (219 tests, 29 files, node pool, verified green this
  session), `npm run test:workers` (33 tests, 4 files, real local D1, verified green
  this session), `npx tsc -b`, `npm run lint`
  (clean — the old StickyNotePopup.tsx error was fixed in the F1 fix wave;
  generated `worker-configuration.d.ts` is eslint-ignored), `npm run build`
  (emits `dist/client` + `dist/legend` since the Cloudflare vite plugin).
- Deploy is `npm run deploy` ONLY; remote D1 migrations
  (`npx wrangler d1 migrations apply legend-db --remote`) always gated on Ryan.
- Dynamic Patients Plan 3 ship gate outstanding (Ryan-gated, NOT done this plan): remote
  migration 0004 (`npx wrangler d1 migrations apply legend-db --remote`) STRICTLY BEFORE
  `npm run deploy` (order matters: a worker live before the table exists would 500 on
  `/session`; the decouple fix in 1939dea keeps notes rendering even then, but sequence it
  right regardless). The engine only exists in local D1 + the unshipped worker build until
  this runs; it ships INERT either way (no case authors `events.ts` yet).
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
