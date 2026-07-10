# Dynamic Patients v1: design spec

Status: design approved 2026-07-10 (forks A/B/C/D confirmed). Engine (§5-§7, Model B) SHIPPED
2026-07-10 as Plan 3 (commit range 6526b88..1939dea, on main, not pushed; Ryan-gated remote
migration + deploy still pending). Pilot content authoring (§8-§11: chronos, NPC notes,
cholangitis001 `events.ts`) is Plan 4, NOT yet started, so the engine currently ships INERT (no
case authors an `events.ts`).
Author: Ryan + Claude. Input: `DYNAMIC_PATIENTS.md` (research) plus a four-stream
codebase-fit audit of the shipped Phase 3 code. This is the SPEC. A PLAN follows via
the writing-plans step; do not implement from this document directly.

Prime directive for v1: build the engine correct, prove the loop on one case, keep it
fully deterministic and pre-authored. v1 is an architectural prototype, deliberately
shelved for pedagogical hardening until the LLM layer lands. Every choice below favors
"the LLM and multiplayer drop in later without a rewrite" over "v1 is defensible alone."

---

## 1. Goal

Make one case evolve over simulated time and let the trainee document it as a member of
a simulated firm. Four capabilities, in v1 priority order:

1. Time-released results: labs and microbiology surface on realistic lab timelines.
2. A simulated FY team that writes the ward's notes on a morning cadence.
3. An action-keyed simulation clock the trainee advances by acting.
4. A deterministic "chronos" channel that skips time to pull a result forward.

Explicitly NOT in v1: live patient deterioration, LLM-generated content, graded
scoring, multiplayer transport, discharge lifecycle. See section 13.

---

## 2. Product model: the loop

The trainee is one FY on a simulated firm (for example vascular surgery). The NPC team
runs the ward whether or not the trainee acts. A case is an admission that unfolds over
simulated days. Each morning round is a note opportunity.

- Simulated time moves only when the trainee acts, so the patient never changes state
  mid-keystroke. This is the action-keyed clock (research-validated over wall-clock and
  accelerated clocks).
- Two actions advance the clock:
  - Signing a note advances `sim_now` to the next scheduled round (authored delta).
  - Chronos skips forward to a chosen reveal (section 8).
- Work is voluntary. The trainee can write any round's note or let the team cover it.
- When the trainee advances past a round without writing it, the team's pre-authored
  model note for that round is revealed into the chart, authored by an NPC (for example
  SMITH, Jenny MD (FY2), signed 11:54). No penalty. It keeps the ward moving and doubles
  as a worked example (section 9).

The feel is "you are covering some of the team's notes on a live ward," not "you are
being tested at checkpoints."

---

## 3. Contribution tracker

Private, self-only, formative. Per case it shows which rounds the trainee personally
submitted and their rubric coverage on each, framed neutrally:

```
POST-TAKE WARD ROUND   82%   (you wrote this)
Progress note (day 2)  90%   (you wrote this)
Progress note (day 3)   --   (team covered)
ED review              --    above your grade
```

- No forfeiture, no leaderboard, no judgment. Low-stakes learning.
- Overreach (writing a task above the trainee's grade) is flagged neutrally, never
  penalized. `isOverreach(userGrade, task.minGrade)` already exists in `lib/grades.ts`.
- It is DERIVED, not a new table: computed from the trainee's existing `user_note` rows
  scored against the case rubric, joined to the set of authored rounds. Self-only by
  construction (it is the trainee's own notes).
- Public stats and achievements (opt-in reveal) are a later feature, out of v1.

Fork A is confirmed as: v1 ships a single scored rubric per case (prototype). The
roadmap after v1 is one-rubric-many-checkpoints (still leak-safe because the rubric
covers the tractable paths), then LLM-generated silhouettes and rubrics as the patient
progresses. v1 does not build per-checkpoint rubric variants.

---

## 4. Prerequisites and program sequencing

This work decomposes into three sub-projects. Only the third is specced in this
document; the first is partly folded in, the second gets its own spec.

### 4.1 Time model (partly folded into v1)

The chart carries no machine-readable timestamps today. Every date is a hand-authored
display string, and the micro `reportedAt` is not even parseable (for example
`"16/06/2026 - 48 hour review"`). A sim-clock that fabricates coherent dates cannot
reinterpret these strings; it must drive a real time model that generates them.

v1 scope for the time model:
- A shared epoch-native time layer plus a display formatter (`lib/simTime.ts`): given a
  per-case anchor epoch and a `sim_now` offset, produce the `DD/MM/YYYY` and `HH:MM`
  display strings the components already expect.
- A per-case `anchor` epoch on the bundle (the admission datetime). cholangitis001 is
  frozen at 16/06/2026; that becomes its anchor.
- Migrate ONLY the pilot case (cholangitis001) to epoch-native authoring for the fields
  the sim touches (note timestamps, lab/micro collected/reported, encounter date/time).
- Fix the shipped `buildUserNote` wall-clock bug at the same time: it stamps trainee
  notes with today's real date onto a chart frozen months earlier, so user notes already
  sort and display wrong. Stamp sim-time instead.

Recommendation (my pushback on "refactor all date/time first"): do NOT convert all 16
cases before v1. The formatter must tolerate both a modern epoch+anchor case and a legacy
authored-string case, so the other 15 cases keep rendering exactly as today until each is
made dynamic. "Convert the remaining static cases to epoch time" is a separate,
non-blocking chore. Ryan may override and request the fleet migration upfront; if so it
sequences before the engine and roughly doubles the pre-v1 mechanical work.

### 4.2 Hospital select shell (separate spec)

Desired flow: sign in -> hospital select -> patient list. Mount Verdant = singleplayer
(scope = userId, the only live hospital in v1); a second hospital for multiplayer test;
a third for real multiplayer, both shown as coming-soon placeholders in v1.

This is a clean product home for the scope column settled in fork D: a hospital is the
namespace that later maps a singleplayer hospital to `scope = userId` and a multiplayer
hospital to `scope = sessionId`. But it is independent of the dynamic engine: nothing in
the event log, `applyEvents`, chronos, or the tracker requires the hospital page to
exist, and it does not change the schema decision. It gets its own short spec and can be
built in parallel with, or right after, the engine. Recommendation: do not gate the
engine behind it.

### 4.3 Recommended sequence

1. Time-model infra + pilot-case migration (folded into the engine work below).
2. Dynamic engine + cholangitis001 pilot (this spec).
3. Hospital shell (own spec), in parallel or after.
4. Fleet time-migration and further dynamic cases: lazy, post-v1.

Ryan's stated order (fleet time -> hospital -> engine) is viable but reaches the first
working dynamic case later. Confirm the sequence at spec review.

---

## 5. Architecture

The research verdict, confirmed against the shipped code: an append-only event log, an
action-keyed sim clock, and lazy catch-up on read. No cron, no Durable Object, no tick
loop. The engine is a pure fold plus a reveal filter over D1, running inside the existing
Phase 3 work router.

### 5.1 Data model (ONE new D1 table, migration 0004) — Model B, decided 2026-07-10

**Model B (server clock + client reveal), chosen over the research doc's server-side
`case_event` log.** The worker cannot import client-side case content (the SPA/worker type
boundary), so it cannot materialize a case's authored `events.ts` into D1. Instead the
server stores only the **clock**; the client reveals its own authored events by that clock.
So v1 adds ONE table, not two.

Clone the `user_note` discipline (indexed, `references "user"("id") on delete cascade`) so
the anon-purge cron and FK cleanup work for free. Highest existing migration is 0003; this
is 0004.

```sql
create table "case_session" (
  "scope"     text    not null,   -- userId today; sessionId when multiplayer lands (fork D)
  "caseId"    text    not null,
  "simNow"    integer not null,   -- sim-time cursor: seconds of sim-offset from the case anchor
  "updatedAt" integer not null,
  primary key ("scope", "caseId"),
  foreign key ("scope") references "user" ("id") on delete cascade
);
```

Notes:
- The `scope` column is carried now (fork D) with value = userId in v1. Moving to shared
  sessions later is a value change, not a migration: the one retrofit the research and
  permissions docs flag as painful, neutralized. (In v1 `scope` holds the better-auth user
  id, so the FK to `user(id)` holds and the anon-purge cron cleans clocks for free; when
  `scope` becomes a sessionId, drop the FK and let a session table own cascade.)
- One row per (scope, caseId): the trainee's clock for that case. Lazily created at
  `simNow = 0` on first read.
- **No `case_event` table in v1.** Authored, deterministic sim-events live in each case's
  client `events.ts` and are revealed by the client filtering on `revealAt <= simNow`
  (section 5.4). A server-side `case_event` log is deferred to when content is genuinely
  NOT client-authored: LLM-generated persona output and multiplayer-shared runtime events
  (section 13). When it lands it clones this same discipline and reuses the `scope` column.

### 5.2 rekey on Google-link (do not forget)

`rekey.ts` hand-moves each work table off the guest id inside `onLinkAccount`, before the
anonymous user is cascade-deleted. The new `case_session` table MUST be added to that
`db.batch`: `update or replace case_session set scope = ?2 where scope = ?1` (OR REPLACE
because `(scope, caseId)` is the primary key and could collide if the target account
already has a clock for the same case, mirroring the `wrapup_attempt` precedent). Omitting
this silently resets a linking guest's clock. This is the single easy-to-miss seam.

### 5.3 The fold: applyEvents

A pure, React-free `applyEvents(bundle: CaseBundle, events: CaseEvent[]): CaseBundle` in
`src/lib`, unit-tested exactly like `rubric.ts`.

- `applyEvents(bundle, [])` MUST be identity: static cases render exactly as today.
- It must be immutable. `getCase()` returns a shared registry singleton reused across
  open tabs and case switches; the fold must never mutate `bundle`, or overlays leak
  across tabs. Structural-share unchanged sub-objects so downstream memoization stays
  cheap.
- It patches `documents` and recomputes `notes = documents.filter(kind === 'note')`.
  Never patch both arrays independently; that is the sync hazard the current hand-merge
  carries.
- Ordering is carried by `event.seq`, never derived from display strings (only
  `ClinicalNote.timestamp` is an epoch; encounters, labs, micro, vitals are display
  strings or labels).

Event source composition (important): the event list handed to `applyEvents` is built
CLIENT-SIDE by merging two sources: (a) the trainee's `useCaseWork` result (their
`user_note` / `note_addendum` rows, fetched exactly as today) adapted into `note.create` /
`note.addendum` records, and (b) the case's authored `events.ts` entries whose
`revealAt <= simNow` (the server clock from the `/session` read). Nothing is duplicated
into a server event table; `applyEvents` sees one uniform stream regardless of origin.
(When LLM/multiplayer events arrive, a `case_event` read becomes a third source merged the
same way.)

Seam correction versus the research doc: the fold does NOT go at `App.tsx:128`. There,
`CaseContext.Provider value={activeCase}` is built from the raw registry singleton, and
the server work (`useCaseWork`) is only reachable one level down inside the keyed
`PatientWorkspace`. So the fold is applied as a NESTED provider inside `PatientWorkspace`:

```tsx
// PatientWorkspace.tsx, replacing the ad-hoc allDocuments/allNotes/withAddenda merge (L73-84)
const liveCase = useMemo(
  () => applyEvents(activeCase, events),   // events = trainee work + authored events.ts revealed by simNow
  [activeCase, events],
);
return (
  <CaseContext.Provider value={liveCase}>
    {/* children now read the evolved bundle via useCase(); the prop-drill is deleted */}
  </CaseContext.Provider>
);
```

This routes every `useCase()` consumer (sidebar, banners, summary, encounters, notes,
wrap-up) through one choke point and collapses the three coupled merge expressions that
exist today (`allDocuments`, `allNotes`, per-id `withAddenda`).

### 5.4 The engine: server clock + client reveal (Model B)

- Clock rail (server): a small session router (clone the `work.ts` session middleware).
  `GET /api/cases/:caseId/session` lazily creates the row and returns `{ simNow }`.
  `PUT /api/cases/:caseId/session` sets `simNow` (idempotent, last-write-wins). The server
  does NOT know the case's authored schedule; it only persists the cursor, so the clock
  survives reloads and is the authority for rubric-fairness (score against
  `revealAt <= simNow`-at-sign-time).
- Reveal rail (client): the client reads `simNow`, filters the case's authored `events.ts`
  to `revealAt <= simNow`, and folds them (plus adapted trainee work) via `applyEvents`.
  This is a pure client computation over static case data plus one integer from the server.
- Advance (client-driven in v1): signing a round's note, or a chronos skip, computes the
  new `simNow` (the next round, or the reveal's `revealAt`, both known from `events.ts`)
  and PUTs it. Client-driven advance is fine for single-player; multiplayer moves the
  advance authority server-side (with the deferred `case_event` log) so two clients cannot
  diverge. Keep the reveal filter and advance-delta as pure `src/lib` functions so that
  lift is free.
- Do NOT widen the `POST /notes` response. Note creation stays exactly as Phase 3; the
  clock is a separate `/session` PUT the client issues alongside signing a round note.
- Poll on focus and on action, never on an interval (an interval would burn the shared
  100k/day Workers budget). No scheduler, cron, or Durable Object in v1.

---

## 6. Event kinds (v1)

`CaseEvent` (the `applyEvents` input, section 5.3) is one uniform stream for all overlay
sources (trainee work, authored sim reveals, later LLM/Patient-Message events). v1 uses:

- `note.create` / `note.refile` / `note.delete` / `note.addendum`: subsume the current
  runtime note merge. The trainee's own notes and addenda become events folded by
  `applyEvents`, replacing the bespoke `withAddenda` / `foldAddenda` path.
- `result.release`: a `ClinicalLab` or `ClinicalMicro` document appears (the payload IS
  the document). New results are new documents, never edits of the frozen admission
  receipt (which stays derived from `bloods.ts`).
- `encounter.append`: a new `Encounter` row. Prepend at index 0 with `group` omitted so
  it lands in the implicit current recency bucket (the table only emits a bucket header
  when `group` is set).
- `vitals.append`: append a `VitalsPoint` to `summary.vitalsTrend`. The chart renders the
  array and the PROGRESS template reads `.at(-1)`, so a new point flows through both.
- `flag.set`: a boolean/counter on the session's derived state. The engine SUPPORTS flags
  and triggered events (hazard windows), but v1 CONTENT authors none (fork B: no
  deterioration). Present so v1.1 branching is authoring, not re-architecture.

Deferred kinds: `summaryPatch` beyond `vitalsTrend` (activeProblems, ipMeds, etc. are
hand-curated narrative), `message` (Patient Message, Phase 4, same stream).

---

## 7. Sim clock and time model details

- Each dynamic case declares an `anchor` epoch (admission datetime) and events carry a
  `revealAt` as a sim-offset in seconds from the anchor. `simNow` is the same offset.
- `lib/simTime.ts` formats `(anchor, offset)` into the `DD/MM/YYYY` + `HH:MM` display
  strings the components expect. The formatter tolerates legacy authored-string cases
  (returns the authored string) so non-migrated cases are untouched.
- Reveals snap to a realistic release window. Microbiology turnaround (real US acute
  care), snapped to a morning release: gram stain / preliminary ~18-24h, organism ID
  ~40-48h, sensitivities ~60-72h, negative culture finalized ~5 days.
- What advances `simNow`:
  - Sign a round's designated note: advance to the next scheduled round (authored delta).
    In v1 only the round's designated note advances the clock; ad-hoc notes, addenda, and
    reopened-incomplete refiles do not move sim-time.
  - Chronos skip: advance to the requested reveal's `revealAt` (section 8).
- `buildUserNote` stamps sim-time, not wall-clock (fixes the shipped date bug).

---

## 8. Chronos (deterministic, fork confirmed "in v1")

Chronos is a direct-message channel that pulls a pre-authored result forward by skipping
time. No LLM in v1; matching is deterministic.

- Intent matching reuses the `rubric.ts` deterministic string-matching style (tokenize,
  lowercase, punctuation-strip, synonym groups, fuzzy match on 5+ letter tokens). The
  case's `events.ts` declares chronos intents: a set of trigger phrase groups mapped to a
  target event (for example {"cultures","micro","sensitivities"} -> the sensitivities
  reveal event).
- On a match, chronos advances `simNow` to that event's `revealAt` and lets the normal
  catch-up materialize it AND everything scheduled before it (including NPC round notes
  for any rounds skipped). It then returns a templated response naming the revealed datum
  and, where authored, a suggestion (for example: "Cultures back. E. coli identified,
  sensitivities attached; de-escalate per sensitivities. Micro note expedited by
  Hermes.").
- Timestamp semantics (Ryan's explicit question, resolved): the revealed result is
  stamped at its TRUE release sim-time, and `simNow` moves to that time, so it sorts as
  newest and the chart stays coherent. Do NOT stamp a note in the future while the clock
  stays put; a signed note dated after "now" is incoherent and no real EHR shows one. The
  trade-off (the trainee also skipped past the intervening window, and the team wrote its
  notes) is the teaching point.
- Chronos never fabricates a result that did not pre-exist in `events.ts`. It only
  reveals authored payloads earlier in wall-clock-of-play by moving sim-time; it cannot
  invent numbers.

---

## 9. NPC team auto-progression

- Each round has a pre-authored model note (the same model note the rubric documents).
  It is authored as a `note.create` event with a future `revealAt` at that round's
  sim-time and an NPC `authorId` in the authored-staff range (visually distinct from the
  trainee's `d9xxxxx` staff IDs).
- The trainee is present at a round when `simNow` sits at it. If they write and sign that
  round's note, that is the round's note; the NPC event for that round is suppressed (no
  duplicate note). If they advance past the round (by signing a different note or via
  chronos) without writing it, the NPC event materializes on the next catch-up: the team
  covered it.
- Suppression rule (derived, no separate flag): at materialization the reveal filter
  skips an NPC round note if a `user_note` already covers that round (matched by the
  round's `encounterId`). Because rounds are sequential in v1 and the trainee cannot go
  back to write a round they already advanced past, this check at the moment of advancing
  is sufficient: either a trainee note for the round exists (suppress the NPC note) or it
  does not (reveal it). Exactly one note per round.
- The contribution tracker (section 3) reads which rounds carry a trainee note versus an
  NPC note.

---

## 10. Rubric fairness and leak safety

- Scoring must run against the chart AS OF the sign-time, not the final chart. Add a
  chart cursor (the `simNow` at sign-time, or the last-applied `seq`) to the stored
  attempt, and score against `applyEvents(bundle, eventsUpTo(cursor))`. A note is fair or
  unfair depending on when it was signed; you cannot be marked down for omitting the 48h
  sensitivities on day 1, nor rewarded for citing them before they were released.
- v1 ships ONE leak-safe rubric per case (fork A). Leak safety must hold against every
  state the chart can reach, not just the admission bundle. The shipped leak guard
  (`progress-autofill.test.ts`) asserts, registry-wide, that the PROGRESS SmartText's
  auto-pasted vitals/labs score zero rubric items. Extend it: fold each reachable
  revealed state and re-run the leak assertion per state, because a moving value or a
  released result could newly satisfy a trigger note-globally.
  - cholangitis001 already hardens four items against the autofill (obstructive LFTs,
    not-pancreatitis, fluids-monitoring, VTE each require an interpretive word beside the
    pasted number). That pattern is the template for keeping evolving values leak-safe.
- Because the NPC model notes and (later) any generated notes can literally contain the
  assessment/plan the rubric rewards, every such note must be gated through `scoreNote`
  against the rubric at authoring/CI time and redacted on a hit, so the chart never leaks
  its own answers. v1's NPC notes are pre-authored, so this is a CI assertion, not a
  runtime step.

---

## 11. Authoring surface: events.ts

Per-case dynamics live in `src/data/patients/<caseId>/events.ts`, extending the
`CASE_AUTHORING.md` contract. Two authored forms:

- Scheduled events: `{ at: <sim-offset, optionally anchored to another event id, e.g.
  cultureSent + 60h>, kind, payload, dedupeKey, seq }`.
- Triggered events (engine-supported, unused in v1 content): `{ on: <action hook>,
  when: <predicate over flags>, effects: [...] }`.

Plus a `chronos` intent table (section 8) and the case `anchor` epoch.

### Pilot: cholangitis001

Chosen because it is the richest case and already ships a pending-cultures encounter to
stage micro against. Concrete authoring for v1:

- Anchor = 16/06/2026 admission datetime; migrate its note/lab/micro/encounter times to
  epoch-native.
- Author the micro Final reveal that does not exist today: the current
  `micro-cultures-001` is only the Preliminary "NO GROWTH TO DATE" snapshot with
  `organisms: []`. Author the staged progression as `result.release` events: gram stain
  (~18-24h) -> organism ID, for example E. coli (~40-48h) -> sensitivities as a
  populated `MicroSensitivity[]` of `{drug, mic, S|I|R}` (~60-72h). The `ClinicalMicro`
  type already supports all of this; only the data is missing.
- Author per-round NPC progress notes (day 2, day 3) as `note.create` events on the
  morning cadence, each pre-scored leak-safe.
- Author `vitals.append` points showing the expected trend after ERCP/antibiotics.
- Author the chronos intents that map "cultures / sensitivities / which antibiotic" to
  the sensitivities reveal.

### CI timeline walker (build before scaling past the pilot)

A vitest suite (steal the ink-tester pattern) that enumerates the case's reveal/skip
permutations and asserts: every document is reachable, `simNow` is monotonic, no dangling
event references, the single rubric stays leak-safe at each reachable state, and each NPC
model note passes the `scoreNote` no-leak gate. This is what makes authored timelines
safe to scale to the fleet.

---

## 12. Testing and verification targets

- `applyEvents` unit tests (pure, `src/lib`): identity on `[]`, immutability of the input
  bundle, each event kind's patch, `notes`/`documents` consistency, `seq` ordering.
- `simTime` unit tests: epoch+offset -> display string; legacy authored-string
  passthrough.
- Chronos matcher unit tests: intent phrases match/don't-match; skip advances `simNow`
  and reveals the right events.
- Worker tests (`vitest-pool-workers`, real D1): `GET /session` lazily creates the row and
  returns `simNow`; `PUT /session` sets it (last-write-wins); rekey moves `case_session` to
  the linked account; FK cascade purge removes it with the anon user.
- The extended leak-guard test (section 10) and the CI timeline walker (section 11).
- End-to-end manual: sign a day-1 PTWR on cholangitis001, verify score against the day-1
  chart; use chronos to pull sensitivities, verify the result lands stamped at its true
  sim-time and sorts newest, and the skipped round's NPC note appears.

---

## 13. Explicitly out of scope for v1

- Triggered deterioration and hazard windows (engine supports them; no v1 content).
- LLM-generated content of any kind (notes, silhouettes, rubrics, chronos prose).
- Server-side `case_event` log (Model B defers it: v1's authored events are client-revealed
  from `events.ts`; the log arrives only when content is not client-authored, i.e. with LLM
  personas and multiplayer, and it clones the `case_session` discipline + `scope` column).
- Patient Message transport (rides that future `case_event` log, `kind: 'message'`).
- The `results.ts` per-case refactor: it is hardcoded cholangitis-only, `ResultsModule`
  imports the singletons directly and never calls `useCase()`, and there is no
  `CaseBundle.results` field. It is also a third, unreconciled dataset (values diverge
  from `bloods.ts`; timeline diverges from `encounters.ts`). Biggest single deferred
  cost; the Results tab will show a static flowsheet in v1. Leaf components
  (`ResultsTree`, `ResultsFlowsheet`) are already prop-driven, so the future refactor is
  data-authoring, not UI.
- Full `CaseSummary` derivation beyond `vitalsTrend` (activeProblems, ipMeds, weights,
  microbiology narrative remain hand-authored; dynamic changes to them are deferred).
- Discharge lifecycle, prune-on-discharge, frequent-flyer re-admission (fork:
  defer lifecycle + pearls).
- Bookmarks / "pearls".
- Public stats and achievements.
- Multiplayer (`scope = sessionId`); only the column is carried now.
- Fleet-wide time-model migration (pilot-only in v1; lazy afterward).

---

## 14. Risk register (from the codebase-fit audit)

- No machine-readable timestamps in the chart today; the sim-clock/anchor is load-bearing
  (section 7).
- `buildUserNote` wall-clock date bug is latent in shipped code; v1 forces and fixes it.
- The runtime overlay is three coupled expressions in `PatientWorkspace`, and `notes` is
  a redundant `kind:'note'` projection of `documents`; the fold must reproduce that
  duplication by recomputation (section 5.3).
- `getCase()` returns a shared singleton; `applyEvents` must be immutable or overlays leak
  across tabs.
- The leak guard covers only the static bundle; evolving values can satisfy triggers
  note-globally; extend the guard per reachable state (section 10).
- The same culture is modeled twice (structured `ClinicalMicro` in the chart vs flat
  `NarrativeResult` in `results.ts`); v1 authors the structured shape and leaves Results
  static; unify when Results is refactored.
- The `scope` column on `case_session` is the one migration painful to retrofit; carrying
  it now (value = userId) is the mitigation (section 5.1, fork D).
- `rekey.ts` must gain the `case_session` UPDATE line or a linking guest loses their clock
  (section 5.2).

---

## 15. Decisions log

- Fork A (rubric fairness): one scored rubric per case for v1 (prototype); roadmap is
  one-rubric-many-checkpoints, then LLM. Confirmed.
- Fork B (deterioration): engine supports triggered hazard windows; v1 authors none.
  Confirmed (shelf until LLM).
- Fork C (pilot first): yes, cholangitis001. Confirmed.
- Fork D (scope column): carry `scope` now, value = userId. Confirmed.
- Chronos: in v1, deterministic. Confirmed.
- Task keep-alive: NPC team covers uncovered rounds; voluntary; private neutral tracker;
  no forfeiture. Confirmed.
- Lifecycle + pearls: deferred. Confirmed.
- Engine model: Model B (server stores only `case_session.simNow`; client reveals its own
  authored `events.ts` by that clock). Chosen over the research doc's server-materialized
  `case_event` log because the worker cannot import client case content across the
  SPA/worker type boundary. `case_event` deferred to LLM/multiplayer. Confirmed 2026-07-10.
- Clock advance: client-driven in v1 (client PUTs the new `simNow` on sign / chronos);
  multiplayer moves advance authority server-side later. Confirmed 2026-07-10.
- Time refactor scope: pilot-first (infra + formatter + migrate cholangitis001 only);
  fleet migration deferred/lazy. Confirmed 2026-07-10.
- Sequencing: time-infra+pilot -> engine -> hospital shell (own spec, parallel); fleet
  migration lazy. Confirmed 2026-07-10.
- Spec location: `DYNAMIC_PATIENTS_SPEC.md` at repo root, sibling to the research doc.
