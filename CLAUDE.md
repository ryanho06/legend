# Legend Project Guide

## Project Overview

Legend is a synthetic EHR-style training simulator for medical students and early clinical trainees.

Its purpose is to help users practice:
- chart review
- clinical documentation
- ward round notes
- handover-style synthesis
- recognizing unsafe omissions
- linking clinical cases to physiology and revision topics


Copy Epic, NHS systems, WinPath, or other proprietary systems loosely.

The UI may be inspired by common EHR patterns:
- patient sidebar
- chart tabs
- encounter table
- bloods/microbiology sections
- right context rail
- sticky notes
- alerts
- note editor

Use generic terms:
- Chart Review
- Notes
- Bloods
- Microbiology
- Imaging
- Medications
- Orders
- Synthetic Case ID

Preserve disclaimers:
"All patient data are synthetic. For education and simulation only. Not for clinical use."

## Commands

```bash
npm install
npm run dev      # SPA + API worker + local D1 in ONE process (Cloudflare vite plugin), pinned to http://localhost:5173 (strictPort; it's the registered Google OAuth origin)
npm run build    # tsc -b && vite build (type-check + production build; emits dist/client + dist/legend)
npm run lint     # eslint .
npm test         # vitest run, node pool (pure lib/ logic; excludes *.workers.test.ts)
npm run test:workers  # real-D1 tests: auth, work (notes/addenda/attempts), profile/alias routes (vitest-pool-workers/miniflare, migrations auto-applied)
npm run deploy   # build + wrangler deploy — the ONLY safe deploy; a bare `wrangler deploy` ships the worker with NO assets and takes the live SPA down
npm run cf-typegen    # regenerate worker-configuration.d.ts after changing wrangler.jsonc bindings or .dev.vars keys
```

Type-check only (fast verify loop): `npx tsc -b`

## Tech Stack

Frontend:
- Vite
- React
- TypeScript
- CSS

Installed packages:
- react / react-dom (v19)
- lucide-react (icons)
- react-resizable-panels (resizable layout; see import note below)
- recharts (Vitals trend chart)
- clsx (conditional classNames)
- vitest (dev; unit-test runner for the pure `src/lib/` logic)

Backend (Cloudflare Worker, same repo):
- hono (API router, basePath /api)
- better-auth v1.6 (accounts: anonymous guests + Google-only; native D1, no ORM)
- wrangler + @cloudflare/vite-plugin (single-process dev, deploy)
- @cloudflare/vitest-pool-workers (dev; real-D1 test pool)
- D1 database `legend-db` (binding DB), migrations in `migrations/`

Important package note:
The installed `react-resizable-panels` version exports:
- Group
- Panel
- Separator

Use this import style:

```tsx
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
```

## Architecture

- `src/App.tsx`: top-level shell and multi-case state machine. Gated behind the sign-in screen; holds `openCaseIds` + `activeCaseId` (chart tabs) and a per-case `CaseUiState` map, and renders `TopSystemBar` + `PatientTabBar` + either `PatientListPage` (no chart focused) or `PatientWorkspace` (the active chart, wrapped in `CaseContext.Provider` keyed by case id).
- `src/components/PatientWorkspace.tsx`: one patient's chart (fixed sidebar + resizable workspace + sticky note + Performance dock). Controlled by App's per-case ui map so drafts/tabs survive switching; remounted per case (key) so per-case localStorage hooks never see a key change. Folds the trainee's server work (notes + addenda) into the static case via the pure `applyEvents` fold (`lib/applyEvents.ts`) and re-provides the folded `liveCase` through a NESTED `CaseContext.Provider`, so every `useCase()` consumer sees the evolved chart (the old hand-merge is gone).
- `src/components/`: grouped by area (`chart/`, `notes/`, `summary/`, `results/` (`ResultsModule`/`ResultsTree`/`ResultsFlowsheet`), `panels/`, `layout/` (incl. `PatientTabBar`), `patients/` (`PatientListPage`), `wrapup/` (`WrapUpDock` floating panel + `WrapUpModule` (embeddable body) + `FeedbackReport`)), plus top-level `SignInPage.tsx`, `PatientWorkspace.tsx`, `RotateGate.tsx`. `panels/LetterPage.tsx` is the shared Epic-style letter-page chrome used by both `NotePreview` and `ReportPreview`.
- `src/data/patients/<caseId>/`: ALL of a case's content: `patient.json` (demographics, `CasePatient`), `summary.ts` (`CaseSummary`), `bloods.ts`, `documents.ts` (the *static* source of truth for clinical documents, a `ClinicalDocument[]` discriminated on `kind`), `encounters.ts` (timeline), `rubric.ts` + `rubric.test.ts` (scoring rubric + model note). See CASE_AUTHORING.md for the full authoring contract.
- `src/data/patients/index.ts`: the case registry (`caseRegistry: CaseBundle[]`, `getCase`, `listSpecialties`). Adding a case = folder + one entry here.
- `src/context/CaseContext.ts`: `useCase()` delivers the active `CaseBundle` to workspace components (sidebar, banners, summary, wrap-up); only valid under the provider.
- `src/data/`: shared UI config (`tabs.ts`).
- `src/types.ts`: shared types (`MainTab`, `ChartTab`, `Encounter`, `ClinicalDocument` = `ClinicalNote` | `ClinicalReport` | `ClinicalLab` | `ClinicalMicro`, `Note`/`Report` aliases, `NoteDraft`, `NoteStatus`, `NoteCategory`, `CaseBundle`/`CasePatient`/`CaseSummary`/`CaseUiState`; note-feedback + session types `RubricItem`, `CaseRubric`, `RubricTrigger`, `PdqiDimension`, `UserProfile`; hierarchy types `Grade`, `CaseTask` (`CaseRubric.task` carries `minGrade`); ownership/edit fields `ClinicalNote.authorId`/`addendum`, `NoteDraft.mode`/`targetNoteId`, `CaseBundle.playerHcpId`, `UserProfile.grade`/`hcpId`, ...).
- `src/lib/`: pure, React-free, unit-tested logic. `clinician.ts` (name formatting), `rubric.ts` + `noteText.ts` (deterministic note scoring), `reflow.ts` (display-time line-break reflow for note rendering), `grades.ts` (seniority tiers + `isOverreach`; see Hierarchy Gotcha), `smarttext.ts` (SmartText phrase templates + wildcard/fuzzy matching), `userNotes.ts` (builds signed/pended trainee note payloads + addendum block + refile helpers; stamps sim-time via `simTime.ts`, taking `nowSec: number` not a wall-clock `Date`; `buildUserNote(..., encounterId)` takes the round's encounter so a fresh note lands on the current round, not always `enc-admission`; `foldAddenda` folds server addendum rows per note), `simTime.ts` (UTC epoch-seconds time formatters `formatDate`/`formatTime`/`formatNoteStamp` + `caseNow(anchor, offset)`, `offset` being the sim-offset in seconds; UTC so a case's frozen date is timezone-stable), `applyEvents.ts` (the single overlay seam: pure immutable `applyEvents(bundle, events)` fold + `workToEvents` adapter; patches `documents`/`encounters`/`summary.vitalsTrend`/`flags`, recomputes `notes`; `CaseEvent` kinds `note.create`/`note.addendum`/`result.release`/`encounter.append`/`vitals.append`/`flag.set`), `reveal.ts` (pure `revealEvents(authored, simNow, coveredEncounterIds?)`: a case's authored `events.ts` filtered to `at <= simNow`, sorted by `seq`; an authored NPC `note.create` is suppressed once its round's `encounterId` is in the `coveredEncounterIds` set, the NPC-suppression seam), `rounds.ts` (`currentRound(rounds, simNow)`/`nextRoundAt(rounds, simNow)`: pure round-schedule helpers over a case's `RoundSpec[]`, tolerant of an empty schedule), `chronos.ts` (`matchChronos(text, intents)`: deterministic chronos matcher, reuses `rubric.anyTriggerMatches`, no LLM), `contribution.ts` (`buildContribution(args)`: the derived, private contribution tracker, rounds joined against the trainee's notes, the live folded chart, and the rubric; no new table), `api.ts` (thin fetch wrapper for the `/api` work endpoints: `fetchCaseWork`, note create/refile/delete, `apiAddAddendum`, attempt put/delete, `fetchCaseSession`/`apiPutSession`; throws `ApiError` with the HTTP status), `session.ts` (`signOut()` — ends the server session then sweeps `legend*` localStorage keys; see Gotcha below). `wrapupAttempt.ts` and the client-side `isOwnNote`/`generateHcpId` helpers are gone: notes, addenda, and wrap-up attempts are server-owned now. `src/hooks/useCaseWork.ts` is the one hook that fetches and mutates a case's server-side work (see Gotcha below).
- `src/App.css`: single global stylesheet for the whole app.
- `src/worker/`: the API worker. `index.ts` (Hono, named `export const app` (`.basePath("/api")`), GET /health with D1 probe, better-auth mounted at `/auth/*` -> external `/api/auth/*`, mounts the work router at `/`; default export is `{ fetch: app.fetch, scheduled }` — the `scheduled` handler runs the daily anon-user purge, wired to the cron trigger `17 3 * * *` in `wrangler.jsonc`); `work.ts` (session-gated Hono sub-router for the trainee's work: `GET /cases/:caseId/work`, `POST /cases/:caseId/notes`, `PUT`/`DELETE /notes/:id`, `POST /notes/:id/addenda`, `PUT`/`DELETE /cases/:caseId/attempt`; a `work.use("*", ...)` middleware 401s without a session and stamps `c.set("userId", session.user.id)` — ownership is always the better-auth user id, never the display-only `hcpId`); `session.ts` (session-gated per-case sim clock, Model B: `GET`/`PUT /cases/:caseId/session` over the ONE `case_session` table, column `scope` = user id; clones `work.ts`'s session middleware); `rekey.ts` (`rekeyUserWork`: re-keys a guest's notes/addenda/attempt rows (and, per the Model-B clock Gotcha below, `case_session`) to the account they just linked, called from `auth.ts`'s `onLinkAccount` BEFORE the anonymous plugin deletes the guest's row, whose deletion would otherwise cascade the rows away — it also moves `user_alias` rows and snapshots the outgoing guest persona as a switchable alias); `profile.ts` (session-gated alias/persona history: `GET /profile/aliases` seeds+lists, `POST /profile/aliases/switch` restores a previous persona incl. hcpId via direct D1 UPDATE — a dedicated route because better-auth updateUser 400-rejects hcpId); `persona.ts` (shared `Persona`/`currentPersona`/`ensureSnapshot` helpers used by both profile.ts and rekey.ts; separate module to avoid the profile->auth->rekey import cycle); `purge.ts` (`purgeStaleAnonUsers`: deletes anonymous users with no session active in the last 30 days; FK cascades remove their notes/addenda/attempts with them); `auth.ts` (`createAuth(env, baseURL)` factory: anonymous plugin for guests, Google social login, persona `additionalFields` forename/surname/grade/hcpId with hcpId server-generated via `databaseHooks.user.create.before` and forge-proof via `input: false` — test-pinned in `auth.workers.test.ts`). `worker-configuration.d.ts` is the generated Env type (committed, eslint-ignored; regen via `npm run cf-typegen`). `tsconfig.worker.json` keeps workerd and DOM type worlds in separate programs: NEVER import `src/worker/**` into SPA code (`src/lib/authClient.ts` uses an explicit field schema instead of `inferAdditionalFields<typeof auth>` for exactly this reason).
- `src/lib/authClient.ts`: better-auth React client (`useSession` gates App; anonymousClient + inferAdditionalFields plugins).
- `migrations/` + `auth.cli.ts`: D1 schema migrations (`npx wrangler d1 migrations apply legend-db --local`; `--remote` touches PROD and is always Ryan-gated). `auth.cli.ts` exists only so the better-auth CLI can generate schema (in-memory node:sqlite stub) — its options MUST stay identical to `createAuth`'s in `src/worker/auth.ts`.
- Secrets: `.dev.vars` at the repo root (gitignored — NEVER print or commit it; template in `.dev.vars.example`), prod via `wrangler secret put`. Keys: BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Values must be UNQUOTED: dotenv strips quotes in local dev but `wrangler secret put` stores them literally — quoted Google credentials took prod OAuth down with `invalid_client` on 2026-07-10 (fixed by re-putting clean values). When rotating a secret, verify the live authorize URL has no `%22` in `client_id`.

## Gotchas

- **Tab types must match data.** `MainTab` / `ChartTab` in `src/types.ts` must stay in sync with the tab lists in `src/data/tabs.ts` (a mismatch is a build error under `tsc`).
- **One chart, many lenses.** Every static clinical document lives once in `documents.ts` with a `kind` (`note` | `letter` | `report` | `order` | `encounterSummary` | `lab` | `micro`) and an `encounterId`. The Notes activity (and Chart Review > Notes sub-tab) filter to `kind: "note"` — which now includes both the pre-authored inpatient notes and trainee-authored signed/pended notes (also `kind:"note"`, `encounterId:"enc-admission"`). `EncounterTable` resolves each row's primary document by `encounterId` (prefers a non-note file, else the matching note) and the right-rail `DocumentPanel` switches on `kind` (`NotePreview` / `LabReport` / `MicroReport` / `ReportPreview`). Structured `lab`/`micro` docs carry typed payloads rendered as Epic-style receipts (`ReportBanner` header); the admission `lab` reuses the case's `bloods.ts` to avoid drift. Don't *fork* the static document store, and don't move docs to `.md`/JSON without a loader — the server-side trainee-note store (below) is the one sanctioned runtime store.
- **Trainee session + note feedback.** Accounts are real (better-auth): `App.tsx` gates on `useSession()` and derives `UserProfile` (now incl. optional `image`, the Google avatar in the user bubble) from the session user — only when all four persona fields are set. `SignInPage` has three paths: guest ("Start training" = anonymous server user + persona save), first Google sign-in (returns in persona mode, name prefilled, shown once), returning Google (straight in). The `legend-user` localStorage key is dead (exported but never written). Notes, addenda, and wrap-up attempts are server-side now, scoped to the better-auth `user.id`: `src/worker/work.ts` is the session-gated CRUD router, and `src/hooks/useCaseWork.ts` fetches one case's work on mount (`GET /cases/:caseId/work`) and exposes `createNote`/`refileNote`/`deleteNote`/`addAddendum`/`saveAttempt`/`clearAttempt`, each hitting `src/lib/api.ts` and updating local component state from the server's response. localStorage now holds the sticky-note keys (`legend.sticky.<mrn>` + global `legend.sticky.layout`), the device-level `legend-skip-delete-confirm`, the per-user workspace-resume blob `legend.session.<userId>` (open tabs/active tab/per-case UI, debounced, swept on sign-out — see the Patient switching Gotcha), and the global device pref `legend.hideNextJob` (`NEXT_JOB_HIDE_KEY`, Next-job banner dismiss, sweep-EXEMPT); the old `legend-user-notes-<caseId>`, `legend-addenda-<caseId>`, and `legend-wrapup-<caseId>` keys are dead — nothing writes them anymore. Sign publishes the draft as a signed user note (`lib/userNotes.ts` builds the payload, `createNote`/`refileNote` POST/PUT it) AND auto-opens the floating "Performance" feedback dock (`WrapUpDock`, `wrapupOpen` in the case's `CaseUiState` — not a main tab), which scores it against the per-case rubric (`lib/rubric.ts` + `data/patients/<caseId>/rubric.ts`); Pend files it Incomplete (no auto-score). Only a *signed* attempt can trigger the overreach penalty (see Hierarchy Gotcha) — drafts and reopened-incomplete notes always get the ordinary rubric report. A pure `noteOwnership` helper (`src/lib/noteOwnership.ts`) derives `{canEdit, canDelete}` gating edit/delete to the note's AUTHORING PERSONA: true only for an account-owned note whose `authorId` matches the live persona's `hcpId` (an alias can't edit or delete another persona's note under the same account). Addenda are UNIVERSAL: any HCP addends any note (a real-chart precedent, e.g. a reg cosigning an FY2's note), gated client-side only by `status !== "incomplete"`, no ownership check at all — a server-side addendum ownership check was tried and reverted (pre-multiplayer Fix B, 2026-07-11) once "universal addend" was ratified as the model. `PatientWorkspace.tsx`, `ChartReview`, and `NotesBrowser` all read `canEdit`/`canDelete` from this helper; the old `isUserNote`/`ownNote` predicates are gone. Server work ownership (creating/reading/writing via `work.ts`) is unchanged: still keyed on the better-auth `user.id`, never the display-only `hcpId`. The top-right user bubble opens `ProfileMenu` (current persona, previous-alias list with Switch, a guest-only "Link Google account" button that triggers the onLinkAccount re-key, and Sign out — the bubble no longer signs out directly). `signOut()` is **async** — it ends the server session (`authClient.signOut()`) FIRST, then sweeps every `legend*` key EXCEPT the device-level `legend-skip-delete-confirm` and `legend.hideNextJob`; this sweep no longer touches trainee work at all (it's server-side and survives sign-out) — it clears sticky notes, the per-user workspace-resume blob `legend.session.<userId>` (Fix C), and any future client-only keys.
- **Patient switching.** Sign-in lands on the Patient Lists activity (the rail's "All Patients" pseudo-list is the default, with specialty lists below it, all from the registry; a Hierarchy filter narrows either view by task grade); a row click opens a chart tab (`PatientTabBar`, same equal-width + freeze-on-close ergonomics as the note preview tabs) landing on Notes. The hamburger reopens the list; closing the last tab returns to it. Closing a tab explicitly discards that case's `CaseUiState` entry (open drafts included — signed/pended notes persist server-side regardless). A plain page reload no longer wipes anything: the whole workspace (`openCaseIds`/`activeCaseId`/the per-case `CaseUiState` map, incl. unsigned draft bodies and the Notes preview tabs — `CaseUiState` gained `openNoteIds`/`activePreviewId` for this) persists to `legend.session.<userId>` (per better-auth user id, debounced 250ms, hydrated on mount via the pure `src/lib/sessionState.ts` `hydrateSession`, which drops any case no longer in the registry and prunes `caseUi` to match; swept on sign-out). Do not put per-case state in components that survive a case switch without either living in the `CaseUiState` map or being under the keyed workspace remount (`usePersistentState` must never see its key change mid-life).
- **Encounters are display-curated.** `Encounter` has `date` (DD/MM/YYYY, never "Today") + optional `time`, a `class` (`inpatient`|`outpatient`|`ed`) for the Chart Review filter bar, an `admission` flag (red Type + Admissions filter), and hardcoded `provider`/`deptAbbrev`/`specialty`. Filters are additive-OR; none checked = show all.
- **Times are Unix timestamps.** Note-kind documents store `timestamp` (epoch seconds) and sort by it; display strings (`dateOfService`, `fileTime`) are separate fields. Report-kind documents have no `timestamp` (reached via their encounter row); the `Encounter` timeline is curated array order, not timestamp-sorted, with a per-row `group` recency bucket. Trainee-note stamps are sim-time, NOT wall-clock: `buildUserNote`/`refileUserNote`/`buildAddendumBlock` take `nowSec: number` and stamp via `caseNow(anchor, offset)` + `lib/simTime.ts`, `offset` being the sim clock (`simNow`) so a dynamic case's notes stamp `anchor + simNow` (optional per-case `anchor` epoch; only cholangitis001 has one so far — dynamic-patients Plan 1).
- **One stylesheet.** All styling lives in `src/App.css`; there are no CSS modules.
- **Note editor is contentEditable.** Rich text (B/I/U, per-run font size) wraps the selection in styled `<span>`s directly (not `execCommand` for sizing), so it survives the toolbar stealing focus. The "Insert SmartText" field (`lib/smarttext.ts`) drops bundle-aware Epic-style shells (H&P, PROGRESS, PTWR); `build()` autofills demographics (and, for PROGRESS, vitals+labs from `summary.vitalsTrend`/`bloods.ts`) and emits `***` wildcard chips (`st-wildcard`) that Tab cycles through.
- **Hierarchy / grades / overreach.** Each case's rubric declares a `task` (`CaseTask` with `code`, `label`, `minGrade`); the trainee picks a `Grade` (`fy` | `st3` | `consultant`) at sign-in (`lib/grades.ts`, `GRADES` in rank order). `PatientListPage` surfaces the task grade in the Hierarchy column and lets the list be filtered by it. `isOverreach(userGrade, minGrade)` is true when the trainee is *below* the case's `minGrade`; when they **sign** such a case, `WrapUpModule` replaces the rubric report with the `-1000` "acting above your competence" panel. Overreach is a consequence of signing only — drafts/pended notes never incur it (`StoredAttempt.signed`).
- **Edit and addendum.** A signed note you own can be **addended** (a stamped block appended, `lib/userNotes.ts` `buildAddendumBlock`/`appendAddendum`, POSTed via `useCaseWork().addAddendum` and stored server-side in `note_addendum`); an incomplete note you own can be **reopened for edit** and refiled in place (`refileUserNote`, PUT via `refileNote`). Both surface as a `NoteDraft` with `mode: "edit" | "addendum"` + `targetNoteId`. See the "Trainee session + note feedback" Gotcha above for the current ownership model (`noteOwnership`'s `canEdit`/`canDelete`, addenda universal by note status).
- **The sim clock is server-persisted, the reveal is client-side (Model B).** `case_session(scope, caseId, simNow, updatedAt)` (migration 0004) stores only `simNow` (a sim-offset in seconds from `CaseBundle.anchor`); the client reads it via `useCaseWork().simNow`, filters the case's authored `events.ts` (`CaseBundle.events?: AuthoredEvent[]`) with `revealEvents`, and folds via `applyEvents`. Column is `scope` (value = user id today; fork D carries the name for multiplayer). The clock now ADVANCES (Plan 4b): signing a fresh round note calls `advanceSim(nextRoundAt(rounds, simNow))`, and the Chronos console (below) calls `advanceSim(targetAt)` on a matched intent. Advance is still client-driven (`useCaseWork().advanceSim`, forward-only, last-write-wins), and the server PUT itself clamps `simNow = MAX(case_session.simNow, ?)` (forward-only at the DB layer too, so a stale client, e.g. a second tab, or a `{simNow:0}` reset attempt, can never rewind the clock). A dynamic case authors `events`/`rounds`/`chronos` on its registry entry (`cholangitis001` is the pilot, `src/data/patients/cholangitis001/events.ts`); a case with none of the three behaves exactly as a static case. An authored NPC `note.create` reveals at the FOLLOWING round's `at` (once the trainee has moved past the round it covers) and is suppressed by `revealEvents`'s `coveredEncounterIds` once the trainee's own note already covers that round's `encounterId`, never both. Two floating training-overlay docks ride this loop: Performance (bottom-left, `WrapUpDock`, opens on Sign, now also renders the contribution tracker via `contribution.ts`) and Chronos (bottom-right, `ChronosDock`, rendered only when the case declares `chronos` intents). A third, non-floating hint sits under the main tab bar: `NextJobBanner` (`src/components/NextJobBanner.tsx` + the pure `src/lib/nextJob.ts`) reads `nextJob({rounds, simNow, userNotes, task})` — a dynamic case shows the current round's label (`done` once a user note covers its `encounterId`), a static case (no rounds) falls back to `CaseRubric.task.label`; dismissible via the global device pref `legend.hideNextJob` and hidden outright once multiplayer exists (an `isMultiplayer` seam, hardcoded `false` today).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
