# Authoring a Legend case

This is the contract for adding a training case, written for both humans and
coding agents (Cowork). A case is one folder under `src/data/patients/<caseId>/`
plus one entry in `src/data/patients/index.ts`. Nothing else in the app changes.
`cholangitis001` is the reference implementation: when this document and that
folder disagree, the folder wins, and this document should be fixed.

The gate is mechanical: a case that passes the checklist at the bottom is
integrated; one that does not is not. `npx tsc -b` enforces every shape below.

## What makes a good case (clinical design)

- **One teaching spine.** A case exists to punish a specific reasoning failure
  (cholangitis001 punishes anchoring: epigastric pain that looks like
  dyspepsia). Decide the failure first, then build the chart around it.
- **One safety catch minimum.** Something in the chart that a careless note
  misses at the patient's expense (allergy vs prescription, a held med, a
  pending result nobody chased). These become `critical` rubric items.
- **Atypical but realistic.** The presentation should be off-pattern enough
  that pattern-matching fails, without becoming a zebra.
- **Everything synthetic.** Invented names, no real patients or clinicians,
  MRN in the `LEG-0000NN` series (unique across the registry). Keep the
  disclaimer sentence in report bodies where the existing case has it:
  "All patient data are synthetic. For education and simulation only. Not for
  clinical use."

## Folder layout

```
src/data/patients/<caseId>/
  patient.json     demographics, care team, allergies, sticky-note seed
  summary.ts       exports one CaseSummary object
  bloods.ts        exports bloods: BloodRow[]
  documents.ts     exports the ClinicalDocument[] and its kind:"note" subset
  encounters.ts    exports the Encounter[] timeline
  rubric.ts        exports the CaseRubric (items + model note)
  rubric.test.ts   vitest content tests (required, see below)
```

`<caseId>` is condition plus a three-digit serial, lowercase: `cholangitis001`.
Export names are prefixed with the case, e.g. `caseAppendicitis001Documents`.

## Type contracts

All shapes live in `src/types.ts` and are checked by `tsc`. The registry entry
is a `CaseBundle`; read that type first. Key fields with non-obvious rules:

- **`patient.json`** must match `CasePatient` exactly. `mrn` is the display
  MRN (`LEG-0000NN`); the folder name is the case id. `stickyNote` seeds the
  trainee's scratchpad: write it as terse revision pointers that hint at the
  teaching spine without solving it outright.
- **Documents** (`ClinicalDocument`, discriminated on `kind`):
  - Every document carries an `encounterId` pointing at a row in
    `encounters.ts`. An encounter row resolves its primary document by that
    link, preferring a non-note document over a note.
  - `kind:"note"` documents carry `timestamp` (Unix epoch **seconds**), the
    Notes list sort key. Display strings (`dateOfService`, `fileTime`) are
    separate hand-written fields; keep them consistent with the timestamp.
  - Report kinds (`letter`/`report`/`order`/`encounterSummary`) and the
    structured `lab`/`micro` kinds have **no** timestamp; they are reached
    through their encounter row.
  - The admission bloods receipt must be **generated from `bloods.ts`**, not
    retyped (see how cholangitis001 `documents.ts` maps `bloods` into
    `LabRow[]`). One source, no drift.
- **Doctor IDs and the player persona**:
  - Staff can carry a synthetic doctor ID (`d` + 6 digits, ranges d0-d8; d9 is
    reserved for runtime-generated logins). Give a note an `authorId` to make it
    attributable to a person. To let the trainee play a specific clinician in a
    case (their notes become addendable as "yours"), set that clinician's ID as
    `playerHcpId` on the case's registry entry in `src/data/patients/index.ts`.
    Notes without an `authorId` are ownable by nobody. Example: cholangitis001
    sets `playerHcpId: "d284617"` (Mensah, Daniel) and stamps his four notes.
- **Encounters** (`Encounter[]`):
  - Array order IS the timeline display order, newest first. The recency
    `group` headers ("2 Weeks Ago") are hand-tuned per row, not computed.
  - `date` is DD/MM/YYYY, never a relative label. `class` drives the filter
    bar (`inpatient` | `outpatient` | `ed`); set `admission: true` only on
    the admission event itself.
- **`summary.ts`** is one `CaseSummary` object: the Summary dashboard
  (vitals trend, problems, meds, weights, micro one-liners). Vitals should
  tell the same story as the notes (a septic patient trends septic).

## Rubric authoring (the hard part)

The rubric is what turns a chart into feedback; budget more review time here
than for the chart itself.

- Aim for 12 to 15 items across the four categories: `safety`, `findings`,
  `assessment`, `plan`. Mark genuine patient-harm omissions `critical`.
- Trigger semantics (`RubricTrigger = string[][]`): an item matches if ANY
  trigger matches; a trigger matches if EVERY group in it has a hit; a group
  hits if ANY of its synonym phrases appears. Matching is lowercase,
  punctuation-stripped, with one-typo tolerance on words of 5+ letters.
  Example: `[["bilirubin"], ["raised", "elevated", "high"]]` requires
  bilirubin plus any qualifier.
- Author triggers against the actual chart wording and your model note, not
  from imagination. Synonyms should cover how a student would phrase it, not
  every English paraphrase (a Claude judge for paraphrase-heavy items is a
  separate roadmap stage).
- `wordBand` sets the conciseness band for the note type; the model note must
  sit inside it. `sections` lists expected section headers (OR within a
  group): these score "organized".
- `modelNote` is a consultant-standard plain-text note, revealed only after
  scoring. It must hit every rubric item: that is tested, not aspirational.
- **`rubric.test.ts` is required** and must at minimum mirror
  `cholangitis001/rubric.test.ts`:
  1. the model note matches every item (no misses, no critical misses),
  2. the model note is inside its own word band,
  3. the model note contains every expected section,
  4. a deliberately dangerous note trips each critical item,
  5. every item has a label, explanation, at least one trigger, and PDQI tags.

## Registry hookup

Add one entry to `src/data/patients/index.ts`:

- `id`: the folder name.
- `specialty`: the patient-list grouping (admitting service, e.g. "General
  Surgery", "Emergency Medicine"). New specialty strings create new lists
  automatically.
- `handoff`: one line for the patient-list row, in handover voice:
  "64F, epigastric pain + rigors + new jaundice. ?Acute cholangitis (TG18 II),
  for urgent ERCP."

## Acceptance checklist

Run all of these; every one must pass before the case is done.

```bash
npx tsc -b        # shapes match; no missing fields
npm test          # includes your rubric.test.ts
npm run lint      # one pre-existing StickyNotePopup error is known; add none
npm run dev
```

Then in the browser:

1. The case appears in Patient Lists under its specialty; the row opens it.
2. Every encounter row opens a document; labs and micro render as receipts.
3. The Notes list is ordered newest-first and every note body renders.
4. Write a note from the model note, Sign it, and confirm the Performance
   dock scores at or near full marks; write a careless note and confirm the
   critical catches fire as unsafe omissions.
5. Sign out and confirm the case resets cleanly.
