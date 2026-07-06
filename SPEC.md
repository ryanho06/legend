# Spec: Multi-case foundation (registry + patient switching)

Status: IN PROGRESS (2026-07-06). Previous spec (note feedback loop): DONE, shipped
and verified; its design record lives in git history (SPEC.md @ 8fff625) and its
decisions are folded into CLAUDE.md.

## Goal

Turn the single hardwired case into a case *platform*: a typed registry of case
bundles, an Epic-style patient list grouped by specialty, and closable patient tabs.
After this, adding a case = dropping a folder under `src/data/patients/<caseId>/`
plus one registry line (which is exactly what Cowork-generated cases need), documented
in CASE_AUTHORING.md.

## Decisions (locked)

- **Group the patient list by specialty, not discharge location.** Students pick
  cases by rotation/topic; unit lists are bed-management noise in a sim. Epic itself
  has service-dept lists, so the chrome stays authentic. cholangitis001 files under
  General Surgery (its admitting service).
- **No stub patients.** Only real, openable cases appear in the list (today: one).
  The specialty rail renders with one list; Cowork cases fill it in.
- **Closing the last patient tab auto-opens the patient list** (full-screen
  activity, like Epic's Patient Lists). No dead empty-workspace state.
- **Opening a patient lands on Notes** (demo call-to-action), same as today's
  landing tab. Switching back to an already-open patient preserves that patient's
  workspace state (tab, chart sub-tab, selected document, open drafts).
- **Patient tabs mirror the note-preview tabs' behavior**: equal-width shrink as
  tabs multiply, freeze-on-close so the tab under the cursor stays put. Sit in a
  strip below TopSystemBar (see references/EMR/epic_chartreviewpage.png).
- **The hamburger button (TopSystemBar, currently a placeholder) opens the patient
  list** as the same full-screen activity.
- **Drafts and feedback are case-scoped.** A draft written on one patient must
  never render on another. Sign-out clears every `legend-*` localStorage key, not
  just one case's.

## Data model

`src/types.ts` additions (shapes finalized against the moved data, not invented):

```ts
export type CasePatient = { /* current patient.json shape */ };

export type CaseBundle = {
  id: string;                    // folder name, e.g. "cholangitis001"
  specialty: string;             // patient-list grouping, e.g. "General Surgery"
  /** One-line handoff summary shown in the patient list row. */
  handoff: string;
  patient: CasePatient;
  documents: ClinicalDocument[];
  notes: ClinicalNote[];         // kind:"note" subset (existing convention)
  encounters: Encounter[];
  rubric: CaseRubric;
  summary: SummaryData;          // current data/summary.ts shape
  bloods: BloodsData;            // current data/chart.ts shape
};
```

Registry: `src/data/patients/index.ts` exports `caseRegistry: CaseBundle[]` and a
`getCase(id)` helper. Case content that today lives in shared files but is really
cholangitis content moves INTO the folder: `patient.json`, `summary.ts`, `chart.ts`
bloods. The shared files' *types* stay shared.

Active-case delivery: a `CaseContext` (React context) provides the active
`CaseBundle` to the components that today import case data statically
(PatientSidebar, ReportBanner, SummaryModule, ResultsModule, WrapUp*). Everything
already receiving props keeps receiving props.

## App state (multi-case)

- `openCaseIds: string[]` + `activeCaseId: string | null` (null -> patient list).
- Per-case workspace state (mainTab, chartTab, selectedDocId) and per-case draft
  editors live in maps keyed by caseId at App level, so in-memory drafts survive
  tab switches. User notes already persist per case (`userNotesKey(caseId)`).
- `signOut()` drops the caseId parameter and clears all `legend-*` keys.
- TopSystemBar environment text derives from the active case instead of the
  hardcoded "REHAB / ORTHO / GENERAL SURGERY — AMELIA HART" string.

## UI

1. **PatientTabBar** (`components/layout/`): strip below TopSystemBar. One tab per
   open case: "SURNAME, Forename" + close X. Active tab highlighted; click focuses.
2. **PatientListPage** (`components/panels/` or own folder): full-screen activity.
   Left rail: "My Lists" grouped by specialty (one entry per specialty present in
   the registry, with counts). Main table: Bed | Patient Name | MRN | Handoff
   summary | Service. Single click opens the case (adds tab, focuses, lands on
   Notes). Keep the Epic-yellow selected-row look; bottom preview pane is out of
   scope for v1.
3. Preserve all disclaimers. One stylesheet (App.css), no CSS modules.

## Build order

1. **Phase 1 — registry refactor (no visible change).** Move case content into the
   folder, add CaseBundle/registry/CaseContext, thread the active case (still
   always cholangitis001). Verify: `tsc -b`, tests, lint, and the app pixel-equal
   in the browser.
2. **Phase 2 — patient switching UI.** PatientTabBar, PatientListPage, hamburger
   wiring, auto-open-on-last-close, per-case state maps, all-keys sign-out.
   Verify in browser: open/close/reopen, drafts stay case-scoped, dock scores the
   right case.
3. **Phase 3 — CASE_AUTHORING.md.** The Cowork-facing spec: folder layout, type
   contracts, encounterId linking, timestamp/date conventions, rubric + model-note
   authoring rules, disclaimers, registry hookup, and the verification commands a
   generated case must pass.

Each phase lands with `tsc -b` + `npm test` + `npm run lint` green before the next.

## Constraints (carried)

- `MainTab`/`ChartTab` stay in sync with `tabs.ts`.
- Times: epoch-second `timestamp` on note-kind docs; DD/MM/YYYY display dates.
- Don't fork the static document store; localStorage user notes stay the only
  runtime store.
- Lint carries ONE pre-existing StickyNotePopup error; do not drive-by fix.
