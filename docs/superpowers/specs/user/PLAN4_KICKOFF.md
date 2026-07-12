# Plan 4 kickoff: Dynamic Patients product loop

Single starting point for the fresh session that plans and builds Dynamic Patients Plan 4.
Everything here is also in `STATUS.md`, `DYNAMIC_PATIENTS_SPEC.md`, and
`.superpowers/sdd/progress.md`; this doc consolidates the load-bearing bits so you do not
have to reassemble them.

## Where things stand

- The **engine (Plan 3, Model B) is built and verified** on `main`, commit range
  `6526b88..1939dea` (+ handoff docs `4088422`), NOT pushed. All 7 tasks review-clean, final
  review Ready-to-ship, 5 gates green, browser PASS.
- It **ships INERT**: no case authors an `events.ts` yet, so every case renders as before.
  Plan 4 is what turns it on (content + the product loop).
- Plan 3's ship gate (remote migration 0004 + `npm run deploy`) is **Ryan-gated and still
  pending**. Plan 4 builds on the engine LOCALLY regardless (local D1 has `case_session`); the
  ship can happen any time and is independent of Plan 4.

## How to run Plan 4

Same loop that worked for Plan 3: **writing-plans off the existing spec, then
subagent-driven-development.** Plan 4 does NOT need a new spec: `DYNAMIC_PATIENTS_SPEC.md`
§8-§11 already designs it. Read those first:

- §8 chronos (deterministic, rubric-style intent matching that pulls a reveal forward)
- §9 NPC team auto-progression (team writes the round note if the trainee advances past it)
- §10 rubric fairness and leak safety (score against the chart AS OF sign-time)
- §11 the `events.ts` authoring surface + the cholangitis001 pilot content + the CI walker

**Recommendation: split Plan 4.** It is bigger and more heterogeneous than Plan 3. Do a
scope-check and write 2-3 sub-plans, not one monolith. A reasonable split:

- **4a - content + safety net:** author `cholangitis001/events.ts`, wire it into the registry
  entry, extend the leak-guard per reachable state, build the CI timeline walker. End state:
  the reveal works end-to-end when `simNow` is advanced manually (via the `/session` PUT).
- **4b - advance + chronos:** wire signing the round note to call `advanceSim` (advance to the
  next scheduled round), and build the deterministic chronos matcher (advance to a target
  reveal's `at`).
- **4c - scoring + feedback:** rubric-fairness cursor on the stored attempt, NPC suppression by
  `encounterId`, the contribution tracker.

Each is independently testable. The planner may re-cut these, but do not write one giant plan.

## Engine seams Plan 4 builds on (all shipped, do not rebuild)

- **`CaseBundle.events?: AuthoredEvent[]`** (`src/types.ts`): a case opts into dynamics by
  importing its `events.ts` and setting `events:` on its registry entry in
  `src/data/patients/index.ts`. Absent = static.
- **`AuthoredEvent = { at: number; seq: number; dedupeKey?: string; event: CaseEvent }`**.
  `at` and `simNow` are **sim-offset SECONDS from the case `anchor`**, compared as integers.
  `seq` is the total fold order (author keeps it monotonic with `at`).
- **`CaseEvent`** kinds (`src/lib/applyEvents.ts` folds all six, exhaustiveness-guarded):
  `note.create {note}`, `note.addendum {noteId, block}`, `result.release {document: ClinicalLab
  | ClinicalMicro}`, `encounter.append {encounter}`, `vitals.append {point}`,
  `flag.set {key, value: boolean|number}`.
- **`revealEvents(authored, simNow)`** (`src/lib/reveal.ts`): pure filter, `at <= simNow` sorted
  by `seq`, mapped to `event`. This is where NPC suppression (§9) will grow a `userNotes` param
  (a small signature change, that is fine, not a re-architecture).
- **`applyEvents(bundle, events)`** (`src/lib/applyEvents.ts`): pure, immutable, identity on
  `[]`; patches documents/encounters/summary.vitalsTrend/flags, recomputes `notes`.
- **`PatientWorkspace`** already composes `[...revealEvents(activeCase.events ?? [], work.simNow),
  ...workToEvents(userNotes, addenda)]` into `applyEvents`. Reveals fold BEFORE trainee work.
- **`useCaseWork(caseId)`** exposes `simNow` and **`advanceSim(target)`** (forward-only clamp
  `Math.max(simNow, floor(target))`, PUTs `/session`, updates from the server response).
  **`advanceSim` has NO caller yet** - Plan 4 (4b) wires signing/chronos to it.
- **Server clock:** `GET/PUT /api/cases/:caseId/session` over `case_session(scope, caseId,
  simNow, updatedAt)`. GET lazily creates + re-reads (race-free). PUT is **last-write-wins**
  (no server-side monotonic clamp, see Deferred below). `rekey.ts` moves the row on account
  link. Column is `scope` (= user id today).

## cholangitis001 pilot facts (for authoring events.ts)

- `anchor = Date.UTC(2026, 5, 16, 17, 0) / 1000 = 1781629200` (16/06/2026 17:00 UTC). Only case
  with an anchor. Task = `ptwr`, `minGrade: "st3"` (an FY signing it triggers overreach).
- **The existing micro doc `micro-cultures-001`** is `status: "Preliminary"`, `organisms: []`,
  "NO GROWTH TO DATE". The encounter `enc-micro-cultures` exists (status Pending). Author the
  staged Final progression (§11) as `result.release` events with new `ClinicalMicro` payloads:
  gram stain (~18-24h) -> organism ID e.g. E. coli (~40-48h) -> populated sensitivities
  (~60-72h). `ClinicalMicro` already supports it: `organisms?: MicroOrganism[]`, `MicroOrganism
  = {name, gramStain?, sensitivities?}`, `MicroSensitivity = {drug, mic?, interpretation:
  "S"|"I"|"R"}`. Only the DATA is missing.
- **FLAG 1 (load-bearing authoring caveat):** cholangitis001's static note `timestamp` epochs
  sit **24h BEHIND** the anchor (notes filed on 15/06, e.g. `note-hp-001` timestamp
  `1781511600` = 15/06 08:20; anchor is 16/06 17:00). The engine is IMMUNE (it compares
  `at`/`simNow` offsets, never static epochs), but when you author `events.ts` `at` offsets,
  measure them **from the anchor**, not relative to the static note epochs. Deciding to re-base
  the static epochs is a separate optional chore; do NOT let a reveal's `at` get tangled with
  the 15/06 static timestamps.
- Revealed labs/micro/encounters carry authored display STRINGS (collected/reportedAt/date),
  not epochs, so their payloads are pre-rendered by the author (no simTime formatting needed at
  fold time). Vitals points carry a bare `t: "HH:MM"` label.

## Open decision to settle at plan time

- **Rubric-fairness cursor storage (§10).** Scoring must run against the chart as of sign-time,
  so the stored attempt needs a chart cursor (the `simNow` at sign-time, or last-applied `seq`).
  That is a schema change: add a column to `wrapup_attempt` (migration 0005) or a small new
  table. Decide which, and whether `scoreNote` scores against `applyEvents(bundle,
  revealEvents(events, cursor))`. Any migration is 0005; `--local` for dev, `--remote` is
  Ryan-gated.

## Deferred engine notes to fold into Plan 4

- **Server-side monotonic `simNow` clamp.** PUT `/session` is last-write-wins today; the
  forward-only guarantee lives only in the client `advanceSim`. Once `advanceSim` has a caller
  (4b), two tabs / a stale closure could rewind the server clock. Either add `simNow =
  MAX(case_session.simNow, ?)` on the PUT's DO UPDATE, or accept the rewind explicitly.
- **`result.release` needs an existing encounter.** A released `ClinicalLab`/`ClinicalMicro`
  carries an `encounterId`; if it is not already in `encounters`, `EncounterTable` will not
  surface it. Either reuse an existing encounter id or author an `encounter.append` alongside.

## Carried Plan-3 Minors (low priority, optional cleanup)

From the per-task and final reviews, all DEFERRED as not-worth-blocking: session route tests
assert 400 status but not the `{error}` body; no `Math.floor`-truncation test; no PUT-without-
session 401 test (shared middleware covers it); rekey test covers the colliding path only. Pick
up opportunistically if you touch those files; none are required.

## Ground rules (unchanged)

- Commit to `main` locally, NEVER push without Ryan's approval. Remote D1 migrations and deploy
  are ALWAYS Ryan-gated.
- Verify targets: `npx tsc -b`, `npm test` (node pool), `npm run test:workers` (real D1),
  `npm run lint`, `npm run build`. Browser-verify with chrome-devtools-axi.
- Every NPC / authored note that could contain the rubric's answer must pass the `scoreNote`
  no-leak gate at CI time (§10) so the chart never leaks its own answers.
- SDD ledger: `.superpowers/sdd/progress.md`. The Plan 3 plan
  (`docs/superpowers/plans/2026-07-10-dynamic-patients-3-engine.md`) is a good template for
  plan shape and the engine-seam signatures.
