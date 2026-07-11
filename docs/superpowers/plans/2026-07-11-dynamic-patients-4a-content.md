# Dynamic Patients Plan 4a: Pilot content + safety net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author cholangitis001's `events.ts` (staged microbiology, NPC ward-round notes, a post-ERCP vitals trend), wire it into the registry, add NPC-note suppression to the reveal filter, and build the two CI safety nets (an extended leak guard and a timeline walker) so the reveal renders correctly and safely as `simNow` is advanced.

**Architecture:** The engine (Plan 3, Model B) already reveals a case's authored `events.ts` by the server clock and folds them through `applyEvents`. Plan 4a supplies the first case's content plus two new authoring surfaces on `CaseBundle` (`rounds`, `chronos`), extends the pure `revealEvents` filter to suppress an NPC round note once the trainee's own note covers that round, and adds CI assertions that every reachable chart state stays leak-safe. Nothing here makes the clock advance by itself (that is 4b); at the end of 4a the reveal works end-to-end when `simNow` is advanced manually via the `/session` PUT.

**Tech Stack:** React 19 SPA (`src/`), TypeScript strict (`npx tsc -b`), Vitest node pool (`npm test`, pure `src/lib/` + `src/data/` logic), ESLint (`npm run lint`), Vite build (`npm run build`).

## Global Constraints

- **`at` and `simNow` are sim-offset SECONDS from the case `anchor`** (cholangitis001 `anchor = Date.UTC(2026, 5, 16, 17, 0) / 1000 = 1781629200`, i.e. 16/06/2026 17:00 UTC). Compared as plain integers. Never derived from a document's display string or `timestamp`.
- **FLAG 1 (load-bearing):** cholangitis001's static note `timestamp` epochs sit ~24-33h BEHIND the anchor (e.g. `note-hp-001` is `1781511600`, which is 15/06 in UTC, while its display string says "16/06/26 0820"; the anchor is 16/06 17:00). The engine is immune (it only compares `at`/`simNow` offsets). When authoring reveal `at` offsets, measure them FROM THE ANCHOR, never relative to the static epochs. Do NOT re-base the static epochs in this plan.
- **Revealed labs/micro/encounters carry authored display STRINGS** (`collected`/`reportedAt`/`date`/`time`), not epochs, so payloads are pre-rendered by the author. Only `ClinicalNote.timestamp` (the Notes sort key) is an epoch; for authored NPC notes set it to `anchor + <the day the note was written>`, which is distinct from the AuthoredEvent's reveal `at`.
- **`applyEvents(bundle, [])` MUST remain identity** (same reference). `revealEvents([], n)` MUST remain `[]`. A case with no `events` renders exactly as today.
- **Leak safety (spec §10):** every reachable chart state must keep the PROGRESS SmartText autofill scoring ZERO rubric items, and every authored NPC note must score ZERO rubric items (so the chart never leaks its own day-1 answers). This is enforced by the two CI tests in Tasks 5 and 6.
- **Synthetic-data disclaimer** stays in authored content headers where the file carries a doc comment: "All content is synthetic. For education and simulation only. Not for clinical use."
- **Prose in docs/commits: no em dashes** (use commas, parentheses, colons). Code is unaffected.
- **Verify targets:** `npx tsc -b`, `npm test`, `npm run lint`, `npm run build`. (`npm run test:workers` is untouched by 4a but must still pass at the end.)
- **Commit to `main` locally; never push.** Remote D1 / deploy are Ryan-gated and out of scope.

## File Structure

- `src/types.ts` — add `RoundSpec` and `ChronosIntent` types; add optional `rounds?` and `chronos?` to `CaseBundle` (Task 1).
- `src/lib/reveal.ts` + `src/lib/reveal.test.ts` — add the NPC-suppression `coveredEncounterIds` param (Task 2).
- `src/data/patients/cholangitis001/events.ts` — NEW: the authored `events`, `rounds`, and `chronos` for the pilot (Tasks 3, 4).
- `src/data/patients/index.ts` — wire the three new fields onto the cholangitis001 registry entry (Task 4).
- `src/components/PatientWorkspace.tsx` — pass live `coveredEncounterIds` into `revealEvents` (Task 4).
- `src/data/patients/progress-autofill.test.ts` — extend the leak guard to fold each reachable state (Task 5).
- `src/data/patients/cholangitis001/events.walker.test.ts` — NEW: the CI timeline walker (Task 6).

---

### Task 1: Add `RoundSpec` / `ChronosIntent` types + `CaseBundle.rounds`/`chronos`

**Files:**
- Modify: `src/types.ts` (after the `AuthoredEvent` block, ~L454; and inside `CaseBundle`, ~L420-423)

**Interfaces:**
- Consumes: `RubricTrigger` (existing, `src/types.ts:267`).
- Produces:
  - `RoundSpec = { at: number; encounterId: string; label: string; npcNoteId?: string }`.
  - `ChronosIntent = { triggers: RubricTrigger[]; targetAt: number; reply: string }`.
  - `CaseBundle.rounds?: RoundSpec[]` and `CaseBundle.chronos?: ChronosIntent[]`.

- [ ] **Step 1: Add the two new types after `AuthoredEvent` in `src/types.ts`**

Immediately after the `AuthoredEvent` type (the block ending `};` around line 454), add:

```ts
/**
 * One morning-round note opportunity in a dynamic case's timeline (Plan 4).
 * Signing a fresh note at a round advances the sim-clock to the next round;
 * the round's `encounterId` is stamped on the trainee's note so the NPC note
 * that would otherwise cover the round is suppressed (spec §9).
 */
export type RoundSpec = {
  /** Sim-offset in seconds from the case anchor when this round occurs. */
  at: number;
  /** Encounter a note written at this round belongs to (drives NPC suppression). */
  encounterId: string;
  /** Human label for the contribution tracker, e.g. "Progress note (day 2)". */
  label: string;
  /** Authored NPC note id that covers this round if the trainee skips it. */
  npcNoteId?: string;
};

/**
 * A deterministic chronos intent (spec §8): phrasings that pull an authored
 * reveal forward by skipping time. Matching reuses the rubric tokenizer; the
 * intent fires if ANY trigger matches (AND within a trigger's groups).
 */
export type ChronosIntent = {
  /** Rubric-style triggers; the intent fires if ANY of them matches. */
  triggers: RubricTrigger[];
  /** Sim-offset seconds to advance `simNow` to on a match (an authored event's `at`). */
  targetAt: number;
  /** Templated reply naming the revealed datum. */
  reply: string;
};
```

- [ ] **Step 2: Add `rounds?` and `chronos?` to `CaseBundle`**

In the `CaseBundle` type, immediately after the existing `flags?` field (around line 423), add:

```ts
  /** Round schedule for the action-keyed clock (Plan 4). Absent = no rounds. */
  rounds?: RoundSpec[];
  /** Deterministic chronos intents (Plan 4, §8). Absent = no chronos channel. */
  chronos?: ChronosIntent[];
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: PASS. The new optional fields do not break any existing case (all fields are optional).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(engine): add RoundSpec + ChronosIntent authoring types to CaseBundle"
```

---

### Task 2: NPC-suppression parameter on `revealEvents`

**Files:**
- Modify: `src/lib/reveal.ts`
- Test: `src/lib/reveal.test.ts` (add a suppression describe block)

**Interfaces:**
- Consumes: `AuthoredEvent`, `CaseEvent` (existing).
- Produces: `revealEvents(authored, simNow, coveredEncounterIds?: ReadonlySet<string>): CaseEvent[]` — same as today, but drops any `note.create` event whose `note.encounterId` is in `coveredEncounterIds` (the set of encounter ids the trainee's own notes already cover). Default empty set = no suppression, so all existing callers and tests are unchanged.

- [ ] **Step 1: Write the failing suppression tests**

Append to `src/lib/reveal.test.ts`. The file already imports `revealEvents` and `AuthoredEvent` and defines an `authored(at, seq, id)` helper for `flag.set` events; add a note-event helper and the suppression tests:

```ts
import type { ClinicalNote } from "../types";

function npcNote(id: string, encounterId: string): ClinicalNote {
  return {
    kind: "note",
    id,
    encounterId,
    category: "Progress",
    noteType: "Progress Note",
    author: "Team, NPC",
    credential: "MD",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery",
    dateOfService: "17/06/26 0800",
    fileTime: "17/06/26 0800",
    timestamp: 1781683200,
    status: "signed",
    body: "Day 2 progress.",
  };
}

function authoredNote(at: number, seq: number, id: string, encounterId: string): AuthoredEvent {
  return { at, seq, event: { kind: "note.create", note: npcNote(id, encounterId) } };
}

describe("revealEvents NPC suppression", () => {
  test("suppresses a note.create whose encounterId is already covered", () => {
    const list = [authoredNote(100, 1, "npc-d2", "enc-ward-round-d2")];
    const out = revealEvents(list, 100, new Set(["enc-ward-round-d2"]));
    expect(out).toEqual([]);
  });

  test("reveals the NPC note when the round is not covered", () => {
    const list = [authoredNote(100, 1, "npc-d2", "enc-ward-round-d2")];
    const out = revealEvents(list, 100, new Set(["enc-admission"]));
    expect(out.map((e) => (e.kind === "note.create" ? e.note.id : ""))).toEqual(["npc-d2"]);
  });

  test("suppression never drops non-note events", () => {
    const list = [authored(100, 1, "flag-a"), authoredNote(100, 2, "npc-d2", "enc-ward-round-d2")];
    const out = revealEvents(list, 100, new Set(["enc-ward-round-d2"]));
    expect(out.map((e) => e.kind)).toEqual(["flag.set"]);
  });

  test("omitting coveredEncounterIds reveals everything (back-compat)", () => {
    const list = [authoredNote(100, 1, "npc-d2", "enc-ward-round-d2")];
    expect(revealEvents(list, 100).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- reveal`
Expected: FAIL (the suppression tests fail because `revealEvents` currently ignores the third argument, so the covered note is still revealed).

- [ ] **Step 3: Add the suppression parameter**

Replace the body of `src/lib/reveal.ts` with:

```ts
import type { AuthoredEvent, CaseEvent } from "../types";

const NO_COVERAGE: ReadonlySet<string> = new Set();

/**
 * The client reveal rail (Model B): given a case's authored sim-events and the
 * current sim-clock, return the CaseEvents whose reveal time has arrived, in
 * deterministic fold order (by seq). An authored `note.create` (an NPC round
 * note) is suppressed when the round's encounterId is already covered by the
 * trainee's own work (spec §9: exactly one note per round). Pure: no wall-clock,
 * no server, no mutation of the input. `revealEvents([], n)` is `[]`, so a static
 * case (no events.ts) folds to nothing and renders exactly as today.
 */
export function revealEvents(
  authored: AuthoredEvent[],
  simNow: number,
  coveredEncounterIds: ReadonlySet<string> = NO_COVERAGE,
): CaseEvent[] {
  return authored
    .filter((entry) => entry.at <= simNow)
    .sort((a, b) => a.seq - b.seq)
    .map((entry) => entry.event)
    .filter(
      (event) =>
        !(event.kind === "note.create" && coveredEncounterIds.has(event.note.encounterId)),
    );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- reveal`
Expected: PASS (all prior reveal tests plus the four suppression tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reveal.ts src/lib/reveal.test.ts
git commit -m "feat(engine): suppress an NPC round note once the trainee covers its encounter"
```

---

### Task 3: Author `cholangitis001/events.ts` (micro progression, NPC notes, vitals)

**Files:**
- Create: `src/data/patients/cholangitis001/events.ts`

**Interfaces:**
- Consumes: `AuthoredEvent`, `RoundSpec`, `ChronosIntent`, `ClinicalMicro`, `Encounter`, `VitalsPoint`, `ClinicalNote` (from `../../../types`).
- Produces three named exports consumed by the registry (Task 4):
  - `cholangitis001Events: AuthoredEvent[]`
  - `cholangitis001Rounds: RoundSpec[]`
  - `cholangitis001Chronos: ChronosIntent[]`

**Timeline (all `at` are seconds from the 16/06 17:00 anchor):**
- `3600` (D1 18:00) vitals point (post-ERCP settling).
- `46800` (17/06 06:15) gram-stain encounter + preliminary micro (Gram-negative bacilli).
- `50400` (17/06 07:00) vitals point (D2 morning).
- `54000` (17/06 08:00) = round 1 (day-2 progress). NPC day-2 note is authored but reveals at `140400` (see below).
- `126000` (18/06 05:30) organism-ID encounter + preliminary micro (E. coli).
- `133200` (18/06 06:00) vitals point (D3 morning).
- `140400` (18/06 08:00) = round 2 (day-3 progress) AND the reveal `at` of the NPC day-2 note (the team's day-2 note surfaces once the trainee has moved past day 2).
- `208800` (19/06 06:00) sensitivities encounter + FINAL micro (chronos horizon) AND the reveal `at` of the NPC day-3 note.

`seq` is monotonic with `at`; where two events share an `at`, the `encounter.append` gets the lower `seq` so its row exists before its result folds.

- [ ] **Step 1: Write `events.ts`**

Create `src/data/patients/cholangitis001/events.ts` with EXACTLY this content. The NPC notes are deliberately written to avoid every rubric trigger (no "cholangitis", "sepsis", "ERCP", "metformin", "penicillin", "ciprofloxacin", "metronidazole", "epigastric", "obstructive", "cultures", "fluids", "lipase", "weight loss", "TG18"); Task 5/6 will fail if any trigger sneaks in, and the fix is to reword the note, never to weaken the guard.

```ts
import type {
  AuthoredEvent,
  ChronosIntent,
  ClinicalMicro,
  ClinicalNote,
  Encounter,
  RoundSpec,
  VitalsPoint,
} from "../../../types";

/**
 * Dynamic sim-events for the cholangitis case (Hart, Amelia, 64F). Revealed by
 * the server sim-clock (Model B): each AuthoredEvent folds via applyEvents once
 * simNow reaches its `at` (sim-offset seconds from the 16/06/2026 17:00 anchor).
 *
 * Content:
 *  - Staged blood-culture microbiology the static chart lacks: Gram-negative
 *    bacilli (~13h) -> E. coli identified (~35h) -> final sensitivities (~58h).
 *  - Two NPC ward-round notes (day 2, day 3) that materialise if the trainee
 *    advances past a round without writing it (spec §9). They are written to
 *    carry NONE of the day-1 rubric's answers (leak-safe, enforced in CI).
 *  - A post-ERCP vitals trend showing the expected recovery.
 *
 * Reveal `at` vs note timestamp: an NPC note is DATED the day it was written
 * (its `timestamp` = anchor + that day) but REVEALS at the following round's
 * `at`, i.e. once the trainee has moved past the round it covers.
 *
 * All content is synthetic. For education and simulation only. Not for clinical use.
 */

const ANCHOR = Date.UTC(2026, 5, 16, 17, 0) / 1000; // 1781629200, keep in sync with the registry entry

// --- Microbiology progression (new encounter row + micro receipt per stage) ---

const gramEncounter: Encounter = {
  id: "enc-micro-gram",
  date: "17/06/2026",
  time: "06:15",
  class: "inpatient",
  type: "Microbiology",
  specialty: "Microbiology",
  deptAbbrev: "MICRO",
  provider: "",
  description: "Blood culture flagged positive at ~24h: Gram-negative bacilli. ID and sensitivities to follow.",
  status: "Preliminary",
  location: "Lab",
};

const gramMicro: ClinicalMicro = {
  kind: "micro",
  id: "micro-cultures-002",
  encounterId: "enc-micro-gram",
  title: "Blood Culture — Preliminary (Gram stain)",
  status: "Preliminary",
  specimen: "Blood culture x2 sets (aerobic + anaerobic, separate sites); Urine (MSU)",
  collected: "16/06/2026 06:05",
  received: "16/06/2026 06:40",
  reportedAt: "17/06/2026 06:15",
  organisms: [{ name: "Gram-negative bacilli (awaiting identification)", gramStain: "Gram-negative bacilli" }],
  resultText: `BLOOD CULTURE (x2 sets) — PRELIMINARY
One aerobic bottle flagged positive at approximately 24 hours.
Gram stain: GRAM-NEGATIVE BACILLI. Species identification and susceptibilities to follow.
The second set and the anaerobic bottles show no growth to date.

URINE CULTURE (MSU) — no growth to date.`,
};

const idEncounter: Encounter = {
  id: "enc-micro-id",
  date: "18/06/2026",
  time: "05:30",
  class: "inpatient",
  type: "Microbiology",
  specialty: "Microbiology",
  deptAbbrev: "MICRO",
  provider: "",
  description: "Blood culture: Escherichia coli identified. Susceptibilities pending.",
  status: "Preliminary",
  location: "Lab",
};

const idMicro: ClinicalMicro = {
  kind: "micro",
  id: "micro-cultures-003",
  encounterId: "enc-micro-id",
  title: "Blood Culture — Organism identified",
  status: "Preliminary",
  specimen: "Blood culture x2 sets (aerobic + anaerobic, separate sites); Urine (MSU)",
  collected: "16/06/2026 06:05",
  received: "16/06/2026 06:40",
  reportedAt: "18/06/2026 05:30",
  organisms: [{ name: "Escherichia coli", gramStain: "Gram-negative bacilli" }],
  resultText: `BLOOD CULTURE (x2 sets) — PRELIMINARY
ESCHERICHIA COLI isolated from the aerobic bottle (1 of 2 sets).
Susceptibilities to follow. Anaerobic bottles: no growth to date.

URINE CULTURE (MSU) — no growth at 48 hours.`,
};

const sensEncounter: Encounter = {
  id: "enc-micro-sens",
  date: "19/06/2026",
  time: "06:00",
  class: "inpatient",
  type: "Microbiology",
  specialty: "Microbiology",
  deptAbbrev: "MICRO",
  provider: "",
  description: "Blood culture: E. coli, susceptibilities reported. Oral step-down options available.",
  status: "Final",
  location: "Lab",
};

const sensMicro: ClinicalMicro = {
  kind: "micro",
  id: "micro-cultures-004",
  encounterId: "enc-micro-sens",
  title: "Blood Culture — Escherichia coli, susceptibilities",
  status: "Final",
  specimen: "Blood culture x2 sets (aerobic + anaerobic, separate sites); Urine (MSU)",
  collected: "16/06/2026 06:05",
  received: "16/06/2026 06:40",
  reportedAt: "19/06/2026 06:00",
  organisms: [
    {
      name: "Escherichia coli",
      gramStain: "Gram-negative bacilli",
      sensitivities: [
        { drug: "Amoxicillin", interpretation: "R" },
        { drug: "Co-amoxiclav", mic: "4", interpretation: "S" },
        { drug: "Ciprofloxacin", mic: "0.06", interpretation: "S" },
        { drug: "Gentamicin", mic: "0.5", interpretation: "S" },
        { drug: "Trimethoprim", interpretation: "R" },
        { drug: "Piperacillin/tazobactam", mic: "2", interpretation: "S" },
      ],
    },
  ],
  resultText: `BLOOD CULTURE (x2 sets) — FINAL
Escherichia coli, susceptibilities as tabulated.
An oral agent to which the isolate is susceptible is available for step-down.

URINE CULTURE (MSU) — no growth (final).`,
};

// --- NPC ward-round notes (leak-safe: carry none of the day-1 rubric answers) ---

const npcDay2Note: ClinicalNote = {
  kind: "note",
  id: "npc-prog-d2",
  encounterId: "enc-ward-round-d2",
  category: "Progress",
  noteType: "Progress Note",
  author: "Sowande, Bisi",
  credential: "MD",
  authorId: "d271044",
  authorRole: "*PHYSICIAN: RESIDENT",
  service: "(A) General Surgery — AMU",
  dateOfService: "17/06/26 0800",
  fileTime: "17/06/26 0812",
  timestamp: ANCHOR + 54000,
  status: "signed",
  body: `SURGICAL PROGRESS NOTE (Day 2)

Reviewed on the morning round. Comfortable overnight, afebrile, haemodynamically stable. Tolerating a light diet, mobilising with physiotherapy. Passing urine; bowels not yet open.

Obs: T 36.9, HR 78, BP 122/74, RR 16, SpO2 98% on air.

Inflammatory markers falling and bilirubin down from admission. Renal function back to baseline.

Impression: recovering well after the biliary procedure. Infection markers improving on the current antimicrobial.

Plan:
- Continue the antimicrobial as charted; microbiology to advise on step-down once susceptibilities are available.
- Encourage oral intake, remove the catheter, continue thromboprophylaxis.
- Diabetes medication to be reviewed by the team before any restart.
- Chase the outstanding microbiology. Consultant round this afternoon.`,
};

const npcDay3Note: ClinicalNote = {
  kind: "note",
  id: "npc-prog-d3",
  encounterId: "enc-ward-round-d3",
  category: "Progress",
  noteType: "Progress Note",
  author: "Whitlock, Grace",
  credential: "MD",
  authorId: "d193882",
  authorRole: "*PHYSICIAN: FACULTY",
  service: "(A) General Surgery — AMU",
  dateOfService: "18/06/26 0800",
  fileTime: "18/06/26 0815",
  timestamp: ANCHOR + 140400,
  status: "signed",
  body: `SURGICAL PROGRESS NOTE (Day 3)

Continues to improve. Afebrile, eating and drinking, independently mobile. Cannula resited yesterday. No abdominal pain.

Obs: T 36.8, HR 72, BP 126/76, RR 15, SpO2 99% on air.

Microbiology: an organism has been identified on the blood specimen; susceptibilities are awaited and the antimicrobial plan will be finalised with the microbiologist today.

Impression: good recovery after the biliary intervention.

Plan:
- Step down to an oral antimicrobial once the specimen susceptibilities return.
- Restart routine home medication as oral intake is established, and document the decision.
- Arrange interval outpatient surgical follow-up.
- Likely fit for discharge in the next 24 to 48 hours pending the microbiology plan.`,
};

// --- Vitals trend (post-ERCP recovery) ---

const vitalsD1Evening: VitalsPoint = { t: "18:00", sys: 118, dia: 74, hr: 82, resp: 16, spo2: 97, tempC: 37.4 };
const vitalsD2: VitalsPoint = { t: "D2 07:00", sys: 122, dia: 76, hr: 78, resp: 15, spo2: 98, tempC: 36.9 };
const vitalsD3: VitalsPoint = { t: "D3 06:00", sys: 126, dia: 76, hr: 72, resp: 15, spo2: 99, tempC: 36.8 };

/**
 * Authored reveal timeline. `seq` is monotonic with `at`; on an `at` tie the
 * encounter.append precedes its result.release so the row exists when the
 * receipt folds. NPC notes reveal at the FOLLOWING round's `at` (once the
 * trainee has moved past the round they cover).
 */
export const cholangitis001Events: AuthoredEvent[] = [
  { at: 3600, seq: 1, event: { kind: "vitals.append", point: vitalsD1Evening } },
  { at: 46800, seq: 2, dedupeKey: "micro-gram-enc", event: { kind: "encounter.append", encounter: gramEncounter } },
  { at: 46800, seq: 3, dedupeKey: "micro-gram", event: { kind: "result.release", document: gramMicro } },
  { at: 50400, seq: 4, event: { kind: "vitals.append", point: vitalsD2 } },
  { at: 126000, seq: 5, dedupeKey: "micro-id-enc", event: { kind: "encounter.append", encounter: idEncounter } },
  { at: 126000, seq: 6, dedupeKey: "micro-id", event: { kind: "result.release", document: idMicro } },
  { at: 133200, seq: 7, event: { kind: "vitals.append", point: vitalsD3 } },
  { at: 140400, seq: 8, dedupeKey: "npc-d2", event: { kind: "note.create", note: npcDay2Note } },
  { at: 208800, seq: 9, dedupeKey: "micro-sens-enc", event: { kind: "encounter.append", encounter: sensEncounter } },
  { at: 208800, seq: 10, dedupeKey: "micro-sens", event: { kind: "result.release", document: sensMicro } },
  { at: 208800, seq: 11, dedupeKey: "npc-d3", event: { kind: "note.create", note: npcDay3Note } },
];

/**
 * Round schedule. Round 0 (day-1 post-take ward round) is the trainee's
 * rubric-scored task and reuses enc-admission (as trainee notes do today). The
 * day-2/day-3 rounds carry their own encounter ids so a trainee note written at
 * that round suppresses the matching NPC note.
 */
export const cholangitis001Rounds: RoundSpec[] = [
  { at: 0, encounterId: "enc-admission", label: "Post-take ward round (day 1)" },
  { at: 54000, encounterId: "enc-ward-round-d2", label: "Progress note (day 2)", npcNoteId: "npc-prog-d2" },
  { at: 140400, encounterId: "enc-ward-round-d3", label: "Progress note (day 3)", npcNoteId: "npc-prog-d3" },
];

/**
 * Chronos intents (spec §8). Asking about the cultures / susceptibilities /
 * which antibiotic pulls the final sensitivities reveal (at 208800) forward and
 * lets the intervening rounds' NPC notes materialise on catch-up.
 */
export const cholangitis001Chronos: ChronosIntent[] = [
  {
    triggers: [
      [["culture", "cultures", "sensitivity", "sensitivities", "micro", "microbiology"]],
      [["organism", "organisms", "bug", "bugs", "coli"]],
      [
        ["antibiotic", "antibiotics", "abx", "antimicrobial", "antimicrobials"],
        ["which", "what", "narrow", "de-escalate", "deescalate", "step", "target", "targeted", "change"],
      ],
    ],
    targetAt: 208800,
    reply:
      "Micro expedited by Hermes: blood cultures are back. Escherichia coli, susceptibilities attached (sensitive to co-amoxiclav, ciprofloxacin and gentamicin). De-escalate to a targeted agent per the susceptibilities and stewardship. Note that advancing to this result also moved the ward clock forward, so the team's intervening notes are now filed.",
  },
];
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: PASS. This confirms every payload satisfies `ClinicalMicro` / `Encounter` / `ClinicalNote` / `VitalsPoint` and the exported arrays match the new types. (The file is not yet imported anywhere; that is Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/data/patients/cholangitis001/events.ts
git commit -m "feat(content): author cholangitis001 events.ts (micro progression, NPC notes, vitals, chronos)"
```

---

### Task 4: Wire the registry + pass live coverage into `PatientWorkspace`

**Files:**
- Modify: `src/data/patients/index.ts` (import the three exports; add `events`/`rounds`/`chronos` to the cholangitis001 entry)
- Modify: `src/components/PatientWorkspace.tsx` (build `coveredEncounterIds`, pass to `revealEvents`)

**Interfaces:**
- Consumes: `cholangitis001Events`/`cholangitis001Rounds`/`cholangitis001Chronos` (Task 3); `revealEvents` (Task 2).
- Produces: cholangitis001's `CaseBundle` now carries `events`, `rounds`, `chronos`; `PatientWorkspace` reveals with live coverage so an NPC note is suppressed once the trainee's own note covers its round.

- [ ] **Step 1: Import the events in the registry**

In `src/data/patients/index.ts`, add after the existing cholangitis001 imports (after line 9, the `caseCholangitis001Summary` import):

```ts
import {
  cholangitis001Chronos,
  cholangitis001Events,
  cholangitis001Rounds,
} from "./cholangitis001/events";
```

- [ ] **Step 2: Add the three fields to the cholangitis001 registry entry**

In the cholangitis001 object in `caseRegistry`, immediately after `bloods: cholangitis001Bloods,` (line 156), add:

```ts
    events: cholangitis001Events,
    rounds: cholangitis001Rounds,
    chronos: cholangitis001Chronos,
```

- [ ] **Step 3: Pass live coverage into `revealEvents` in `PatientWorkspace`**

In `src/components/PatientWorkspace.tsx`, replace the `revealed` memo (currently lines ~79-82) with a version that first derives the set of encounter ids the trainee's own notes cover, then passes it to `revealEvents`:

```tsx
  // Encounter ids the trainee's own notes already cover; an authored NPC round
  // note for a covered encounter is suppressed so there is exactly one note per
  // round (spec §9).
  const coveredEncounterIds = useMemo(
    () => new Set(userNotes.map((note) => note.encounterId)),
    [userNotes],
  );
  const revealed = useMemo(
    () => revealEvents(activeCase.events ?? [], work.simNow, coveredEncounterIds),
    [activeCase.events, work.simNow, coveredEncounterIds],
  );
```

(The `events` and `liveCase` memos below it are unchanged.)

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: all PASS. Lint confirms no unused imports. Build confirms the SPA still compiles with the wired case.

- [ ] **Step 5: Run the full node-pool suite (nothing should regress yet)**

Run: `npm test`
Expected: PASS. Note: `progress-autofill.test.ts` still only tests the STATIC bundle at this point, so it passes; Task 5 extends it to fold the reveals. If it FAILS here, an authored value already leaks and Task 3's NPC notes need rewording before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/data/patients/index.ts src/components/PatientWorkspace.tsx
git commit -m "feat(content): wire cholangitis001 events/rounds/chronos + live NPC suppression"
```

---

### Task 5: Extend the leak guard to fold each reachable state

**Files:**
- Modify: `src/data/patients/progress-autofill.test.ts`

**Interfaces:**
- Consumes: `caseRegistry`, `applyEvents`, `revealEvents`, `SMART_PHRASES`, `htmlToPlainText`, `scoreNote`.
- Produces: the registry-wide leak assertion now also folds each dynamic case at every reachable `simNow` and re-asserts the PROGRESS autofill scores zero, plus asserts every authored NPC note scores zero.

- [ ] **Step 1: Write the extended guard**

Replace the entire contents of `src/data/patients/progress-autofill.test.ts` with:

```ts
import { describe, expect, test } from "vitest";
import { caseRegistry } from "./index";
import { SMART_PHRASES } from "../../lib/smarttext";
import { htmlToPlainText } from "../../lib/noteText";
import { scoreNote } from "../../lib/rubric";
import { applyEvents } from "../../lib/applyEvents";
import { revealEvents } from "../../lib/reveal";
import type { CaseBundle } from "../../types";

const progress = SMART_PHRASES.find((p) => p.id === "PROGRESS")!;

/** The rubric items the PROGRESS autofill scores for `bundle`, as `id: label`. */
function autofillMatches(bundle: CaseBundle): string[] {
  const text = htmlToPlainText(progress.build(bundle, "01/01/2026")).replace(/\*\*\*/g, "");
  return scoreNote(text, bundle.rubric)
    .items.filter((r) => r.matched)
    .map((r) => `${r.item.id}: ${r.item.label}`);
}

/** Every distinct simNow the case can reach: 0, each event `at`, each round `at`, each chronos target. */
function reachableStates(bundle: CaseBundle): number[] {
  const points = new Set<number>([0]);
  for (const e of bundle.events ?? []) points.add(e.at);
  for (const r of bundle.rounds ?? []) points.add(r.at);
  for (const c of bundle.chronos ?? []) points.add(c.targetAt);
  return [...points].sort((a, b) => a - b);
}

/**
 * Scoring-integrity guard for every registered case: the PROGRESS SmartText
 * template auto-embeds real vitals and lab lines, and that text alone must
 * never satisfy a rubric item, at ANY chart state the case can evolve into.
 * If this fails for a new case, tighten the offending trigger with an
 * interpretive word (see the trigger-hygiene note in CASE_AUTHORING.md) rather
 * than weakening this test.
 */
describe("PROGRESS auto-text scores zero rubric items (static bundle)", () => {
  for (const bundle of caseRegistry) {
    test(bundle.id, () => {
      expect(autofillMatches(bundle)).toEqual([]);
    });
  }
});

describe("PROGRESS auto-text stays leak-safe at every reachable dynamic state", () => {
  for (const bundle of caseRegistry.filter((b) => (b.events?.length ?? 0) > 0)) {
    for (const simNow of reachableStates(bundle)) {
      test(`${bundle.id} @ simNow=${simNow}`, () => {
        const live = applyEvents(bundle, revealEvents(bundle.events ?? [], simNow));
        expect(autofillMatches(live)).toEqual([]);
      });
    }
  }
});

describe("authored NPC notes carry none of the case's own rubric answers", () => {
  for (const bundle of caseRegistry.filter((b) => (b.events?.length ?? 0) > 0)) {
    const npcNotes = (bundle.events ?? [])
      .map((e) => e.event)
      .filter((ev): ev is Extract<typeof ev, { kind: "note.create" }> => ev.kind === "note.create")
      .map((ev) => ev.note);
    for (const note of npcNotes) {
      test(`${bundle.id}: ${note.id} scores zero`, () => {
        const matched = scoreNote(note.body, bundle.rubric)
          .items.filter((r) => r.matched)
          .map((r) => r.item.id);
        expect(matched).toEqual([]);
      });
    }
  }
});
```

- [ ] **Step 2: Run the guard**

Run: `npm test -- progress-autofill`
Expected: PASS. The static block passes as before; the dynamic block folds cholangitis001 at each reachable `simNow` (0, 3600, 46800, 50400, 54000, 126000, 133200, 140400, 208800) and confirms the autofill still scores zero; the NPC block confirms `npc-prog-d2` and `npc-prog-d3` score zero.

If any dynamic-state or NPC assertion FAILS, the failure message names the offending rubric item. Reword the offending authored content in `events.ts` (Task 3) to drop the trigger phrase, then re-run. Do NOT weaken this test.

- [ ] **Step 3: Commit**

```bash
git add src/data/patients/progress-autofill.test.ts
git commit -m "test(safety): extend the leak guard to each reachable dynamic state + NPC notes"
```

---

### Task 6: CI timeline walker for cholangitis001

**Files:**
- Create: `src/data/patients/cholangitis001/events.walker.test.ts`

**Interfaces:**
- Consumes: `getCase`, `applyEvents`, `revealEvents` and the pilot's `events`/`rounds`/`chronos`.
- Produces: a vitest suite that enumerates the reveal timeline and asserts it is safe to advance a trainee through: reachability, `seq` monotonicity, no dangling encounter/note references, one-note-per-round suppression.

- [ ] **Step 1: Write the walker**

Create `src/data/patients/cholangitis001/events.walker.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { getCase } from "../index";
import { applyEvents } from "../../../lib/applyEvents";
import { revealEvents } from "../../../lib/reveal";

const bundle = getCase("cholangitis001");
const events = bundle.events ?? [];
const rounds = bundle.rounds ?? [];
const chronos = bundle.chronos ?? [];

/** All distinct sim states the case can reach. */
const states = [
  ...new Set<number>([
    0,
    ...events.map((e) => e.at),
    ...rounds.map((r) => r.at),
    ...chronos.map((c) => c.targetAt),
  ]),
].sort((a, b) => a - b);

describe("cholangitis001 timeline walker", () => {
  test("the case is dynamic (events, rounds and chronos are authored)", () => {
    expect(events.length).toBeGreaterThan(0);
    expect(rounds.length).toBeGreaterThan(0);
    expect(chronos.length).toBeGreaterThan(0);
  });

  test("seq is strictly monotonic and consistent with at", () => {
    const seqs = events.map((e) => e.seq);
    expect(new Set(seqs).size).toBe(seqs.length); // unique
    const byAt = [...events].sort((a, b) => a.at - b.at || a.seq - b.seq);
    expect(byAt.map((e) => e.seq)).toEqual([...seqs].sort((a, b) => a - b));
  });

  test("every authored document and NPC note is reachable at the final state", () => {
    const finalNow = states[states.length - 1];
    const live = applyEvents(bundle, revealEvents(events, finalNow));
    const docIds = new Set(live.documents.map((d) => d.id));
    for (const e of events) {
      if (e.event.kind === "result.release") expect(docIds.has(e.event.document.id)).toBe(true);
      if (e.event.kind === "note.create") expect(docIds.has(e.event.note.id)).toBe(true);
    }
  });

  test("no released result references a missing encounter at any reachable state", () => {
    for (const simNow of states) {
      const live = applyEvents(bundle, revealEvents(events, simNow));
      const encIds = new Set(live.encounters.map((enc) => enc.id));
      for (const doc of live.documents) {
        expect(encIds.has(doc.encounterId), `doc ${doc.id} @ ${simNow}`).toBe(true);
      }
    }
  });

  test("simNow only ever moves forward across the reachable states", () => {
    for (let i = 1; i < states.length; i += 1) expect(states[i]).toBeGreaterThan(states[i - 1]);
  });

  test("a trainee note covering a round suppresses that round's NPC note", () => {
    // Skip day 2 (no user note for enc-ward-round-d2): its NPC note appears once past it.
    const skipped = revealEvents(events, 208800, new Set(["enc-admission"]));
    const skippedIds = skipped
      .filter((e) => e.kind === "note.create")
      .map((e) => (e.kind === "note.create" ? e.note.id : ""));
    expect(skippedIds).toContain("npc-prog-d2");

    // Cover day 2 with a trainee note: the NPC day-2 note is suppressed.
    const covered = revealEvents(events, 208800, new Set(["enc-ward-round-d2"]));
    const coveredIds = covered
      .filter((e) => e.kind === "note.create")
      .map((e) => (e.kind === "note.create" ? e.note.id : ""));
    expect(coveredIds).not.toContain("npc-prog-d2");
    expect(coveredIds).toContain("npc-prog-d3");
  });

  test("every chronos target lands on an authored event `at`", () => {
    const eventAts = new Set(events.map((e) => e.at));
    for (const intent of chronos) expect(eventAts.has(intent.targetAt)).toBe(true);
  });

  test("every round encounter is present in the folded chart at the final state (except round 0's static admission)", () => {
    const finalNow = states[states.length - 1];
    const live = applyEvents(bundle, revealEvents(events, finalNow, new Set(["enc-admission"])));
    const encIds = new Set(live.encounters.map((enc) => enc.id));
    for (const round of rounds) {
      // Rounds with an NPC note reveal a note whose encounter matches; round 0 reuses enc-admission.
      if (round.npcNoteId) {
        const npc = live.documents.find((d) => d.id === round.npcNoteId);
        expect(npc, `NPC note ${round.npcNoteId}`).toBeTruthy();
        expect(npc?.encounterId).toBe(round.encounterId);
      } else {
        expect(encIds.has(round.encounterId)).toBe(true);
      }
    }
  });
});
```

Note on the "no missing encounter" assertion: the NPC round notes carry `encounterId` `enc-ward-round-d2`/`enc-ward-round-d3`, which are NOT authored as `encounter.append` events (a note surfaces in the Notes activity by `kind:"note"`, not via an encounter row). If this assertion fails for the NPC notes, add `encounter.append` events for `enc-ward-round-d2`/`enc-ward-round-d3` to `events.ts` (revealing at the same `at` as the note, with a lower `seq`) so the Encounters timeline also shows the round. Decide based on the failure: the Notes activity does not need the encounter row, but the Chart Review > Encounters tab does. **Author the two round encounters** (see Step 2) so both views are coherent.

- [ ] **Step 2: Add the two round encounters to `events.ts` if the walker flags them**

Run: `npm test -- events.walker`
Expected initially: the "no released result references a missing encounter" test FAILS for `npc-prog-d2`/`npc-prog-d3` (their `enc-ward-round-d2`/`enc-ward-round-d3` encounters do not exist).

Fix by adding two encounters + two `encounter.append` events to `src/data/patients/cholangitis001/events.ts`. Add these encounter consts alongside the micro encounters:

```ts
const wardRoundD2Encounter: Encounter = {
  id: "enc-ward-round-d2",
  date: "17/06/2026",
  time: "08:00",
  class: "inpatient",
  type: "Ward Round",
  specialty: "General Surgery",
  deptAbbrev: "GSAMU",
  provider: "Sowande, Bisi, MD",
  description: "Day 2 surgical progress round. Recovering after the biliary procedure; awaiting microbiology.",
  status: "Open",
  location: "AMU",
};

const wardRoundD3Encounter: Encounter = {
  id: "enc-ward-round-d3",
  date: "18/06/2026",
  time: "08:00",
  class: "inpatient",
  type: "Ward Round",
  specialty: "General Surgery",
  deptAbbrev: "GSAMU",
  provider: "Whitlock, Grace, MD",
  description: "Day 3 surgical progress round. Good recovery; planning oral step-down and discharge.",
  status: "Open",
  location: "AMU",
};
```

Then insert two `encounter.append` events into `cholangitis001Events`, each revealing at the same `at` as its NPC note with a lower `seq`, and renumber the remaining `seq` values so they stay unique and monotonic. The final array is:

```ts
export const cholangitis001Events: AuthoredEvent[] = [
  { at: 3600, seq: 1, event: { kind: "vitals.append", point: vitalsD1Evening } },
  { at: 46800, seq: 2, dedupeKey: "micro-gram-enc", event: { kind: "encounter.append", encounter: gramEncounter } },
  { at: 46800, seq: 3, dedupeKey: "micro-gram", event: { kind: "result.release", document: gramMicro } },
  { at: 50400, seq: 4, event: { kind: "vitals.append", point: vitalsD2 } },
  { at: 126000, seq: 5, dedupeKey: "micro-id-enc", event: { kind: "encounter.append", encounter: idEncounter } },
  { at: 126000, seq: 6, dedupeKey: "micro-id", event: { kind: "result.release", document: idMicro } },
  { at: 133200, seq: 7, event: { kind: "vitals.append", point: vitalsD3 } },
  { at: 140400, seq: 8, dedupeKey: "ward-d2-enc", event: { kind: "encounter.append", encounter: wardRoundD2Encounter } },
  { at: 140400, seq: 9, dedupeKey: "npc-d2", event: { kind: "note.create", note: npcDay2Note } },
  { at: 208800, seq: 10, dedupeKey: "micro-sens-enc", event: { kind: "encounter.append", encounter: sensEncounter } },
  { at: 208800, seq: 11, dedupeKey: "micro-sens", event: { kind: "result.release", document: sensMicro } },
  { at: 208800, seq: 12, dedupeKey: "ward-d3-enc", event: { kind: "encounter.append", encounter: wardRoundD3Encounter } },
  { at: 208800, seq: 13, dedupeKey: "npc-d3", event: { kind: "note.create", note: npcDay3Note } },
];
```

- [ ] **Step 3: Run the walker + full node suite**

Run: `npm test -- events.walker` then `npm test`
Expected: the walker passes (all encounters now resolve), and the whole node pool is green (reveal, applyEvents, rubric, the extended leak guard, the walker).

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/patients/cholangitis001/events.ts src/data/patients/cholangitis001/events.walker.test.ts
git commit -m "test(safety): add cholangitis001 CI timeline walker + author the round encounters"
```

---

### Task 7: Manual reveal smoke (engine works end-to-end with manual advance)

**Files:** none (verification only).

- [ ] **Step 1: Confirm the local migration is applied**

Run: `npx wrangler d1 migrations apply legend-db --local`
Expected: `0004_case_session.sql` is already applied (no-op). Do NOT pass `--remote`.

- [ ] **Step 2: Run the dev server and drive the reveal manually**

Run: `npm run dev`, then in the browser at `http://localhost:5173` (use the chrome-devtools-axi skill):
1. Sign in (guest is fine) and open the cholangitis001 chart. Confirm it renders as today (no day-2/day-3 notes, micro still shows the preliminary "no growth to date").
2. In DevTools console, advance the clock to just past the gram stain and re-load the chart:
   ```js
   await fetch('/api/cases/cholangitis001/session', {
     method: 'PUT',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ simNow: 60000 }),
   }).then((r) => r.json());
   location.reload();
   ```
   Confirm: the Chart Review > Encounters timeline now shows the "Blood culture flagged positive: Gram-negative bacilli" microbiology row, and opening it shows the preliminary Gram-stain receipt. No day-2 NPC note yet (it reveals at 140400).
3. Advance to `220000` (past the sensitivities + both NPC notes) and reload:
   ```js
   await fetch('/api/cases/cholangitis001/session', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ simNow: 220000 }) }).then((r) => r.json());
   location.reload();
   ```
   Confirm: the E. coli identification and the FINAL susceptibilities micro rows are present; the Notes activity now lists the NPC day-2 (Sowande) and day-3 (Whitlock) progress notes; the Summary vitals trend shows the added recovery points.
4. Confirm NO console errors and NO failed requests.

- [ ] **Step 2b: Reset the clock for a clean state**

In the console: `await fetch('/api/cases/cholangitis001/session', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ simNow: 0 }) });` (the server is last-write-wins in 4a; the monotonic clamp lands in 4b). Reload to confirm the chart returns to the static day-1 view.

- [ ] **Step 3: Record the result**

Note the pass/fail of each check in the commit body or a short `.superpowers/sdd/` note. This is the 4a exit gate: the reveal works end-to-end under manual advance.

---

## Self-Review (completed against DYNAMIC_PATIENTS_SPEC.md §6, §9, §10, §11)

**Spec coverage (4a scope = content + safety net):**
- §11 author cholangitis001 `events.ts`: micro Final progression (gram -> E. coli -> sensitivities as `MicroSensitivity[]`), NPC day-2/day-3 notes, vitals trend, chronos intents -> Task 3. All present.
- §6 event kinds used: `result.release`, `encounter.append`, `vitals.append`, `note.create` -> Task 3. `encounter.append` prepends at index 0 (engine behaviour, unchanged).
- §9 NPC auto-progression + suppression by `encounterId` (derived, no flag): `revealEvents` suppression param -> Task 2; live coverage wired in `PatientWorkspace` -> Task 4; NPC notes reveal at the FOLLOWING round's `at` -> Task 3.
- §10 leak safety at EVERY reachable state + NPC notes gated through `scoreNote` at CI time -> Task 5 (extended guard) and Task 6 (walker).
- §11 CI timeline walker (reachability, monotonic `seq`, no dangling refs, one-note-per-round) -> Task 6.
- The `chronos` intent table is authored as DATA in Task 3; the matcher + UI that consume it are Plan 4b (correctly out of 4a scope).

**Placeholder scan:** every code step contains complete, compilable content; every command has an expected result. No TBD/TODO. The one deliberate discover-then-fix loop (Task 6 Step 2, the round encounters) is spelled out with the exact final array. Clean.

**Type consistency:** `revealEvents(authored, simNow, coveredEncounterIds?)` is identical in Task 2 (definition), the tests, and Task 4 (call site). `RoundSpec`/`ChronosIntent` fields (`at`/`encounterId`/`label`/`npcNoteId?`; `triggers`/`targetAt`/`reply`) match between Task 1 (types), Task 3 (authoring), and Task 6 (walker). `AuthoredEvent` `at`/`seq`/`dedupeKey?`/`event` shape matches the engine's existing definition. Micro/encounter/note payloads use existing `ClinicalMicro`/`Encounter`/`ClinicalNote` fields verified against `src/types.ts`.
