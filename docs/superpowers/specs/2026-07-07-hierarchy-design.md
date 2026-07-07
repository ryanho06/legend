# Hierarchy: grades, case tasks, penalty, and senior SmartText

Date: 2026-07-07
Status: approved

## Goal

Cases declare the seniority of the note they expect; trainees declare their grade at sign-in. The patient list surfaces each case's task and level so trainees pick work that fits, and signing a case above your grade scores -1000 with a scope-of-practice lesson. The PROGRESS SmartText is rebuilt as an Epic-style data-rich progress note (autofilled vitals and labs), and a PTWR SmartText covers the senior task.

## Non-goals

- No Medical Student tier: only doctors write notes in the simulated hospital. Minimum grade is FY1.
- No registry (`index.ts`) changes: the case's task lives in rubric.ts (the file is user WIP).
- No new scoring rubric mechanics beyond the overreach override; rubric items are untouched.
- No nurse/pharmacist/physio grades yet (future, alongside their ID prefixes).

## Grades: `src/lib/grades.ts` (pure, unit-tested)

```ts
export type Grade = "fy" | "st3" | "consultant";
```

- `GRADES: { key: Grade; label: string; usLabel: string }[]` in rank order:
  - `fy` — "FY1-2" / "PGY1-2 · ST1-2"
  - `st3` — "ST3+" / "PGY3+"
  - `consultant` — "Consultant" / "Attending"
- `gradeRank(grade)` (0/1/2), `gradeLabel(grade)` ("FY1-2 (PGY1-2)"-style combined display), `isOverreach(userGrade, minGrade)` = `gradeRank(userGrade) < gradeRank(minGrade)`.
- Grade also drives note authorship fields (replaces the hardcoded MS/*MEDICAL STUDENT and the ", MS" addendum stamp):
  - `gradeCredential(grade)` = "MD" for all three (kept as a function for future professions).
  - `gradeAuthorRole(grade)`: fy → `*PHYSICIAN: RESIDENT`, st3 → `*PHYSICIAN: REGISTRAR`, consultant → `*PHYSICIAN: FACULTY` (matches the authorRole vocabulary already in case data).

## Case task: rubric.ts contract

`CaseRubric` gains a required `task`:

```ts
task: {
  /** Short code shown as a badge in the patient list, e.g. "ptwr". */
  code: "progress" | "ward" | "ptwr" | "ed";
  /** Full label, e.g. "POST-TAKE WARD ROUND". */
  label: string;
  minGrade: Grade;
};
```

Assignments for the 12 current cases (analyzed from rubric model notes):

| Case | code | label | minGrade |
|---|---|---|---|
| cholangitis001 | ptwr | POST-TAKE WARD ROUND | st3 |
| delirium001 | ptwr | POST-TAKE WARD ROUND | st3 |
| hypercalcaemia001 | ptwr | POST-TAKE WARD ROUND | st3 |
| mesischaemia001 | ptwr | POST-TAKE WARD ROUND | st3 |
| dissection001 | ed | ED REVIEW | st3 |
| dka001 | ed | ED REVIEW | st3 |
| neutropenicsepsis001 | ed | ED REVIEW | st3 |
| appendicitis001 | ward | WARD ROUND REVIEW | fy |
| gibleed001 | ward | WARD ROUND REVIEW | fy |
| nstemi001 | ward | WARD ROUND REVIEW | fy |
| pe001 | ward | WARD ROUND REVIEW | fy |
| subdural001 | ward | WARD ROUND REVIEW | fy |

(`progress` is reserved for the upcoming cowork-generated hospital-day-2+ cases; no current case uses it. `consultant` minGrade exists in the type for future cases; none today.)

Note: 11 of these case folders are uncommitted user WIP. Their rubric.ts edits are made in the working tree but committed ONLY for cholangitis001 (the one committed case); the rest ride with the user's case-work commit, same pattern as the index.ts playerHcpId line. `tsc` enforces the field everywhere either way.

## Sign-in: Hierarchy field

- `UserProfile` gains required `grade: Grade`. `parseUser` gates on it (pre-grade profiles re-gate to sign-in, consistent with the hcpId change).
- SignInPage adds a "Hierarchy" dropdown below the name fields with the three grades, UK-first labels with US equivalents, defaulting to FY1-2.
- `buildUserNote` and `refileUserNote` authorship: credential `gradeCredential(user.grade)`, authorRole `gradeAuthorRole(user.grade)`. `buildAddendumBlock` stamps the grade credential instead of the hardcoded ", MS".

## Penalty: overreach override

- Computed at display time in the Performance dock (no storage change): if `isOverreach(user.grade, activeCase.rubric.task.minGrade)`, the report for a scored attempt renders the gag panel instead of the rubric breakdown: score **-1000 / ⟨case max⟩**, headline "Acting above your competence", and an explanation naming the task and grades (e.g. "You signed a POST-TAKE WARD ROUND as an FY1-2. Escalate to your registrar — do not improvise senior reviews."). The model note stays hidden.
- Working at or below your grade changes nothing. Pend never triggers the penalty (only signed attempts are scored).

## Patient list

- The "Service" column becomes "Hierarchy": a task-code badge (uppercase, e.g. `PTWR`) followed by the task label and the minGrade display (e.g. "ST3+"). One new CSS badge class in App.css.
- Rows within the selected specialty list sort by `gradeRank(minGrade)` ascending (easiest first), preserving the existing specialty-rail grouping.

## SmartText

`SmartPhrase.build` signature widens from `(patient, admissionDate)` to `(caseBundle: CaseBundle, admissionDate: string)` — HP updates mechanically (reads `bundle.patient`), and the two new templates read bloods/summary. NoteEditor already has the bundle via `useCase()`.

### PROGRESS (rebuilt, modeled on `references/EMR/epic_smarttext_progress1.png`)

- Header: `⟨displayName⟩ | RM ⟨location⟩ | ⟨SPECIALTY⟩ PROGRESS NOTE - HOSPITAL DAY: ***`
- `INTERVAL HISTORY:` *** · `SUBJECTIVE:` ***
- `OBJECTIVE:` — autofilled from case data:
  - Vitals line from the LAST `summary.vitalsTrend` point: `T ⟨tempC⟩ · HR ⟨hr⟩ · BP ⟨sys⟩/⟨dia⟩ · RR ⟨resp⟩ · SpO2 ⟨spo2⟩%`
  - Exam bullets with *** slots: `Gen - ***`, `CV - ***`, `Lungs - ***`, `Abd - ***`, `Extremities - ***`, `Neuro - ***`
  - `LABS:` all rows of the case's `bloods` rendered `⟨test⟩ ⟨value⟩ (⟨range⟩)⟨flag ? " " + flag : ""⟩`, one per line (BloodRow is flat; no CBC/BMP grouping is imposed)
  - `IMAGING:` *** · `MICRO:` ***
- `ASSESSMENT & PLAN:` ***
- Footer: `IVF: ***` · `Diet: ***` · `DVT prophylaxis: ***`
- Known interaction, accepted: autofilled labs add ~60-100 words, which counts against a rubric's conciseness `wordBand`. Current cases expect review-style notes anyway; future `progress`-task cases set their `wordBand` with the template's bulk in mind (noted in CASE_AUTHORING.md guidance).

### PTWR (new)

- Header: `POST-TAKE WARD ROUND — ⟨specialty⟩` + `Seen with: ***`
- Summary stem autofilled: `⟨displayName⟩ is a ⟨age⟩yr old ⟨sex⟩ admitted ⟨admissionDate⟩ with ***`
- `EXAMINATION:` *** · `IMPRESSION:` *** · `PLAN:` `1. ***` `2. ***` `3. ***`
- Note-type list gains "Post-Take Ward Round" (category mapping → Progress).

## CASE_AUTHORING.md

Document the `task` contract (codes, labels, minGrade semantics) and authoring guidance for FY-level cases: hospital-day-2+ progress-note scenarios (`code: "progress"`, `minGrade: "fy"`), where the twist is recognizable and escalatable at FY level.

## Testing

- Vitest: grades.ts (rank order, overreach matrix, labels, role mapping), rebuilt PROGRESS (vitals line from last trend point, all blood rows present, expected wildcard count), PTWR (stem autofill, wildcard count), HP unaffected by the signature change; buildUserNote/buildAddendumBlock grade-driven authorship. Existing `rubric.test.ts` files gain nothing (task is data, enforced by tsc).
- Browser verify: sign in as FY1-2 → patient list shows Hierarchy column sorted easiest-first; sign a ward case → normal score; open a ptwr case, sign → -1000/⟨max⟩ gag panel with explanation; re-sign-in as ST3+ → same case scores normally; insert PROGRESS → real vitals/labs render, chips for the rest; insert PTWR; note authorship shows MD + grade role.
