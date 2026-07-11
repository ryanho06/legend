# Dynamic Patients Plan 4c: Contribution tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on Plans 4a and 4b being merged** (needs `CaseBundle.rounds`, the NPC notes in `events.ts`, round-aware note stamping, and the advance loop).

**Goal:** Add the private, self-only, formative contribution tracker (spec §3): per case it shows which rounds the trainee personally wrote, which the team covered, which are unreached, and neutrally flags any that are above their grade, with the rubric percentage on the one round the case's single rubric scores.

**Architecture:** The tracker is DERIVED, not a new table (spec §3): a pure `src/lib/contribution.ts` function joins the case's `rounds` (Plan 4a) against the trainee's own notes and the currently revealed NPC notes (both already in `PatientWorkspace`), scores the rubric round with the existing `scoreNote`, and returns display rows. It renders as a compact section inside the Performance dock (`WrapUpModule`), which already receives the trainee's notes and the live case. No server, no schema change: it reads state that is already client-side.

**Tech Stack:** React 19 SPA (`src/`), TypeScript strict (`npx tsc -b`), Vitest node pool (`npm test`), ESLint, Vite build, `src/App.css` for styling.

## Global Constraints

- **No forfeiture, no leaderboard, no judgment** (spec §3): the tracker is neutral and private-by-construction (it reads only the trainee's own notes + the shared chart). Overreach is flagged neutrally, never penalized here.
- **v1 single-rubric limitation (fork A):** the case ships ONE rubric, which scores the day-1 round. The tracker shows a rubric percentage ONLY for the round whose `encounterId` matches the rubric's round (round 0 / `enc-admission`); other rounds the trainee wrote show "you wrote this" with no percentage (scoring a day-2 note against the day-1 rubric would be meaningless). This is a documented v1 limitation, not a bug.
- **Derived, no new table/migration.** The tracker computes from existing client state.
- **Inert for static cases:** a case with no `rounds` produces an empty tracker, so `WrapUpModule` renders exactly as today for every non-dynamic case.
- **Prose in docs/commits: no em dashes.** Code is unaffected.
- **Verify targets:** `npx tsc -b`, `npm test`, `npm run lint`, `npm run build`, plus a browser smoke.
- **Commit to `main` locally; never push.**

## File Structure

- `src/lib/contribution.ts` + `src/lib/contribution.test.ts` — NEW: the pure tracker builder (Task 1).
- `src/components/wrapup/ContributionTracker.tsx` — NEW: the presentational component (Task 2).
- `src/components/wrapup/WrapUpModule.tsx` — render the tracker; thread `rounds` + live notes (Task 2).
- `src/App.css` — tracker styles (Task 2).

---

### Task 1: Pure contribution builder (`contribution.ts`)

**Files:**
- Create: `src/lib/contribution.ts`
- Test: `src/lib/contribution.test.ts`

**Interfaces:**
- Consumes: `RoundSpec`, `ClinicalNote`, `CaseRubric`, `Grade` (types); `scoreNote` (`./rubric`); `isOverreach` (`./grades`).
- Produces:
  - `type ContributionRow = { key: string; label: string; status: "you" | "team" | "current" | "unreached"; percent: number | null; aboveGrade: boolean }`.
  - `buildContribution(args): ContributionRow[]` where `args = { rounds, userNotes, liveNotes, rubric, userGrade, simNow }`. One row per round, in schedule order. Rules per round:
    - the trainee's own note covers the round (a `userNotes` entry with that `encounterId`) -> `you`; `percent` set only for the rubric round; `aboveGrade` = `isOverreach(userGrade, rubric.task.minGrade)`.
    - else a revealed NPC note covers it (a `liveNotes` entry with that `encounterId` that is NOT one of the trainee's) -> `team`.
    - else the round's sim-time has arrived (`simNow >= round.at`) -> `current`.
    - else -> `unreached`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/contribution.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { CaseRubric, ClinicalNote, RoundSpec } from "../types";
import { buildContribution } from "./contribution";

const rounds: RoundSpec[] = [
  { at: 0, encounterId: "enc-admission", label: "Post-take ward round (day 1)" },
  { at: 54000, encounterId: "enc-ward-round-d2", label: "Progress note (day 2)", npcNoteId: "npc-d2" },
  { at: 140400, encounterId: "enc-ward-round-d3", label: "Progress note (day 3)", npcNoteId: "npc-d3" },
];

function note(id: string, encounterId: string, body = "acute cholangitis, ERCP, hold metformin"): ClinicalNote {
  return {
    kind: "note",
    id,
    encounterId,
    category: "Progress",
    noteType: "Progress Note",
    author: "Lee, Sam",
    credential: "MD",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery",
    dateOfService: "16/06/26 1700",
    fileTime: "16/06/26 1700",
    timestamp: 1781629200,
    status: "signed",
    body,
  };
}

const rubric = {
  caseId: "x",
  noteType: "Progress Note",
  task: { code: "ptwr", label: "POST-TAKE WARD ROUND", minGrade: "st3" },
  wordBand: { target: 140, max: 240 },
  sections: [["impression"], ["plan"]],
  items: [{ id: "dx", label: "names it", category: "assessment", weight: 10, triggers: [[["cholangitis"]]], explanation: "x", pdqi: ["accurate"] }],
  modelNote: "",
} as unknown as CaseRubric;

describe("buildContribution", () => {
  test("marks a trainee-written round as 'you' with a rubric percent on the rubric round", () => {
    const userNotes = [note("u1", "enc-admission")];
    const rows = buildContribution({ rounds, userNotes, liveNotes: userNotes, rubric, userGrade: "st3", simNow: 0 });
    expect(rows[0].status).toBe("you");
    expect(rows[0].percent).toBe(100); // the note matches the single rubric item
    expect(rows[1].status).toBe("unreached");
  });

  test("a trainee-written day-2 round is 'you' with no percent (single-rubric limitation)", () => {
    const userNotes = [note("u2", "enc-ward-round-d2")];
    const rows = buildContribution({ rounds, userNotes, liveNotes: userNotes, rubric, userGrade: "st3", simNow: 140400 });
    expect(rows[1].status).toBe("you");
    expect(rows[1].percent).toBeNull();
  });

  test("a revealed NPC note marks the round 'team'", () => {
    const npc = note("npc-d2", "enc-ward-round-d2", "day 2 recovering well");
    const rows = buildContribution({ rounds, userNotes: [], liveNotes: [npc], rubric, userGrade: "st3", simNow: 208800 });
    expect(rows[1].status).toBe("team");
  });

  test("a reached-but-empty round is 'current', a future round 'unreached'", () => {
    const rows = buildContribution({ rounds, userNotes: [], liveNotes: [], rubric, userGrade: "st3", simNow: 54000 });
    expect(rows[0].status).toBe("current"); // simNow 54000 >= round 0 at 0, no note
    expect(rows[1].status).toBe("current"); // simNow 54000 >= round 1 at 54000, no note
    expect(rows[2].status).toBe("unreached"); // round 2 at 140400 > simNow
  });

  test("flags aboveGrade neutrally when the trainee is below the case grade", () => {
    const userNotes = [note("u1", "enc-admission")];
    const rows = buildContribution({ rounds, userNotes, liveNotes: userNotes, rubric, userGrade: "fy", simNow: 0 });
    expect(rows[0].aboveGrade).toBe(true);
  });

  test("empty rounds yields no rows", () => {
    expect(buildContribution({ rounds: [], userNotes: [], liveNotes: [], rubric, userGrade: "st3", simNow: 0 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- contribution`
Expected: FAIL ("Cannot find module './contribution'").

- [ ] **Step 3: Write the builder**

Create `src/lib/contribution.ts`:

```ts
import type { CaseRubric, ClinicalNote, Grade, RoundSpec } from "../types";
import { scoreNote } from "./rubric";
import { isOverreach } from "./grades";

/**
 * The contribution tracker (spec §3): private, self-only, formative. Derived
 * from the trainee's own notes joined to the case's round schedule and the
 * currently revealed chart. No table, no forfeiture, no leaderboard. Pure; no
 * React.
 *
 * v1 single-rubric limitation (fork A): a rubric percentage is shown only for
 * the round the case's one rubric scores (the round whose encounterId matches a
 * trainee note the rubric applies to, i.e. the day-1 round on enc-admission).
 * Other rounds a trainee wrote show "you wrote this" without a percentage.
 */
export type ContributionStatus = "you" | "team" | "current" | "unreached";

export type ContributionRow = {
  key: string;
  label: string;
  status: ContributionStatus;
  /** Rubric percentage for the rubric round only; null elsewhere. */
  percent: number | null;
  /** Neutral flag: the trainee is acting above the case's expected grade. */
  aboveGrade: boolean;
};

export function buildContribution(args: {
  rounds: RoundSpec[];
  userNotes: ClinicalNote[];
  liveNotes: ClinicalNote[];
  rubric: CaseRubric;
  userGrade: Grade;
  simNow: number;
}): ContributionRow[] {
  const { rounds, userNotes, liveNotes, rubric, userGrade, simNow } = args;
  const userIds = new Set(userNotes.map((n) => n.id));
  const aboveGrade = isOverreach(userGrade, rubric.task.minGrade);
  // The rubric scores the day-1 round; its encounter is where trainee notes land
  // by default (enc-admission). Percent is shown only there.
  const rubricEncounterId = "enc-admission";

  return rounds.map((round) => {
    const mine = userNotes.find((n) => n.encounterId === round.encounterId);
    if (mine) {
      const isRubricRound = round.encounterId === rubricEncounterId;
      const result = isRubricRound ? scoreNote(mine.body, rubric) : null;
      const percent =
        result && result.possible > 0 ? Math.round((100 * result.total) / result.possible) : null;
      return { key: round.encounterId, label: round.label, status: "you", percent, aboveGrade };
    }
    const npc = liveNotes.find((n) => n.encounterId === round.encounterId && !userIds.has(n.id));
    if (npc) {
      return { key: round.encounterId, label: round.label, status: "team", percent: null, aboveGrade: false };
    }
    const status: ContributionStatus = simNow >= round.at ? "current" : "unreached";
    return { key: round.encounterId, label: round.label, status, percent: null, aboveGrade: false };
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- contribution`
Expected: PASS (all six tests). Note the first test relies on the note body matching the single `cholangitis` rubric item -> `total` 10 / `possible` 10 -> 100%.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contribution.ts src/lib/contribution.test.ts
git commit -m "feat(tracker): add the pure contribution builder (rounds x notes x rubric)"
```

---

### Task 2: Render the tracker in the Performance dock

**Files:**
- Create: `src/components/wrapup/ContributionTracker.tsx`
- Modify: `src/components/wrapup/WrapUpModule.tsx` (compute rows, render the tracker)
- Modify: `src/App.css` (tracker styles)

**Interfaces:**
- Consumes: `buildContribution`/`ContributionRow` (Task 1), `useCase()` (the live case, gives `rounds` + live `notes`), the `userNotes`/`user` props `WrapUpModule` already receives, and `simNow`.
- Produces: a "Rounds covered" section at the top of the Performance dock body, rendered only when the live case has rounds.

**Note on `simNow`:** `WrapUpModule` does not currently receive `simNow`. It is rendered by `WrapUpDock`, which is rendered by `PatientWorkspace` (which has `work.simNow`). Thread `simNow` through both as a prop (Steps 3-4).

- [ ] **Step 1: Write the presentational component**

Create `src/components/wrapup/ContributionTracker.tsx`:

```tsx
import type { ContributionRow } from "../../lib/contribution";

const STATUS_LABEL: Record<ContributionRow["status"], string> = {
  you: "you wrote this",
  team: "team covered",
  current: "on the ward now",
  unreached: "not yet reached",
};

/**
 * Private, self-only round tracker (spec §3). Neutral and formative: no
 * forfeiture, no leaderboard. Shows which rounds the trainee personally wrote,
 * which the team covered, and flags any above their grade without penalty.
 */
export function ContributionTracker({ rows }: { rows: ContributionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="contribution-tracker">
      <div className="contribution-head">Rounds covered</div>
      <ul className="contribution-list">
        {rows.map((row) => (
          <li key={row.key} className={`contribution-row ${row.status}`}>
            <span className="contribution-label">{row.label}</span>
            <span className="contribution-meta">
              {row.percent !== null && <span className="contribution-percent">{row.percent}%</span>}
              <span className="contribution-status">{STATUS_LABEL[row.status]}</span>
              {row.aboveGrade && row.status === "you" && (
                <span className="contribution-above" title="Above the grade this case expects; not penalised here.">
                  above your grade
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Render it in `WrapUpModule`**

In `src/components/wrapup/WrapUpModule.tsx`:

(a) Add imports:

```ts
import { buildContribution } from "../../lib/contribution";
import { ContributionTracker } from "./ContributionTracker";
```

(b) Add `simNow` to the props type and destructuring (it is threaded from `PatientWorkspace` in Steps 3-4):

```ts
  simNow,
```
in the destructured props, and in the props type:
```ts
  simNow: number;
```

(c) After `const { rubric } = useCase();`, also read the live case for its rounds and notes, and build the rows:

```tsx
  const liveCase = useCase();
  const contribution = buildContribution({
    rounds: liveCase.rounds ?? [],
    userNotes,
    liveNotes: liveCase.notes,
    rubric,
    userGrade: user.grade,
    simNow,
  });
```

(Replace the existing `const { rubric } = useCase();` with `const liveCase = useCase(); const { rubric } = liveCase;` so both are available.)

(d) Render the tracker at the top of the module body, right after the opening `<div className={embedded ? ...}>` and before the `{!embedded && (...title...)}` block:

```tsx
      <ContributionTracker rows={contribution} />
```

- [ ] **Step 3: Thread `simNow` through `WrapUpDock`**

In `src/components/wrapup/WrapUpDock.tsx`, add `simNow: number` to the props type and destructuring, and pass it into `<WrapUpModule ... simNow={simNow} />`.

- [ ] **Step 4: Pass `simNow` from `PatientWorkspace`**

In `src/components/PatientWorkspace.tsx`, add `simNow={work.simNow}` to the `<WrapUpDock ... />` props.

- [ ] **Step 5: Add the tracker styles**

Append to `src/App.css`:

```css
/* Contribution tracker (Performance dock, spec §3). */
.contribution-tracker {
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
  background: #fafbfc;
}
.contribution-head {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}
.contribution-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.contribution-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
  padding: 3px 0;
}
.contribution-label {
  color: #1e293b;
}
.contribution-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.contribution-percent {
  font-weight: 600;
  color: #0f766e;
}
.contribution-status {
  color: #64748b;
}
.contribution-row.you .contribution-status {
  color: #0f766e;
}
.contribution-row.unreached .contribution-status {
  color: #94a3b8;
}
.contribution-above {
  color: #b45309;
  font-size: 11px;
  border: 1px solid #f5d9a8;
  background: #fef6e7;
  border-radius: 4px;
  padding: 1px 5px;
}
```

- [ ] **Step 6: Type-check, lint, build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: all PASS. `tsc` confirms the new `simNow` prop is threaded through both `WrapUpDock` and `WrapUpModule`.

- [ ] **Step 7: Browser smoke the tracker**

Run: `npm run dev`, at `http://localhost:5173` (chrome-devtools-axi):
1. Sign in, open cholangitis001, reset `simNow` to 0. Open the Performance dock. Confirm "Rounds covered" shows day 1 as "on the ward now" and days 2/3 as "not yet reached".
2. Write and Sign the day-1 Post-Take Ward Round. Confirm the dock shows the rubric score AND the tracker now marks day 1 "you wrote this" with a percentage; day 2 becomes "on the ward now".
3. Use Chronos to pull the cultures forward (from Plan 4b). Confirm days 2 and 3 flip to "team covered" (the NPC notes revealed because the rounds were skipped).
4. Sign in as an FY (grade selection at sign-in) on a fresh guest, write and sign the day-1 note, and confirm the day-1 row shows a neutral "above your grade" badge (the case expects st3) while the overreach -1000 panel still governs the score (unchanged Plan 3 behaviour).

- [ ] **Step 8: Commit**

```bash
git add src/components/wrapup/ContributionTracker.tsx src/components/wrapup/WrapUpModule.tsx src/components/wrapup/WrapUpDock.tsx src/components/PatientWorkspace.tsx src/App.css
git commit -m "feat(tracker): render the private contribution tracker in the Performance dock"
```

---

### Task 3: Full-suite verification + doc reconciliation

**Files:**
- Modify: `CLAUDE.md`, `CASE_AUTHORING.md`, `STATUS.md`

**Interfaces:**
- Consumes: everything from Plans 4a, 4b, 4c.
- Produces: green full suite + docs that match the shipped Plan 4 loop.

- [ ] **Step 1: Run the complete suite**

Run each and confirm green:
- `npx tsc -b`
- `npm test` (node pool: contribution + rounds + chronos + userNotes + reveal + applyEvents + rubric + leak guard + walker)
- `npm run test:workers` (real-D1: session monotonic clamp + all prior)
- `npm run lint`
- `npm run build`

Expected: all PASS.

- [ ] **Step 2: Update `CLAUDE.md`**

- In the `src/lib/` bullet, add the new modules: `rounds.ts` (`currentRound`/`nextRoundAt`), `chronos.ts` (`matchChronos`, deterministic, reuses `rubric.anyTriggerMatches`), `contribution.ts` (`buildContribution`, the derived tracker). Note `reveal.ts` now takes a `coveredEncounterIds` set for NPC suppression, `caseNow(anchor, offset)` takes a sim offset, and `buildUserNote(..., encounterId)` takes the round encounter.
- Extend the "sim clock" Gotcha: the clock now ADVANCES (signing a fresh round note calls `advanceSim(nextRoundAt)`; the Chronos console calls `advanceSim(targetAt)`), the server PUT clamps `MAX(...)` (forward-only), and a dynamic case authors `events`/`rounds`/`chronos` (cholangitis001 is the pilot). NPC round notes reveal at the FOLLOWING round's `at` and are suppressed once the trainee covers the round's `encounterId`.
- Add a one-line note that the contribution tracker + chronos console are the two new training overlays (floating docks: Performance bottom-left, Chronos bottom-right).

- [ ] **Step 3: Update `CASE_AUTHORING.md`**

Replace the Plan-3 `events.ts` stub with the real authoring contract, using cholangitis001 as the worked example: the three exports (`events: AuthoredEvent[]`, `rounds: RoundSpec[]`, `chronos: ChronosIntent[]`), the `at`-is-sim-offset-from-anchor rule, FLAG 1 (static epochs sit behind the anchor; measure `at` from the anchor), the NPC-note leak-safety requirement (must score zero against the rubric; the walker + leak guard enforce it), the reveal-at-following-round rule for NPC notes, and the requirement to author an `encounter.append` for any round/result that needs an Encounters-timeline row.

- [ ] **Step 4: Update `STATUS.md`**

- Move Dynamic Patients Plan 4 (4a content + safety net, 4b advance + chronos, 4c tracker) to Done with the commit range.
- Record the DECISION LOG for Plan 4: (a) rubric-fairness cursor DEFERRED (v1 scoring is text-only, so a note's score is frozen at sign by its frozen text; the leak guard + walker enforce §10; no migration 0005), (b) NPC notes reveal at the following round's `at`, (c) chronos is a floating console reusing the rubric matcher, (d) the tracker is derived (no table).
- Set the new "Next concrete step": the outstanding Ryan-gated ship gate (remote migration 0004 + `npm run deploy`) is unchanged by Plan 4 (no new migration); the hospital-select shell (own spec) and further dynamic cases (fleet time-migration, lazy) remain the post-v1 roadmap.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md CASE_AUTHORING.md STATUS.md
git commit -m "docs: reconcile CLAUDE/CASE_AUTHORING/STATUS with the Plan 4 dynamic loop"
```

---

## Self-Review (completed against DYNAMIC_PATIENTS_SPEC.md §3, §10)

**Spec coverage (4c scope = tracker + fairness):**
- §3 contribution tracker: private, self-only, formative; per-case rounds the trainee wrote vs team covered vs unreached; overreach flagged neutrally, never penalized; DERIVED, not a new table -> Task 1 (`buildContribution`) + Task 2 (render). The single-rubric percent limitation (fork A) is honoured (percent only on the rubric round).
- §10 rubric fairness: the sign-time attempt is captured before the clock advances (Plan 4b, Task 5), and because v1 scoring is text-only the frozen note text already fixes the score against the sign-time chart; the leak guard (Plan 4a, Task 5) + walker (Plan 4a, Task 6) enforce that no reachable state leaks the answers. The chart-cursor column is deliberately deferred (documented in Task 4 of this plan) because it would be inert under text-only scoring; it lands with chart-aware scoring.

**Placeholder scan:** every code step contains complete, compilable code; every command has an expected result. No TBD/TODO. Clean.

**Type consistency:** `ContributionRow` fields (`key`/`label`/`status`/`percent`/`aboveGrade`) and `buildContribution(args)` shape match between Task 1 (definition + tests) and Task 2 (`WrapUpModule` call site + `ContributionTracker` props). `simNow: number` is threaded consistently: `PatientWorkspace` -> `WrapUpDock` -> `WrapUpModule` -> `buildContribution`. `useCase()` returns the live folded bundle, so `liveCase.rounds` and `liveCase.notes` are the revealed state (NPC notes included), which is what the tracker needs.
