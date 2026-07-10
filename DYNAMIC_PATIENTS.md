# Dynamic Patients: research and design direction

Status: research complete, not yet specced or approved. Written 2026-07-10 from a
five-stream research sweep (med-ed prior art, game/sim design patterns, Cloudflare
free-tier primitives, LLM content generation, and a codebase-fit audit). Sources at
the bottom. This is the input to a future SPEC/PLAN, not an approved plan.

## The goal

Make a case evolve over (simulated) time and in response to what the trainee does:

1. patient state updates when a user signs off a note (actions have consequences),
2. spontaneous scripted events (code blue, sudden septic shock),
3. simulated doctors write update notes as time passes,
4. simulated microbiologists release culture results on realistic lab timelines.

## TL;DR recommendation

Build it as a **discrete-event simulation over an append-only event log**, with an
**action-keyed simulation clock** and **lazy catch-up on read**. Author each case's
dynamics as a typed **event table** (`events.ts` per case folder). Keep the
authoritative patient state in structured data (a small set of flags plus the event
log); confine any LLM to rendering prose from that state, never to holding state or
emitting numbers. Pre-author (or pre-generate-then-lock) all chart documents that the
rubric scores against. There is **no background process**: nothing ticks, no cron, no
Durable Object alarm. The whole engine is roughly 100 lines over D1 that runs on every
`/api/work` read.

This fits every existing constraint: the deterministic rubric, the "no real-time
transport" Patient Message decision, the Cloudflare free tier, and the parallel
multiplayer work.

Named shape: **authored timeline + action-hooked triggers + lazy catch-up evaluator.**

## Why this shape (the convergent verdict)

All five research streams landed on the same architecture independently. The strong
agreements:

- **Event sourcing, not document mutation.** Chart state = static `CaseBundle` +
  `fold(events)`. An append-only log buys replay-exact scoring, an audit trail ("was
  the gram stain released before they signed?"), the multiplayer sync primitive
  ("events after seq N"), and LLM grounding context, all from one decision. Never
  mutate a released result in place; a corrected lab is a new correction document,
  which matches real lab practice anyway.

- **Discrete-event simulation is the natural fit.** A chart sim has no continuous
  physics; everything observable is a discrete artifact (a note appears, a result
  releases, a vitals row is added). So the system reduces to a queue of pending events
  with due sim-times plus a rule for advancing the clock. No tick loop, no continuous
  physiology engine. (Physiology engines like Pulse are worth using **offline** as an
  authoring tool to pre-bake realistic vital/lab curves, never at runtime.)

- **Action-keyed sim clock beats wall-clock and accelerated clocks.** Full Code
  Medical (and the roguelike time-system genre) advance time only when the actor acts.
  "Signing a ward-round note advances sim-time +24h" is deterministic, maps 1:1 to the
  existing sign-note loop, is trivially fair in multiplayer (advancement is an explicit
  shared action), and makes replay exact. Wall-clock means the trainee never sees the
  48-72h sensitivities in a 10-30 minute sitting; accelerated clocks fire events
  mid-note-draft and cause multiplayer races.

- **Data Availability Model (MedBiquitous ANSI standard): gate, don't generate.**
  Separate case content from *when each datum becomes visible*. Labs and micro results
  pre-exist in the bundle and are released on a schedule. This is the right abstraction
  for time-released results and event-released documents; adopt the decomposition
  (content vs availability vs activity), not the heavyweight XML.

- **State = flags + counters, not ODEs and not an LLM.** Branching virtual-patient
  engines (OpenLabyrinth, CASUS) use a handful of typed variables mutated by rules
  (`sepsis_treated`, `abx_started`, `sim_now`). Cheap, auditable, free-tier friendly,
  and the sweet spot for a chart sim. Every 2024-2026 review of LLM virtual patients
  flags the same failure: if the LLM holds patient state it drifts and accumulates
  error over the session. Keep truth in structured rows; feed the LLM a scoped view.

- **Deterioration = authored hazard windows, fired off action hooks.** Project
  Hospital models every patient as data: an untreated condition opens a hazard window
  ("collapse possible after Start hours, guaranteed by End hours") that names a cascade
  event (septic shock), cancelled by the correct treatment. Paradox's CK3 postmortem is
  the cautionary tale: they replaced probabilistic mean-time-to-happen events with
  deterministic `on_action` hooks because MTTH was unbalanceable, anomalous, and a
  performance drain. For Legend that means: hang events off `on_note_signed` /
  `on_order_placed` / `on_time_advanced` with explicit schedules and predicates, never
  background probability pulses. They fight a deterministic rubric and are untestable.

- **Pre-generate LLM content at authoring time; never per-session at runtime for
  anything the rubric touches.** Three reasons converge: (a) the rubric scores against
  known text, so content must be frozen and testable (mirrors the existing
  `rubric.test.ts`); (b) multiplayer participants must see identical content, so two
  clients generating fresh notes would diverge; (c) measured hallucination rates in
  grounded LLM virtual-patient systems are 0.3-5%, which is unacceptable for content
  students learn from without a review gate. Cost is not the constraint (a whole case's
  ~20 dynamic events costs about $0.20-0.55 to draft once, then $0 per session forever);
  latency and reviewability are. Reserve live generation for the genuinely divergent
  interactive surface (Patient Message), where short, state-grounded turns are low-drift.

## Recommended data model

Clone the phase-3 `user_note` discipline (opaque JSON payload the worker does not
interpret). One new table plus a per-case session row:

```
case_session (
  id TEXT PK, scope TEXT,        -- userId now; sessionId when multiplayer lands
  caseId TEXT, sim_now INTEGER,  -- sim-time cursor, advanced by qualifying actions
  seed TEXT, params TEXT,        -- randomness derived as hash(seed, eventId)
  createdAt INTEGER
)

case_event (
  id TEXT PK, scope TEXT, caseId TEXT,
  kind TEXT,          -- 'document' | 'encounter' | 'vitals' | 'bloodsPatch'
                      -- | 'summaryPatch' | 'flag' | 'message'
  payload TEXT,       -- opaque JSON; for kind:'document' the payload IS a ClinicalDocument
  revealAt INTEGER,   -- due sim-time; NULL payload = generate-on-first-read (LLM)
  dedupeKey TEXT,     -- unique(scope, caseId, dedupeKey) makes materialization idempotent
  seq INTEGER, createdAt INTEGER
)
```

- Same `references "user"("id") on delete cascade` + `(scope, caseId)` index as
  `user_note`, so the existing anon-purge cron cleans up events for free.
- A pure `applyEvents(bundle: CaseBundle, events: CaseEvent[]): CaseBundle` fold in
  `src/lib` (React-free, unit-tested exactly like `rubric.ts`). SHIPPED (Plan 2); SEAM
  CORRECTED versus this research note: the fold is applied as a **nested
  `CaseContext.Provider` inside `PatientWorkspace`**, NOT at `App.tsx` (which provides the
  raw, unfolded bundle) — see `DYNAMIC_PATIENTS_SPEC.md` §5.3. That single choke point
  updates every consumer (sidebar, summary, SmartText autofill, rubric, the document
  merge) through the existing `useCase()` seam. (Also superseded: this doc's server-side
  `case_event` materialization is now Model B — server stores only the clock, client
  reveals authored events; see the SPEC.)
- Author dynamics per case as `src/data/patients/<caseId>/events.ts` (extends the
  `CASE_AUTHORING.md` contract): scheduled events (`at:` sim-offset, optionally
  anchored to another event, e.g. sensitivities at `cultureSent + 60h`) and triggered
  events (`on:` action hook, `when:` predicate over flags, `effects:` release document
  / append vitals row / set flag / schedule follow-up event / end hazard window).
- **The engine is the catch-up evaluator.** Every session-gated `/api/work` read (and
  the future Patient Message poll) materializes all authored events with
  `revealAt <= sim_now` into the log (idempotent via `dedupeKey`), then answers. Every
  qualifying trainee action both appends its own event and advances `sim_now` by its
  authored delta, then catch-up runs again. That is the whole thing. No scheduler.

## How the four goals map

1. **Consequence of sign-off** is *event-driven* and needs no clock at all. It plugs
   into the phase-3 `POST /api/cases/:caseId/notes` handler: after inserting the signed
   note, evaluate the case's authored triggers against the note text (reuse the
   deterministic string-matching style of `rubric.ts`) and insert scheduled
   `case_event` rows in the same request. The client's next poll picks them up.
2. **Scripted events** (code blue, septic shock) are Project-Hospital hazard windows:
   "if `sepsis_treated` is not set by `sim_now + 24h`, fire the septic-shock event,"
   cancelled by the correct order/note. Authored as triggered events with a firing
   window `(minSimTime, maxSimTime)`, deterministic default.
3. **Simulated-doctor update notes** are pre-authored SOAP progress notes released on a
   morning cadence (one per simulated day). Give them a dedicated id prefix
   (`sim-note-`) and an `authorId` in the d0-d8 authored-staff range. (Phase 3
   note: ownership is now server-side membership in the user's fetched notes
   plus the `playerHcpId` match; the old `isOwnNote` `user-note-` backstop is
   deleted. The d0-d8 authorId range still keeps sim notes visually distinct
   from trainee `d9xxxxx` staff IDs.)
4. **Microbiology results** are staged reveals of pre-authored `ClinicalMicro`
   variants. The type already models the progression natively (status
   `Preliminary` -> `Final`, `resultText` for "NO GROWTH TO DATE", `organisms` +
   `sensitivities` arriving later). Real US acute-care turnaround, snapped to a morning
   release window: **gram stain / preliminary ~18-24h, organism ID ~40-48h,
   sensitivities ~60-72h, negative culture finalized at ~5 days.** Offer an optional
   rapid-molecular timeline (~1-7h) as a "modern lab" variant.

## What breaks in the current code (risk register)

From the codebase-fit audit. These are the assumptions dynamic patients violate:

- **PROGRESS SmartText leak guard only covers static state.** `progress-autofill.test.ts`
  proves the template's pasted vitals/labs score zero rubric items *for the static
  bundle*. Once vitals/bloods evolve, the template embeds text the test never saw, and
  a moving value or flag word can combine note-globally to satisfy a trigger. Fix:
  fold every reachable checkpoint into a bundle state and re-run the leak test per
  state. Worse: an LLM-generated simulated-senior note can literally contain the
  assessment/plan the rubric rewards, leaking answers into the chart. Fix: gate every
  generated note through `scoreNote` against the case rubric and regenerate/redact on
  hits.
- **Wrap-up scores against an unversioned chart.** A note is fair or unfair depending
  on *when* it was signed (you cannot cite the 48h sensitivities on day 1). Add a chart
  cursor (sim-time or last-applied-event seq) to `wrapup_attempt` and `StoredAttempt`,
  and score against `applyEvents(bundle, eventsUpTo(cursor))`. Rubrics likely need
  per-checkpoint variants or time-gated items.
- **`bloods.ts` single-source receipt.** The admission lab receipt materializes once at
  import, so it is naturally frozen (keep it that way). Redefine `bundle.bloods` in the
  overlay as "latest panel"; new results become new `ClinicalLab` documents, never
  edits of the admission doc.
- **Encounters array order is hand-curated display order.** Runtime insertion is cheap
  if new rows are prepended at index 0 with `group` omitted (the table only emits a
  bucket header when `group` is set), which lands them in the implicit current bucket.
- **Every display time is a hand-written string.** `Encounter.date/time`,
  `dateOfService`, `fileTime`, `collected/reportedAt` are all authored strings, not
  derived from epochs. Dynamic events must fabricate coherent DD/MM/YYYY strings, which
  forces a per-case sim-clock anchor. Related bug, now FIXED for the cholangitis001
  pilot: `buildUserNote` used to stamp trainee notes with real wall-clock dates (today)
  on a chart frozen at an internal date (cholangitis = 16/06/2026), so user notes sorted
  after the chart with a visibly wrong date. Plan 1
  (`docs/superpowers/plans/2026-07-10-dynamic-patients-1-time-model.md`) fixed this via
  the optional `CaseBundle.anchor` field plus `lib/simTime.ts`'s `caseNow`, which stamps
  from the anchor when one is authored. The other cases have no anchor yet and still
  stamp the real wall clock; fixing them is pending the lazy fleet migration to
  `CaseBundle.anchor`.
- **Multiplayer scoping.** All client stores key by `caseId` alone. Shared sessions
  need `scope = sessionId`, which touches the workspace remount key, the D1 scope
  columns, and the sign-out key sweep. Design `case_event.scope` in from day one so the
  multiplayer engineer never has to migrate it. **This is the one schema decision that
  is painful to retrofit; coordinate it now.**

## Cheap vs expensive (suggested phasing)

**Cheap seams (v1):**
- Injected documents of any kind (the merge exists; `DocumentPanel` already renders
  note/lab/micro/report).
- New encounter rows (prepend without `group`; resolves by `encounterId`).
- Staged microbiology (the type already models preliminary -> final; cholangitis
  already ships a pending-cultures encounter to supersede).
- Appending `VitalsPoint`s to `summary.vitalsTrend` (the chart just renders the array;
  the PROGRESS template's `.at(-1)` picks up the newest point).
- The delivery/poll rail (clone the work router; reuse the session middleware verbatim).

**Expensive (defer):**
- **Results Review is not per-case at all.** `src/data/results.ts` is a hardcoded
  cholangitis-only dataset; `ResultsModule` imports it directly and never calls
  `useCase()`. Dynamic flowsheet columns require refactoring Results to per-case data
  first. Biggest single cost; defer it.
- **`CaseSummary` is hand-curated narrative** with no derivation, so every dynamic
  event needs matching authored `summaryPatch` events or the dashboard goes stale.
- **Rubric versioning + per-state leak-guard test infrastructure.**

**Keep v1 fully deterministic:** pre-author the simulated-doctor notes and staged micro
results in the bundle; store a session seed but use randomness only for cosmetic jitter
derived as `hash(seed, eventId)`. Live LLM-generated events come later and must be
generated-once-then-logged (the payload stored in the event), never regenerated on
replay.

**Build the CI timeline walker before authoring many dynamic cases** (steal the
ink-tester pattern): a vitest suite that enumerates each case's trigger permutations
and asserts every document is reachable, `sim_time` is monotonic, there are no dangling
event references, and the rubric stays leak-safe and consistent at each fork. This is
what makes authored timelines safe to scale past a handful of cases.

## Cloudflare fit (free tier)

- **Lazy-on-read D1 is strictly better than DO alarms here** while three things hold,
  all currently true: nothing must interrupt the trainee mid-keystroke (the code blue
  appears on next load/poll), events have no side effects that must happen unobserved,
  and materialization is idempotent (the `dedupeKey` unique constraint makes concurrent
  pollers safe). Zero new infra, zero DO budget, works inside the phase-3 work router.
- **Poll on focus/action, not on an interval.** A 10s interval is 8,640 req/day/user
  against the shared 100k/day free Workers budget; focus/action polling is a fraction
  of that.
- **When multiplayer lands, converge on one SQLite-backed Durable Object per
  case-session.** Durable Objects are on the free plan since April 2025 (SQLite backend
  only; 100k requests/day, alarms included, WebSocket hibernation keeps idle duration
  free). That one object can be the sim clock (one alarm), the event queue (DO SQLite),
  the push channel (hibernating WebSockets), and later the Patient Message room, with D1
  as the durable system of record via write-through. **Keep the sim engine a pure
  function in `src/lib` so it runs unchanged in the request handler now and inside the
  DO later.** Reject Cloudflare Workflows (3,000 steps/day cap, awkward mid-flight
  timeline mutation) and cron triggers (5/account, one already used) as the engine.

## Patient Message is the same machine

The already-decided Patient Message feature (per-patient MDT channel, LLM HCP personas
grounded in the bundle, async D1 rows, no realtime) and simulated-clinician documents
are one system: a persona invocation whose output lands as a D1 row the client polls.
Make Patient Message messages `kind:'message'` events on the **same** `case_event`
stream. One table, one `(scope, caseId)` index, one reveal-filter endpoint, one FK
cascade purge, one ordering, one multiplayer scope story. The microbiologist persona
answering "when are sensitivities back?" and the microbiologist releasing the 48h
culture report share the same persona prompt and case grounding. Do not build two rails.

## Decisions for Ryan (the real forks)

These change the design materially and are product calls, not engineering ones:

1. **Sim-time model.** Action-keyed (recommended: sign a note -> +Nh), an explicit
   "advance to next ward round" affordance, wall-clock persistence (return-tomorrow
   cases), or a hybrid? Determines whether a patient can deteriorate while the trainee
   is offline.
2. **Rubric fairness model.** One rubric per scripted checkpoint, time-gated rubric
   items, or a single rubric guaranteed leak-safe against all reachable states? Differs
   by an order of magnitude in authoring cost. Related: should the rubric only penalize
   omission of a result that had already been released when the note was signed?
3. **v1 content policy.** Fully pre-authored deterministic events (recommended for v1,
   rubric-safe, $0/session), or live LLM generation from the start (fresher, but needs
   the post-generation `scoreNote` guard and a review loop)?
4. **Graded vs formative.** No LLM-driven dynamic virtual-patient study reports
   Kirkpatrick Level 3/4 outcomes, and reviews warn current systems are effectively
   static. A novel dynamic-state mode may not be defensible as a *graded* tool without
   its own validation. Consider shipping dynamic mode formative-only first.
5. **Multiplayer scope column (`userId` vs `sessionId`).** The one migration that hurts
   to retrofit. Settle it with the multiplayer engineer before creating the table.
6. **Branch count per case.** Pre-generation and review effort scale with the branching
   factor. A small fixed set ("correct plan" vs one or two unsafe-omission branches)
   stays tractable; full free-branching does not.

## Sources

Med-ed prior art: Body Interact, Full Code Medical, Oxford Medical Simulation,
i-Human Patients, SimX, MedBiquitous Virtual Patient standard (PMC2655833),
OpenLabyrinth / CASUS / DecisionSim, Pulse Physiology Engine (Kitware) and BioGears,
Kononowicz JMIR 2014, EHRWorld (arXiv 2602.03569), Agent Hospital (arXiv 2405.02957),
blood-culture turnaround (J Clin Microbiol 2018, PMC6258864).
Game/sim patterns: Project Hospital medical database modding, Paradox CK2/CK3 event
scripting and the CK3 on_actions postmortem, Left 4 Dead AI Director (Booth GDC 2009),
RimWorld storytellers, Mateas/Stern Façade and Riedl experience-manager formalism,
discrete-event simulation / SimPy, roguelike time systems, Laerdal LLEAP/SimMan,
ink / Yarn Spinner and the ink-tester coverage pattern, event sourcing (Azure
architecture patterns), RTS lockstep replay.
LLM content: AIPatient (arXiv 2606.17474), LLM virtual-patient systematic review
(PMC12811743), persona-consistency work (arXiv 2511.00222 NeurIPS 2025), medical
hallucination in foundation models (medRxiv 2025.02.28.25323115), Anthropic Structured
Outputs / prompt caching / model pricing.
Cloudflare: Durable Objects pricing/limits/free-tier changelog, Alarms API, WebSocket
hibernation best practices, Agents SDK schedule-tasks and state-sync, Workflows
limits/pricing, cron-trigger limits (all developers.cloudflare.com, fetched 2026-07-10).
Codebase-fit: `PatientWorkspace.tsx`, `CaseContext.ts`, `smarttext.ts`, `userNotes.ts`,
`session.ts`, `wrapupAttempt.ts`, `rubric.ts`, `progress-autofill.test.ts`,
`EncounterTable.tsx`, `work.ts`, `migrations/0002_user_work.sql`, `results.ts`,
`SummaryModule.tsx`, `types.ts`, `CASE_AUTHORING.md`, `STATUS.md`, `PLAN.md`.
