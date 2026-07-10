# Dynamic Patients, Plan 1: Time Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a case a machine-readable time anchor and a timezone-deterministic display formatter, and stamp trainee notes at the case's sim-time instead of the wall clock, fixing the shipped bug where notes land dated "today" on a chart frozen at 16/06/2026.

**Architecture:** Add a pure `src/lib/simTime.ts` that formats Unix epoch seconds into the app's display strings using UTC calendar math (so a frozen chart date never shifts by timezone). Add an optional `anchor` epoch to `CaseBundle`, set it on the cholangitis001 pilot only. Route `buildUserNote` / `refileUserNote` / `buildAddendumBlock` through the formatter on an epoch-seconds argument, and change the three PatientWorkspace call sites from `new Date()` to `caseNow(activeCase.anchor)`.

**Tech Stack:** TypeScript, React 19, Vitest (node pool for `src/lib`), `tsc -b` for type-check. No new dependencies.

## Global Constraints

- Display formatting is **UTC-based** (`getUTC*`), never local `getDate()`/`getHours()`: a case authored at 16/06/2026 must render 16/06/2026 in every timezone.
- All sim times are **Unix epoch seconds** (matching `ClinicalNote.timestamp`), never milliseconds.
- `CaseBundle.anchor` is **optional**. Only cholangitis001 gets one in this plan. Cases without an anchor keep the same epoch source (`Date.now()`, unchanged), but the rendered date is now UTC like every other display in the app, not byte-identical to the old local-time display (the lazy fleet migration is out of scope).
- `buildUserNote` and the other note builders stay **pure and React-free** (they are unit-tested in the node pool).
- Do **not** touch `formatStamp` (the `DD/MM HH:MM` wrap-up attempt "at" stamp): it marks real submission time and is out of scope.
- Commit messages use no em dashes (repo voice rule); use commas, parentheses, or colons.
- Verify loop: `npx tsc -b` (type-check) and `npm test` (vitest node pool) must both be green before each commit.

---

### Task 1: `simTime` formatter module

**Files:**
- Create: `src/lib/simTime.ts`
- Test: `src/lib/simTime.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `formatDate(epochSec: number): string` returns `"DD/MM/YYYY"`.
  - `formatTime(epochSec: number): string` returns `"HH:MM"` (24h).
  - `formatNoteStamp(epochSec: number): string` returns `"DD/MM/YY HHMM"` (the note-row Date of Service / File Time stamp).
  - `caseNow(anchor: number | undefined): number` returns the case's current sim-time in epoch seconds, falling back to `Math.floor(Date.now() / 1000)` when `anchor` is undefined.

- [ ] **Step 1: Write the failing test**

Create `src/lib/simTime.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { caseNow, formatDate, formatNoteStamp, formatTime } from "./simTime";

// 16/06/2026 17:00:00 UTC — the cholangitis001 anchor used across the plan.
const anchor = Date.UTC(2026, 5, 16, 17, 0) / 1000;

describe("formatDate", () => {
  test("formats DD/MM/YYYY in UTC with zero padding", () => {
    expect(formatDate(anchor)).toBe("16/06/2026");
    expect(formatDate(Date.UTC(2026, 0, 3, 0, 0) / 1000)).toBe("03/01/2026");
  });
});

describe("formatTime", () => {
  test("formats HH:MM in UTC", () => {
    expect(formatTime(anchor)).toBe("17:00");
    expect(formatTime(Date.UTC(2026, 5, 16, 9, 5) / 1000)).toBe("09:05");
  });
});

describe("formatNoteStamp", () => {
  test("formats DD/MM/YY HHMM in UTC", () => {
    expect(formatNoteStamp(anchor)).toBe("16/06/26 1700");
    expect(formatNoteStamp(Date.UTC(2026, 6, 4, 9, 5) / 1000)).toBe("04/07/26 0905");
  });
});

describe("caseNow", () => {
  test("returns the anchor when present", () => {
    expect(caseNow(anchor)).toBe(anchor);
  });
  test("falls back to the real clock when anchor is undefined", () => {
    const before = Math.floor(Date.now() / 1000);
    const now = caseNow(undefined);
    expect(now).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- simTime`
Expected: FAIL, cannot find module `./simTime` (or the exports are undefined).

- [ ] **Step 3: Write the implementation**

Create `src/lib/simTime.ts`:

```ts
/**
 * Sim-time formatting. Every formatter takes Unix epoch SECONDS and formats in
 * UTC, so a case's authored dates render identically in every timezone: a chart
 * frozen at 16/06/2026 must never display as 15/06 for a viewer west of UTC.
 */

function parts(epochSec: number) {
  const d = new Date(epochSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dd: pad(d.getUTCDate()),
    mm: pad(d.getUTCMonth() + 1),
    yyyy: String(d.getUTCFullYear()),
    yy: pad(d.getUTCFullYear() % 100),
    hh: pad(d.getUTCHours()),
    min: pad(d.getUTCMinutes()),
  };
}

/** "DD/MM/YYYY". */
export function formatDate(epochSec: number): string {
  const p = parts(epochSec);
  return `${p.dd}/${p.mm}/${p.yyyy}`;
}

/** "HH:MM" (24h). */
export function formatTime(epochSec: number): string {
  const p = parts(epochSec);
  return `${p.hh}:${p.min}`;
}

/** "DD/MM/YY HHMM": the note-row Date of Service / File Time stamp. */
export function formatNoteStamp(epochSec: number): string {
  const p = parts(epochSec);
  return `${p.dd}/${p.mm}/${p.yy} ${p.hh}${p.min}`;
}

/**
 * The case's current sim-time in epoch seconds. Falls back to the real clock for
 * legacy cases that have no authored anchor (their notes keep stamping wall-clock
 * time, unchanged from before this module).
 */
export function caseNow(anchor: number | undefined): number {
  return anchor ?? Math.floor(Date.now() / 1000);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- simTime`
Expected: PASS (all four describe blocks).

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/simTime.ts src/lib/simTime.test.ts
git commit -m "feat(time): add UTC epoch-seconds sim-time formatter (simTime.ts)"
```

---

### Task 2: `CaseBundle.anchor` field and the cholangitis001 anchor

**Files:**
- Modify: `src/types.ts` (the `CaseBundle` type, around lines 396-413)
- Modify: `src/data/patients/index.ts` (the cholangitis001 registry entry, around lines 141-154)
- Test: `src/data/patients/anchor.test.ts`

**Interfaces:**
- Consumes: `formatDate` from `src/lib/simTime.ts` (Task 1); `getCase` from `src/data/patients/index.ts`.
- Produces: `CaseBundle.anchor?: number` (Unix epoch seconds, the case's admission/"present" datetime). `getCase("cholangitis001").anchor === 1781629200`.

- [ ] **Step 1: Write the failing test**

Create `src/data/patients/anchor.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { formatDate } from "../../lib/simTime";
import { getCase } from "./index";

describe("case anchor", () => {
  test("cholangitis001 is anchored to its frozen chart date", () => {
    const anchor = getCase("cholangitis001").anchor;
    expect(anchor).toBe(Date.UTC(2026, 5, 16, 17, 0) / 1000);
    expect(anchor).not.toBeUndefined();
    expect(formatDate(anchor as number)).toBe("16/06/2026");
  });

  test("a non-pilot case has no anchor yet (keeps wall-clock behaviour)", () => {
    expect(getCase("appendicitis001").anchor).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- anchor`
Expected: FAIL (`anchor` is `undefined` for cholangitis001, and/or `anchor` is not a property on the type so the test file may not type-check yet).

- [ ] **Step 3: Add the type field**

In `src/types.ts`, inside the `CaseBundle` type (after the `playerHcpId?` line, before `patient`), add:

```ts
  /**
   * The case's "present" datetime as Unix epoch SECONDS: the admission moment the
   * trainee documents against. Trainee notes are stamped from this (see caseNow),
   * so they sort after the authored chart with a coherent same-day date. Optional:
   * legacy cases without it fall back to the real wall clock.
   */
  anchor?: number;
```

- [ ] **Step 4: Set the pilot anchor**

In `src/data/patients/index.ts`, in the cholangitis001 registry entry, add the `anchor` field right after `playerHcpId: "d284617",`:

```ts
    playerHcpId: "d284617",
    // 16/06/2026 17:00 UTC: just after the day's latest charted note (16/06/26 1650),
    // so a signed trainee note sorts newest with a coherent same-day date.
    anchor: Date.UTC(2026, 5, 16, 17, 0) / 1000,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- anchor`
Expected: PASS (both tests).

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/data/patients/index.ts src/data/patients/anchor.test.ts
git commit -m "feat(time): add optional CaseBundle.anchor, set cholangitis001 present"
```

---

### Task 3: Stamp note builders from sim-time (epoch-seconds signature)

**Files:**
- Modify: `src/lib/userNotes.ts` (`buildUserNote` L29-56, `buildAddendumBlock` L59-63, `refileUserNote` L81-99; delete the local `formatNoteStamp` L22-27)
- Modify: `src/lib/userNotes.test.ts` (update the affected expectations)

**Interfaces:**
- Consumes: `formatDate`, `formatTime`, `formatNoteStamp` from `src/lib/simTime.ts` (Task 1).
- Produces (changed signatures, epoch seconds replace the `Date` argument):
  - `buildUserNote(draft, user, plainBody, status, nowSec: number): ClinicalNote`
  - `buildAddendumBlock(user: UserProfile, text: string, nowSec: number): string`
  - `refileUserNote(original, draft, plainBody, status, nowSec: number): ClinicalNote`
  - `formatStamp` is unchanged and still exported.

- [ ] **Step 1: Confirm the local `formatNoteStamp` has no external importers**

Run: `grep -rn "formatNoteStamp" src`
Expected: matches only in `src/lib/userNotes.ts` (its definition and two call sites) and, after this task, `src/lib/simTime.ts`. If any OTHER file imports `formatNoteStamp` from `userNotes`, re-export it from `userNotes.ts` (`export { formatNoteStamp } from "./simTime";`) instead of deleting outright. (At the time of writing there are no external importers.)

- [ ] **Step 2: Update the failing tests first**

In `src/lib/userNotes.test.ts`, make these edits:

Replace line 20:

```ts
const now = new Date(2026, 6, 4, 9, 5); // 04/07/2026 09:05 local
```

with:

```ts
const nowSec = Date.UTC(2026, 6, 4, 9, 5) / 1000; // 04/07/2026 09:05 UTC
```

In the `formatStamp` describe block (lines 22-26), leave it untouched (formatStamp still takes a `Date`); it uses its own `now`. Change that block to construct its own Date so the shared `now` rename does not break it:

```ts
describe("formatStamp", () => {
  test("formats DD/MM HH:MM with zero padding", () => {
    expect(formatStamp(new Date(2026, 6, 4, 9, 5))).toBe("04/07 09:05");
  });
});
```

In the `buildUserNote` describe block, replace every `now` argument with `nowSec`, and update the two stamp expectations and the timestamp expectation:

```ts
describe("buildUserNote", () => {
  test("builds a signed note attributed to the user", () => {
    const note = buildUserNote(draft, user, "Plan: ERCP.", "signed", nowSec);
    expect(note.kind).toBe("note");
    expect(note.author).toBe("Ho, Ryan");
    expect(note.credential).toBe("MD");
    expect(note.authorRole).toBe("*PHYSICIAN: RESIDENT");
    expect(note.status).toBe("signed");
    expect(note.body).toBe("Plan: ERCP.");
    expect(note.admission).toBe(true);
    expect(note.encounterId).toBe("enc-admission");
    expect(note.dateOfService).toBe("04/07/26 0905");
    expect(note.fileTime).toBe("04/07/26 0905");
    expect(note.timestamp).toBe(nowSec);
  });

  test("maps each editor note type to its browser category", () => {
    const cases: [string, string][] = [
      ["Progress Note", "Progress"],
      ["H&P", "H&P"],
      ["Consult Note", "Consults"],
      ["Procedure Note", "Procedures"],
      ["Nursing Note", "Nursing"],
      ["Discharge Summary", "Discharge"],
    ];
    for (const [noteType, category] of cases) {
      const note = buildUserNote({ ...draft, noteType }, user, "x", "signed", nowSec);
      expect(note.category, noteType).toBe(category);
    }
  });

  test("pended drafts become incomplete notes with a dash file time", () => {
    const note = buildUserNote(draft, user, "wip", "incomplete", nowSec);
    expect(note.status).toBe("incomplete");
    expect(note.fileTime).toBe("—");
  });

  test("server assigns the id on POST", () => {
    const a = buildUserNote(draft, user, "x", "signed", nowSec);
    const b = buildUserNote({ ...draft, id: "draft-2" }, user, "x", "signed", nowSec);
    expect(a.id).toBe("");
    expect(b.id).toBe("");
  });
});
```

In the `buildAddendumBlock / appendAddendum` describe block, replace the `Date`-based `now` (line 93) and the two `buildUserNote`/`buildAddendumBlock` calls:

```ts
describe("buildAddendumBlock / appendAddendum", () => {
  const nowSec = Date.UTC(2026, 6, 7, 9, 5) / 1000; // 07/07/2026 09:05 UTC

  test("stamps author and full date", () => {
    expect(buildAddendumBlock(testUser, "Seen again post ERCP.", nowSec)).toBe(
      "ADDENDUM — Lee, Jordan, MD — 07/07/2026 09:05:\nSeen again post ERCP.",
    );
  });

  test("consultant addendum stamps MD too, role follows grade on filed notes", () => {
    const consultant: UserProfile = { ...testUser, grade: "consultant" };
    const draft: NoteDraft = { id: "draft-2", noteType: "Progress Note", service: "(A) GS", body: "" };
    const note = buildUserNote(draft, consultant, "text", "signed", Date.UTC(2026, 6, 7) / 1000);
    expect(note.credential).toBe("MD");
    expect(note.authorRole).toBe("*PHYSICIAN: FACULTY");
  });

  test("appendAddendum stacks blocks with a blank line", () => {
    const first = buildAddendumBlock(testUser, "One.", nowSec);
    const second = buildAddendumBlock(testUser, "Two.", nowSec);
    expect(appendAddendum(undefined, first)).toBe(first);
    expect(appendAddendum(first, second)).toBe(`${first}\n\n${second}`);
  });
});
```

In the `refileUserNote` describe block, replace `now` (line 136) and update the stamp expectations:

```ts
  const nowSec = Date.UTC(2026, 6, 7, 10, 30) / 1000;

  test("keeps identity, replaces content and stamps", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "signed", nowSec);
    expect(refiled.id).toBe(original.id);
    expect(refiled.author).toBe("Lee, Jordan");
    expect(refiled.authorId).toBe("d912345");
    expect(refiled.body).toBe("NEW BODY");
    expect(refiled.status).toBe("signed");
    expect(refiled.noteType).toBe("H&P");
    expect(refiled.category).toBe("H&P");
    expect(refiled.timestamp).toBe(nowSec);
    expect(refiled.dateOfService).toBe("07/07/26 1030");
    expect(refiled.fileTime).toBe("07/07/26 1030");
  });

  test("pending again leaves fileTime em-dashed", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "incomplete", nowSec);
    expect(refiled.fileTime).toBe("—");
  });
```

In the `buildUserNote authorId` describe block (lines 158-164), update the Date argument:

```ts
describe("buildUserNote authorId", () => {
  test("stamps the login's doctor id", () => {
    const draft: NoteDraft = { id: "draft-1", noteType: "Progress Note", service: "(A) GS", body: "" };
    const note = buildUserNote(draft, testUser, "text", "signed", Date.UTC(2026, 6, 7) / 1000);
    expect(note.authorId).toBe("d912345");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- userNotes`
Expected: FAIL (builders still expect a `Date`; type errors and/or wrong stamps).

- [ ] **Step 4: Update `userNotes.ts`**

Change the imports at the top of `src/lib/userNotes.ts` to pull the formatters from `simTime`, and DELETE the local `formatNoteStamp` (lines 22-27):

```ts
import type { ClinicalNote, NoteCategory, NoteDraft, NoteStatus, UserProfile } from "../types";
import { gradeAuthorRole, gradeCredential } from "./grades";
import { formatDate, formatNoteStamp, formatTime } from "./simTime";
```

Keep `formatStamp` (lines 16-20) exactly as it is. Replace `buildUserNote` (lines 29-56) with:

```ts
export function buildUserNote(
  draft: NoteDraft,
  user: UserProfile,
  plainBody: string,
  status: NoteStatus,
  nowSec: number,
): ClinicalNote {
  const stamp = formatNoteStamp(nowSec);
  return {
    kind: "note",
    id: "", // the server assigns the real id when the note is POSTed
    encounterId: "enc-admission",
    category: CATEGORY_BY_TYPE[draft.noteType] ?? "Progress",
    noteType: draft.noteType,
    author: `${user.surname.trim()}, ${user.forename.trim()}`,
    authorId: user.hcpId,
    credential: gradeCredential(user.grade),
    authorRole: gradeAuthorRole(user.grade),
    service: draft.service,
    dateOfService: stamp,
    fileTime: status === "signed" ? stamp : "—",
    timestamp: nowSec,
    status,
    admission: true,
    body: plainBody,
  };
}
```

Replace `buildAddendumBlock` (lines 59-63) with:

```ts
/** Stamped addendum block, matching the static attestation style in case data. */
export function buildAddendumBlock(user: UserProfile, text: string, nowSec: number): string {
  const stamp = `${formatDate(nowSec)} ${formatTime(nowSec)}`;
  return `ADDENDUM — ${user.surname.trim()}, ${user.forename.trim()}, ${gradeCredential(user.grade)} — ${stamp}:\n${text}`;
}
```

Replace `refileUserNote` (lines 81-99) with:

```ts
/** Re-file an edited incomplete user note in place: same identity, new content. */
export function refileUserNote(
  original: ClinicalNote,
  draft: NoteDraft,
  plainBody: string,
  status: NoteStatus,
  nowSec: number,
): ClinicalNote {
  const stamp = formatNoteStamp(nowSec);
  return {
    ...original,
    noteType: draft.noteType,
    category: CATEGORY_BY_TYPE[draft.noteType] ?? original.category,
    body: plainBody,
    status,
    timestamp: nowSec,
    dateOfService: stamp,
    fileTime: status === "signed" ? stamp : "—",
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- userNotes`
Expected: PASS (all describe blocks).

- [ ] **Step 6: Type-check the whole project (call sites will now error)**

Run: `npx tsc -b`
Expected: errors in `src/components/PatientWorkspace.tsx` (three calls still pass `new Date()` where a `number` is now required). This is expected and is fixed in Task 4. Do not commit yet if red; proceed to Task 4, then run the full verify once.

- [ ] **Step 7: Commit**

```bash
git add src/lib/userNotes.ts src/lib/userNotes.test.ts
git commit -m "refactor(time): stamp note builders from epoch sim-time via simTime"
```

---

### Task 4: Stamp from the case anchor at the call sites

**Files:**
- Modify: `src/components/PatientWorkspace.tsx` (import at L24-29; calls at L191, L200, L202)

**Interfaces:**
- Consumes: `caseNow` from `src/lib/simTime.ts` (Task 1); `buildUserNote` / `refileUserNote` / `buildAddendumBlock` epoch signatures (Task 3); `activeCase.anchor` (Task 2).
- Produces: nothing new; wires the case anchor into the three stamp sites.

- [ ] **Step 1: Add the import**

In `src/components/PatientWorkspace.tsx`, add `caseNow` to the imports. After the `../lib/userNotes` import block (line 29), add:

```ts
import { caseNow } from "../lib/simTime";
```

- [ ] **Step 2: Replace the three `new Date()` stamps**

At line 191, change:

```ts
        await work.addAddendum(draft.targetNoteId, buildAddendumBlock(user, text, new Date()));
```

to:

```ts
        await work.addAddendum(draft.targetNoteId, buildAddendumBlock(user, text, caseNow(activeCase.anchor)));
```

At line 200, change:

```ts
        await work.refileNote(refileUserNote(target, draft, text, status, new Date()));
```

to:

```ts
        await work.refileNote(refileUserNote(target, draft, text, status, caseNow(activeCase.anchor)));
```

At line 202, change:

```ts
        await work.createNote(buildUserNote(draft, user, text, status, new Date()));
```

to:

```ts
        await work.createNote(buildUserNote(draft, user, text, status, caseNow(activeCase.anchor)));
```

- [ ] **Step 3: Type-check the whole project**

Run: `npx tsc -b`
Expected: no errors (the Task 3 call-site errors are resolved).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (all suites, including `simTime`, `anchor`, `userNotes`).

- [ ] **Step 5: Manually verify the bug is fixed**

Run: `npm run dev`, sign in, open the cholangitis001 patient, write a short note, and Sign it.
Expected: the new note appears at the top of the Notes list with Date of Service `16/06/26 1700` (the case anchor), not today's date, and it sorts above every authored note. Reopen it as an addendum: the addendum stamp reads `16/06/2026 17:00`.
Then open any other case (for example appendicitis001), sign a note, and confirm it still stamps today's wall-clock date (unchanged legacy behaviour, since that case has no anchor).

- [ ] **Step 6: Commit**

```bash
git add src/components/PatientWorkspace.tsx
git commit -m "fix(time): stamp trainee notes at the case anchor, not the wall clock"
```

---

## Self-Review

- **Spec coverage:** This plan implements `DYNAMIC_PATIENTS_SPEC.md` section 4.1 (time-model infra + formatter + `buildUserNote` wall-clock fix, pilot-first) and the section 14 risk-register item "buildUserNote wall-clock date bug is latent in shipped code; v1 forces and fixes it." The fleet migration of the other 15 cases is explicitly out of scope (spec section 13) and left as wall-clock fallback. The `applyEvents` fold, `case_event` tables, chronos, and NPC team are Plans 2 and 3, not this plan.
- **Placeholder scan:** No TBD / TODO / "handle edge cases" / "similar to Task N". Every code step shows complete code; every run step shows the command and expected result.
- **Type consistency:** `caseNow(anchor: number | undefined): number` is defined in Task 1 and consumed as `caseNow(activeCase.anchor)` in Task 4. The builder signatures gain `nowSec: number` in Task 3 and are called with `caseNow(...)` (a `number`) in Task 4. `CaseBundle.anchor?: number` (Task 2) matches `caseNow`'s `number | undefined` parameter. `formatNoteStamp` is single-sourced in `simTime.ts` after Task 3 deletes the `userNotes.ts` copy.

---

## Notes carried forward to Plan 2 (engine core)

- `caseNow(anchor)` returns a constant per static case, so multiple trainee notes in one sitting share a timestamp (they sort stably by insertion). Plan 2's `simNow` advancement gives them distinct sim-times; no change needed here.
- `simTime` formatters (`formatDate` / `formatTime` / `formatNoteStamp`) are the display layer Plan 3's `result.release` / `encounter.append` events will use to fabricate `collected` / `reportedAt` / `Encounter.date` strings from a `revealAt` offset.
