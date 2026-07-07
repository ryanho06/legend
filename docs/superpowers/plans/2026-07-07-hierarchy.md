# Hierarchy System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grade-aware cases: trainees pick a grade at sign-in, cases declare their expected task/seniority, the patient list surfaces it, signing above your grade scores -1000, and PROGRESS/PTWR SmartText cover the junior and senior note tasks.

**Architecture:** `Grade` type in types.ts; rank/label/role logic pure in new `src/lib/grades.ts`. Case task lives in each case's rubric.ts (`CaseRubric.task`, required — tsc sweeps all 12 cases). Overreach is computed at display time in WrapUpModule. SmartText `build()` widens to receive the whole `CaseBundle` so PROGRESS can autofill vitals + labs.

**Tech Stack:** React 19 + TypeScript + Vite, vitest for `src/lib`, single stylesheet `src/App.css`.

**Spec:** `docs/superpowers/specs/2026-07-07-hierarchy-design.md`

## Global Constraints

- Grades: `fy` < `st3` < `consultant`; UK-first labels "FY1-2 (PGY1-2 · ST1-2)", "ST3+ (PGY3+)", "Consultant (Attending)". No student tier.
- All styling in `src/App.css`, appended after existing rules. `src/lib` pure/React-free, vitest-tested; strict TDD where a task says so.
- **11 case folders (all except cholangitis001) and `src/data/patients/index.ts` are user-modified/untracked WIP. Tasks EDIT the 11 rubric.ts files but commit ONLY cholangitis001's; never stage the WIP folders, index.ts, or verify_hypercalcaemia.cjs.**
- Component work verified by `npx tsc -b` + `npm run lint`; browser verification is centralized after all tasks.
- Verify loop: `npx tsc -b`, `npm test`, `npm run lint`. Commit per task; never push.

---

### Task 1: Grade type + grades lib + identity/authorship plumbing — TDD

**Files:**
- Modify: `src/types.ts` (UserProfile ~line 201, CaseRubric ~line 272)
- Create: `src/lib/grades.ts`
- Test: `src/lib/grades.test.ts` (new), `src/lib/userNotes.test.ts` (update expectations)
- Modify: `src/lib/userNotes.ts`, `src/components/SignInPage.tsx`, `src/App.tsx`

**Interfaces:**
- Produces (later tasks rely on exact names): `Grade`, `CaseTask` in types.ts; `GRADES`, `gradeRank(g)`, `gradeLabel(g)`, `isOverreach(userGrade, minGrade)`, `gradeCredential(g)`, `gradeAuthorRole(g)` in grades.ts; `UserProfile.grade: Grade`; `CaseRubric.task: CaseTask` (REQUIRED — the build breaks until Task 2 adds task to all 12 rubrics, so Task 1's verify step runs ONLY the lib tests, not `tsc -b`; the full loop lands in Task 2).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/grades.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  GRADES,
  gradeAuthorRole,
  gradeCredential,
  gradeLabel,
  gradeRank,
  isOverreach,
} from "./grades";

describe("grade order", () => {
  test("fy < st3 < consultant", () => {
    expect(gradeRank("fy")).toBeLessThan(gradeRank("st3"));
    expect(gradeRank("st3")).toBeLessThan(gradeRank("consultant"));
    expect(GRADES.map((g) => g.key)).toEqual(["fy", "st3", "consultant"]);
  });
});

describe("gradeLabel", () => {
  test("UK-first with US equivalent", () => {
    expect(gradeLabel("fy")).toBe("FY1-2 (PGY1-2 · ST1-2)");
    expect(gradeLabel("st3")).toBe("ST3+ (PGY3+)");
    expect(gradeLabel("consultant")).toBe("Consultant (Attending)");
  });
});

describe("isOverreach", () => {
  test("signing above your grade is overreach", () => {
    expect(isOverreach("fy", "st3")).toBe(true);
    expect(isOverreach("fy", "consultant")).toBe(true);
    expect(isOverreach("st3", "consultant")).toBe(true);
  });

  test("at or below your grade is fine", () => {
    expect(isOverreach("fy", "fy")).toBe(false);
    expect(isOverreach("st3", "fy")).toBe(false);
    expect(isOverreach("st3", "st3")).toBe(false);
    expect(isOverreach("consultant", "st3")).toBe(false);
    expect(isOverreach("consultant", "consultant")).toBe(false);
  });
});

describe("authorship by grade", () => {
  test("all doctors are MD", () => {
    expect(gradeCredential("fy")).toBe("MD");
    expect(gradeCredential("consultant")).toBe("MD");
  });

  test("author role follows grade", () => {
    expect(gradeAuthorRole("fy")).toBe("*PHYSICIAN: RESIDENT");
    expect(gradeAuthorRole("st3")).toBe("*PHYSICIAN: REGISTRAR");
    expect(gradeAuthorRole("consultant")).toBe("*PHYSICIAN: FACULTY");
  });
});
```


In `src/lib/userNotes.test.ts`, update grade-dependent expectations:
- The `testUser` fixture gains `grade: "fy" as const` (import type stays `UserProfile`).
- `buildUserNote` tests: expected `credential` becomes `"MD"`, `authorRole` becomes `"*PHYSICIAN: RESIDENT"`. If the existing tests asserted `"MS"`/`"*MEDICAL STUDENT"`, change those assertions.
- `buildAddendumBlock` test: expected stamp becomes `"ADDENDUM — Lee, Jordan, MD — 07/07/2026 09:05:\nSeen again post ERCP."`.
- Add one grade-variation test:

```ts
test("consultant addendum stamps MD too, role follows grade on filed notes", () => {
  const consultant: UserProfile = { ...testUser, grade: "consultant" };
  const draft: NoteDraft = { id: "draft-2", noteType: "Progress Note", service: "(A) GS", body: "" };
  const note = buildUserNote(draft, consultant, "text", "signed", new Date(2026, 6, 7));
  expect(note.credential).toBe("MD");
  expect(note.authorRole).toBe("*PHYSICIAN: FACULTY");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/grades.test.ts src/lib/userNotes.test.ts`
Expected: FAIL — `./grades` unresolved; userNotes tests fail on `grade` missing / MS vs MD.

- [ ] **Step 3: Types**

`src/types.ts` — add near UserProfile:

```ts
/** Doctor seniority tiers; rank order fy < st3 < consultant. */
export type Grade = "fy" | "st3" | "consultant";

/** The note task a case expects; shown in the patient list. Signing a case
 * above your grade triggers the overreach penalty in Wrap-Up. */
export type CaseTask = {
  code: "progress" | "ward" | "ptwr" | "ed";
  label: string;
  minGrade: Grade;
};
```

`UserProfile` gains `grade: Grade;` (after `hcpId`). `CaseRubric` gains (after `noteType`):

```ts
  task: CaseTask;
```

- [ ] **Step 4: Implement `src/lib/grades.ts`**

```ts
import type { Grade } from "../types";

/** Seniority tiers in rank order, UK-first with US equivalents. */
export const GRADES: { key: Grade; label: string; usLabel: string }[] = [
  { key: "fy", label: "FY1-2", usLabel: "PGY1-2 · ST1-2" },
  { key: "st3", label: "ST3+", usLabel: "PGY3+" },
  { key: "consultant", label: "Consultant", usLabel: "Attending" },
];

export function gradeRank(grade: Grade): number {
  return GRADES.findIndex((entry) => entry.key === grade);
}

export function gradeLabel(grade: Grade): string {
  const entry = GRADES.find((e) => e.key === grade);
  return entry ? `${entry.label} (${entry.usLabel})` : grade;
}

/** Signing a case above your own grade. */
export function isOverreach(userGrade: Grade, minGrade: Grade): boolean {
  return gradeRank(userGrade) < gradeRank(minGrade);
}

/** All current tiers are doctors; a function so future professions slot in. */
export function gradeCredential(_grade: Grade): string {
  return "MD";
}

export function gradeAuthorRole(grade: Grade): string {
  switch (grade) {
    case "fy":
      return "*PHYSICIAN: RESIDENT";
    case "st3":
      return "*PHYSICIAN: REGISTRAR";
    case "consultant":
      return "*PHYSICIAN: FACULTY";
  }
}
```

- [ ] **Step 5: Grade-driven authorship in `src/lib/userNotes.ts`**

Import `gradeAuthorRole, gradeCredential` from `./grades`. In `buildUserNote`, replace the hardcoded lines:

```ts
    credential: gradeCredential(user.grade),
    authorRole: gradeAuthorRole(user.grade),
```

In `buildAddendumBlock`, replace the hardcoded `, MS` with the grade credential:

```ts
  return `ADDENDUM — ${user.surname.trim()}, ${user.forename.trim()}, ${gradeCredential(user.grade)} — ${stamp}:\n${text}`;
```

(`refileUserNote` needs no change — it spreads the original note, whose authorship was stamped at creation.)

- [ ] **Step 6: Sign-in + parse gate**

`src/components/SignInPage.tsx` — add grade state and a "Hierarchy" field below the name fields, and include it in `onComplete`:

```tsx
import { GRADES } from "../lib/grades";
import type { Grade, UserProfile } from "../types";
// state:
const [grade, setGrade] = useState<Grade>("fy");
// in the form, after the Last name field:
<label className="signin-field">
  Hierarchy
  <select value={grade} onChange={(event) => setGrade(event.target.value as Grade)}>
    {GRADES.map((entry) => (
      <option key={entry.key} value={entry.key}>
        {entry.label} ({entry.usLabel})
      </option>
    ))}
  </select>
</label>
// submit:
onComplete({ forename: forename.trim(), surname: surname.trim(), hcpId: generateHcpId(), grade });
```

`src/App.tsx` `parseUser` — add `typeof parsed.grade === "string" &&` to the guard (pre-grade profiles re-gate, same as the hcpId change).

- [ ] **Step 7: Run the lib tests**

Run: `npx vitest run src/lib/grades.test.ts src/lib/userNotes.test.ts`
Expected: PASS. Do NOT run `npx tsc -b` yet — `CaseRubric.task` is required and no rubric has it until Task 2; the whole-project type-check intentionally fails at this boundary.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/lib/grades.ts src/lib/grades.test.ts src/lib/userNotes.ts src/lib/userNotes.test.ts src/components/SignInPage.tsx src/App.tsx
git commit -m "Grades: fy/st3/consultant tiers, sign-in Hierarchy field, grade-driven authorship"
```

---

### Task 2: Case task data (all 12 rubrics) + CASE_AUTHORING.md

**Files:**
- Modify: `src/data/patients/*/rubric.ts` (12 files — but see commit scope)
- Modify: `CASE_AUTHORING.md`

**Interfaces:**
- Consumes: `CaseRubric.task` / `CaseTask` from Task 1.
- Produces: a compiling project again (`tsc -b` green); every case declares its task.

- [ ] **Step 1: Add `task` to each rubric**

In each case's `rubric.ts`, add the `task` field to the exported `CaseRubric` object, directly after its `noteType` line. Exact values:

| File | task line |
|---|---|
| cholangitis001/rubric.ts | `task: { code: "ptwr", label: "POST-TAKE WARD ROUND", minGrade: "st3" },` |
| delirium001/rubric.ts | `task: { code: "ptwr", label: "POST-TAKE WARD ROUND", minGrade: "st3" },` |
| hypercalcaemia001/rubric.ts | `task: { code: "ptwr", label: "POST-TAKE WARD ROUND", minGrade: "st3" },` |
| mesischaemia001/rubric.ts | `task: { code: "ptwr", label: "POST-TAKE WARD ROUND", minGrade: "st3" },` |
| dissection001/rubric.ts | `task: { code: "ed", label: "ED REVIEW", minGrade: "st3" },` |
| dka001/rubric.ts | `task: { code: "ed", label: "ED REVIEW", minGrade: "st3" },` |
| neutropenicsepsis001/rubric.ts | `task: { code: "ed", label: "ED REVIEW", minGrade: "st3" },` |
| appendicitis001/rubric.ts | `task: { code: "ward", label: "WARD ROUND REVIEW", minGrade: "fy" },` |
| gibleed001/rubric.ts | `task: { code: "ward", label: "WARD ROUND REVIEW", minGrade: "fy" },` |
| nstemi001/rubric.ts | `task: { code: "ward", label: "WARD ROUND REVIEW", minGrade: "fy" },` |
| pe001/rubric.ts | `task: { code: "ward", label: "WARD ROUND REVIEW", minGrade: "fy" },` |
| subdural001/rubric.ts | `task: { code: "ward", label: "WARD ROUND REVIEW", minGrade: "fy" },` |

- [ ] **Step 2: CASE_AUTHORING.md**

In the section documenting rubric.ts (match the file's existing bullet style, as with the doctor-ID entry), add:

```markdown
- **Task & hierarchy** (rubric.ts `task`): every case declares the note task it
  expects — `code` (`progress` | `ward` | `ptwr` | `ed`), a display `label`
  (e.g. "POST-TAKE WARD ROUND"), and `minGrade` (`fy` | `st3` | `consultant`).
  The patient list shows it and sorts easiest-first; signing a case above your
  grade scores -1000 (overreach). Authoring targets: FY-level cases are
  hospital-day-2+ progress-note scenarios (`code: "progress"`, `minGrade: "fy"`)
  whose twist is recognizable and escalatable by a junior — size the rubric
  `wordBand` generously, since the PROGRESS SmartText embeds vitals and labs
  (~60-100 words). Consultant-level cases (`minGrade: "consultant"`) hinge on
  judgment and ownership: complex multi-problem post-takes, ceiling-of-care and
  end-of-life decisions, major post-intervention complications, cross-specialty
  conflict.
```

- [ ] **Step 3: Verify (the full loop returns)**

Run: `npx tsc -b && npm test && npm run lint`
Expected: all clean — this proves every rubric got the field.

- [ ] **Step 4: Commit (cholangitis001 + docs ONLY)**

```bash
git add src/data/patients/cholangitis001/rubric.ts CASE_AUTHORING.md
git commit -m "Case tasks: rubric declares task + minGrade; authoring guidance for FY and consultant tiers"
git status --short src/data/patients/ | head   # the 11 WIP folders must remain uncommitted
```

---

### Task 3: SmartText — bundle-aware build, PROGRESS rebuild, PTWR — TDD

**Files:**
- Modify: `src/lib/smarttext.ts`, `src/lib/smarttext.test.ts`
- Modify: `src/components/notes/NoteEditor.tsx` (build call + NOTE_TYPES)
- Modify: `src/lib/userNotes.ts` (CATEGORY_BY_TYPE)

**Interfaces:**
- Consumes: `CaseBundle` (with `summary.vitalsTrend: VitalsPoint[]`, `bloods: BloodRow[]`), Task 2's rubric.task (only via test fixture).
- Produces: `SmartPhrase.build(bundle: CaseBundle, admissionDate: string): string`; phrase ids `HP` (unchanged output), `PROGRESS` (rebuilt), `PTWR` (new). NoteEditor calls `phrase.build(activeCase, admissionDate)`.

- [ ] **Step 1: Rewrite the template tests**

In `src/lib/smarttext.test.ts`: keep the existing `patient` fixture; add a minimal typed bundle and rewrite the describe blocks that call `build`:

```ts
import type { BloodRow, CaseBundle, CaseRubric, CaseSummary, VitalsPoint } from "../types";

const vitals: VitalsPoint = { t: "07/07 06:00", sys: 128, dia: 76, hr: 91, resp: 18, spo2: 95, tempC: 37.8 };

const bloods: BloodRow[] = [
  { test: "WBC", value: "14.2", range: "4.0-11.0", flag: "H" },
  { test: "Na", value: "138", range: "133-146", flag: "" },
];

const rubric: CaseRubric = {
  caseId: "test001",
  noteType: "Progress Notes",
  task: { code: "ward", label: "WARD ROUND REVIEW", minGrade: "fy" },
  items: [],
  wordBand: { target: 200, max: 400 },
  sections: [],
  modelNote: "",
};

const summary: CaseSummary = {
  workingDiagnosis: "test",
  vitalsTrend: [
    { ...vitals, t: "06/07 06:00", hr: 80 },
    vitals, // last point is what PROGRESS must use
  ],
  activeProblems: [],
  ipMeds: [],
  weights: [],
  firstWeight: { date: "01/07", kg: 70 },
  microbiology: [],
  linesDrains: [],
  diseaseReports: [],
};

const bundle: CaseBundle = {
  id: "test001",
  specialty: "General Medicine",
  handoff: "",
  patient,
  documents: [],
  notes: [],
  encounters: [],
  rubric,
  summary,
  bloods,
};
```

(If `WeightEntry`'s real shape differs from `{ date, kg }`, match the real type — check types.ts while writing; everything else must type-check without casts.)

Update the HP describe to `hp.build(bundle, "01/07/2026")` — all existing HP assertions stay identical (HP reads only `bundle.patient`).

Replace the PROGRESS describe:

```ts
describe("PROGRESS template", () => {
  const progress = SMART_PHRASES.find((p) => p.id === "PROGRESS")!;
  const html = progress.build(bundle, "01/07/2026");

  test("header autofills name, room, specialty; hospital day is a wildcard", () => {
    expect(html).toContain("Bennett, Sandra | RM AMU Bay 7 | GENERAL MEDICINE PROGRESS NOTE - HOSPITAL DAY: ");
  });

  test("vitals line uses the LAST trend point", () => {
    expect(html).toContain("T 37.8 · HR 91 · BP 128/76 · RR 18 · SpO2 95%");
    expect(html).not.toContain("HR 80");
  });

  test("labs render every blood row with value, range and flag", () => {
    expect(html).toContain("WBC 14.2 (4.0-11.0) H");
    expect(html).toContain("Na 138 (133-146)");
  });

  test("exam bullets and closing fields are wildcards; 15 chips total", () => {
    for (const stub of ["Gen - ", "CV - ", "Lungs - ", "Abd - ", "Extremities - ", "Neuro - ", "IVF: ", "Diet: ", "DVT prophylaxis: "]) {
      expect(html).toContain(stub);
    }
    expect((html.match(/st-wildcard/g) ?? []).length).toBe(15);
  });

  test("has the section headers", () => {
    for (const header of ["INTERVAL HISTORY:", "SUBJECTIVE:", "OBJECTIVE:", "LABS:", "IMAGING:", "MICRO:", "ASSESSMENT & PLAN:"]) {
      expect(html).toContain(header);
    }
  });
});
```

Add the PTWR describe:

```ts
describe("PTWR template", () => {
  const ptwr = SMART_PHRASES.find((p) => p.id === "PTWR")!;
  const html = ptwr.build(bundle, "01/07/2026");

  test("stems with demographics and admission date", () => {
    expect(html).toContain("POST-TAKE WARD ROUND — General Medicine");
    expect(html).toContain("Bennett, Sandra is a 57yr old female admitted 01/07/2026 with ");
  });

  test("7 chips: seen-with, stem, exam, impression, three plan items", () => {
    expect((html.match(/st-wildcard/g) ?? []).length).toBe(7);
    for (const header of ["Seen with: ", "EXAMINATION:", "IMPRESSION:", "PLAN:"]) {
      expect(html).toContain(header);
    }
  });
});
```

Also update the plainTextToEditorHtml describe only if imports shift — its behavior is untouched.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/smarttext.test.ts`
Expected: FAIL — build signature mismatch, PROGRESS content, PTWR missing.

- [ ] **Step 3: Implement in `src/lib/smarttext.ts`**

Change the type and both existing phrases:

```ts
import type { CaseBundle, CasePatient } from "../types";
// SmartPhrase:
  build: (bundle: CaseBundle, admissionDate: string) => string;
// HP: build: ({ patient }, admissionDate) => [ ...unchanged body... ]
```

Replace PROGRESS with (uses the existing `line`/`heading`/`section`/`BLANK`/`WILDCARD`/`escapeHtml` helpers):

```ts
  {
    id: "PROGRESS",
    label: "Progress Note",
    description: "Daily progress note with vitals and labs pulled from the chart",
    build: (bundle) => {
      const { patient, summary, bloods } = bundle;
      const latest = summary.vitalsTrend.at(-1);
      const vitalsLine = latest
        ? line(
            escapeHtml(
              `T ${latest.tempC} · HR ${latest.hr} · BP ${latest.sys}/${latest.dia} · RR ${latest.resp} · SpO2 ${latest.spo2}%`,
            ),
          )
        : line(WILDCARD);
      const labLines = bloods.map((row) =>
        line(
          escapeHtml(
            `${row.test} ${row.value} (${row.range})${row.flag ? ` ${row.flag}` : ""}`,
          ),
        ),
      );
      const exam = ["Gen", "CV", "Lungs", "Abd", "Extremities", "Neuro"].map(
        (system) => line(`${system} - ${WILDCARD}`),
      );
      return [
        line(
          `<b>${escapeHtml(patient.displayName)} | RM ${escapeHtml(patient.location)} | ${escapeHtml(patient.specialty.toUpperCase())} PROGRESS NOTE - HOSPITAL DAY:</b> ${WILDCARD}`,
        ),
        BLANK,
        section("INTERVAL HISTORY:"),
        BLANK,
        section("SUBJECTIVE:"),
        BLANK,
        heading("OBJECTIVE:"),
        vitalsLine,
        ...exam,
        heading("LABS:"),
        ...labLines,
        heading("IMAGING:"),
        line(WILDCARD),
        heading("MICRO:"),
        line(WILDCARD),
        BLANK,
        section("ASSESSMENT & PLAN:"),
        BLANK,
        line(`IVF: ${WILDCARD}`),
        line(`Diet: ${WILDCARD}`),
        line(`DVT prophylaxis: ${WILDCARD}`),
      ].join("");
    },
  },
```

Add PTWR after PROGRESS:

```ts
  {
    id: "PTWR",
    label: "Post-Take Ward Round",
    description: "Senior post-take review shell",
    build: ({ patient, specialty }, admissionDate) =>
      [
        heading(`POST-TAKE WARD ROUND — ${escapeHtml(specialty)}`),
        line(`Seen with: ${WILDCARD}`),
        BLANK,
        line(
          `${escapeHtml(patient.displayName)} is a ${patient.age}yr old ` +
            `${escapeHtml(patient.sex.toLowerCase())} admitted ${escapeHtml(admissionDate)} with ${WILDCARD}`,
        ),
        BLANK,
        section("EXAMINATION:"),
        BLANK,
        section("IMPRESSION:"),
        BLANK,
        heading("PLAN:"),
        line(`1. ${WILDCARD}`),
        line(`2. ${WILDCARD}`),
        line(`3. ${WILDCARD}`),
      ].join(""),
  },
```

Chip counts to respect: PROGRESS = 1 (hospital day) + 1 (interval) + 1 (subjective) + 6 (exam) + 1 (imaging) + 1 (micro) + 1 (A&P) + 3 (IVF/diet/DVT) = 15 with vitals present. PTWR = 7.

- [ ] **Step 4: NoteEditor + note types**

`src/components/notes/NoteEditor.tsx`:
- `const { patient, encounters } = useCase();` becomes `const activeCase = useCase();` with `const { encounters } = activeCase;` (keep whatever the file still needs; `patient` may become unused — remove it if so).
- In `insertPhrase`: `const html = phrase.build(activeCase, admissionDate);`
- `NOTE_TYPES` array gains `"Post-Take Ward Round"` (after "Progress Note").

`src/lib/userNotes.ts` `CATEGORY_BY_TYPE` gains:

```ts
  "Post-Take Ward Round": "Progress",
```

- [ ] **Step 5: Run tests, then the full loop**

Run: `npx vitest run src/lib/smarttext.test.ts` → PASS.
Then `npx tsc -b && npm test && npm run lint` → all clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/smarttext.ts src/lib/smarttext.test.ts src/lib/userNotes.ts src/components/notes/NoteEditor.tsx
git commit -m "SmartText: bundle-aware builds; PROGRESS embeds vitals+labs; new PTWR shell"
```

---

### Task 4: Patient list Hierarchy column + overreach panel

**Files:**
- Modify: `src/components/patients/PatientListPage.tsx`
- Modify: `src/components/PatientWorkspace.tsx` (thread `user` into WrapUpDock)
- Modify: `src/components/wrapup/WrapUpDock.tsx`, `src/components/wrapup/WrapUpModule.tsx`
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `gradeRank`, `gradeLabel`, `isOverreach` from `src/lib/grades`; `rubric.task` on every bundle; `scoreNote(text, rubric).possible` (existing); `UserProfile.grade`.
- Produces: end-user behavior only.

- [ ] **Step 1: PatientListPage — Hierarchy column + sort**

Imports: `import { gradeLabel, gradeRank } from "../../lib/grades";`

Replace the rows line:

```tsx
const rows = caseRegistry
  .filter((c) => c.specialty === selected)
  .slice()
  .sort((a, b) => gradeRank(a.rubric.task.minGrade) - gradeRank(b.rubric.task.minGrade));
```

Header cell `<th>Service</th>` becomes `<th>Hierarchy</th>`. Row cell `<td>{c.patient.specialty}</td>` becomes:

```tsx
<td className="patient-list-hierarchy">
  <span className={`task-badge task-${c.rubric.task.code}`}>
    {c.rubric.task.code.toUpperCase()}
  </span>
  <span className="task-label">{c.rubric.task.label}</span>
  <span className="task-grade">{gradeLabel(c.rubric.task.minGrade)}</span>
</td>
```

- [ ] **Step 2: Thread user into the wrap-up surfaces**

`PatientWorkspace.tsx`: `<WrapUpDock ... user={user} />`.
`WrapUpDock.tsx`: accept `user: UserProfile` and pass `user={user}` to `<WrapUpModule>` (add the type import).
`WrapUpModule.tsx`: accept `user: UserProfile`.

- [ ] **Step 3: Overreach override in WrapUpModule**

Imports: `import { gradeLabel, isOverreach } from "../../lib/grades";` and change `const { rubric } = useCase();` — it already destructures rubric; that stays.

In the render, replace the `{attempt ? <FeedbackReport .../> : ...}` head:

```tsx
{attempt ? (
  isOverreach(user.grade, rubric.task.minGrade) ? (
    <div className="wrapup-overreach">
      <div className="wrapup-overreach-score">
        -1000 / {scoreNote(attempt.text, rubric).possible}
      </div>
      <h2>Acting above your competence</h2>
      <p>
        You signed a {rubric.task.label} as {gradeLabel(user.grade)} — this case
        expects {gradeLabel(rubric.task.minGrade)}. Escalate to your senior;
        do not improvise senior reviews.
      </p>
      <button onClick={() => setStoredAttempt("")}>Try another note</button>
    </div>
  ) : (
    <FeedbackReport
      result={scoreNote(attempt.text, rubric)}
      rubric={rubric}
      text={attempt.text}
      scoredAt={attempt.at}
      onReset={() => setStoredAttempt("")}
    />
  )
) : /* existing empty/candidates branches unchanged */}
```

(The model note stays hidden in the overreach branch by construction — FeedbackReport never renders.)

- [ ] **Step 4: CSS (append to `src/App.css`)**

```css
.patient-list-hierarchy {
  white-space: nowrap;
}

.patient-list-hierarchy .task-badge {
  display: inline-block;
  padding: 0 5px;
  margin-right: 6px;
  border-radius: 2px;
  font-weight: bold;
  font-size: 10px;
  background: #dce8f5;
  border: 1px solid #9db4c8;
}

.patient-list-hierarchy .task-badge.task-ptwr,
.patient-list-hierarchy .task-badge.task-ed {
  background: #f5dede;
  border-color: #c89d9d;
}

.patient-list-hierarchy .task-label {
  margin-right: 6px;
}

.patient-list-hierarchy .task-grade {
  color: #5a6b7a;
  font-size: 11px;
}

.wrapup-overreach {
  margin: 18px auto;
  max-width: 460px;
  border: 2px solid #b03030;
  background: #fdf1f1;
  padding: 18px;
  text-align: center;
}

.wrapup-overreach-score {
  font-size: 28px;
  font-weight: bold;
  color: #b03030;
}

.wrapup-overreach h2 {
  margin: 8px 0 6px;
}

.wrapup-overreach p {
  margin: 0 0 12px;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm test && npm run lint`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/patients/PatientListPage.tsx src/components/PatientWorkspace.tsx src/components/wrapup/WrapUpDock.tsx src/components/wrapup/WrapUpModule.tsx src/App.css
git commit -m "Hierarchy UI: patient-list task column sorted easiest-first; -1000 overreach panel"
```

---

### Post-plan verification (controller, not a task)

Browser checklist: fresh sign-in shows the Hierarchy dropdown (FY1-2 default) and old profiles re-gate; patient list shows the Hierarchy column with ward cases above ptwr/ed within each specialty; as FY1-2, sign a note on a ward case → normal rubric score, authorship MD / *PHYSICIAN: RESIDENT; sign on a ptwr case → -1000/⟨max⟩ overreach panel, no model note visible; re-sign-in as ST3+ → same ptwr case scores normally; PROGRESS SmartText renders real latest vitals + all blood rows + 15 chips; PTWR renders with 7 chips and "Post-Take Ward Round" appears in the note-type dropdown; addendum stamp now reads ", MD".
