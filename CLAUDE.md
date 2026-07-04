# Legend Project Guide

## Project Overview

Legend is a synthetic EHR-style training simulator for medical students and early clinical trainees.

Its purpose is to help users practice:
- chart review
- clinical documentation
- ward round notes
- handover-style synthesis
- recognizing unsafe omissions
- linking clinical cases to physiology and revision topics


Copy Epic, NHS systems, WinPath, or other proprietary systems loosely.

The UI may be inspired by common EHR patterns:
- patient sidebar
- chart tabs
- encounter table
- bloods/microbiology sections
- right context rail
- sticky notes
- alerts
- note editor

Use generic terms:
- Chart Review
- Notes
- Bloods
- Microbiology
- Imaging
- Medications
- Orders
- Synthetic Case ID

Preserve disclaimers:
"All patient data are synthetic. For education and simulation only. Not for clinical use."

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # tsc -b && vite build (type-check + production build)
npm run lint     # eslint .
```

Type-check only (fast verify loop): `npx tsc -b`

## Tech Stack

Frontend:
- Vite
- React
- TypeScript
- CSS

Installed packages:
- react / react-dom (v19)
- lucide-react (icons)
- react-resizable-panels (resizable layout; see import note below)
- recharts (Vitals trend chart)
- clsx (conditional classNames)

Important package note:
The installed `react-resizable-panels` version exports:
- Group
- Panel
- Separator

Use this import style:

```tsx
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
```

## Architecture

- `src/App.tsx`: top-level shell (fixed patient sidebar plus resizable workspace with center modules and a collapsible right rail).
- `src/components/`: grouped by area (`chart/`, `notes/`, `summary/`, `panels/`, `layout/`).
- `src/data/patients/<caseId>/`: per-case content. `documents.ts` is the single source of truth for clinical documents (a `ClinicalDocument[]`, discriminated on `kind`); `encounters.ts` is the timeline (`Encounter[]`). Both views derive from these.
- `src/data/`: shared mock data (`tabs.ts`, `summary.ts`, `chart.ts` (Labs `bloods` only), `patient.json`).
- `src/types.ts`: shared types (`MainTab`, `ChartTab`, `Encounter`, `ClinicalDocument` = `ClinicalNote` | `ClinicalReport` | `ClinicalLab` | `ClinicalMicro`, `Note`/`Report` aliases, `NoteDraft`, ...).
- `src/lib/`: small helpers (e.g. `clinician.ts` name formatting).
- `src/App.css`: single global stylesheet for the whole app.

## Gotchas

- **Tab types must match data.** `MainTab` / `ChartTab` in `src/types.ts` must stay in sync with the tab lists in `src/data/tabs.ts` (a mismatch is a build error under `tsc`).
- **One chart, many lenses.** Every clinical document lives once in `documents.ts` with a `kind` (`note` | `letter` | `report` | `order` | `encounterSummary` | `lab` | `micro`) and an `encounterId`. The Notes activity (and Chart Review > Notes sub-tab) filter to `kind: "note"` (reserved for the inpatient stay's clinical notes); `EncounterTable` resolves each row's primary document by `encounterId` (prefers a non-note file, else the matching note) and the right-rail `DocumentPanel` switches on `kind` (`NotePreview` / `LabReport` / `MicroReport` / `ReportPreview`). Structured `lab`/`micro` docs carry typed payloads rendered as Epic-style receipts (`ReportBanner` header); the admission `lab` reuses `chart.ts` `bloods` to avoid drift. Don't reintroduce a parallel report/note store, and don't move docs to `.md`/JSON without a loader.
- **Encounters are display-curated.** `Encounter` has `date` (DD/MM/YYYY, never "Today") + optional `time`, a `class` (`inpatient`|`outpatient`|`ed`) for the Chart Review filter bar, an `admission` flag (red Type + Admissions filter), and hardcoded `provider`/`deptAbbrev`/`specialty`. Filters are additive-OR; none checked = show all.
- **Times are Unix timestamps.** Note-kind documents store `timestamp` (epoch seconds) and sort by it; display strings (`dateOfService`, `fileTime`) are separate fields. Report-kind documents have no `timestamp` (reached via their encounter row); the `Encounter` timeline is curated array order, not timestamp-sorted, with a per-row `group` recency bucket.
- **One stylesheet.** All styling lives in `src/App.css`; there are no CSS modules.
- **Note editor is contentEditable.** Rich text (B/I/U, per-run font size) wraps the selection in styled `<span>`s directly (not `execCommand` for sizing), so it survives the toolbar stealing focus.
