import { useMemo, useState } from "react";
import { AlertTriangle, FileText, Info, Printer, RefreshCw } from "lucide-react";
import { TabStrip } from "../layout/TabStrip";
import { chartTabs } from "../../data/tabs";
import type { ChartTab, ClinicalDocument, Encounter, Note } from "../../types";
import { EncounterTable } from "./EncounterTable";
import { LabsPanel } from "./LabsPanel";
import { NotesBrowser } from "./NotesBrowser";

type FilterKey = "inpatient" | "outpatient" | "admissions" | "ed";

const ENCOUNTER_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "inpatient", label: "Inpatient" },
  { key: "outpatient", label: "Outpatient" },
  { key: "admissions", label: "Admissions" },
  { key: "ed", label: "ED only" },
];

/** Epic semantics: no filter active shows everything; active filters union (OR). */
function matchesFilters(encounter: Encounter, active: Set<FilterKey>): boolean {
  if (active.size === 0) return true;
  if (active.has("inpatient") && encounter.class === "inpatient") return true;
  if (active.has("outpatient") && encounter.class === "outpatient") return true;
  if (active.has("ed") && encounter.class === "ed") return true;
  if (active.has("admissions") && encounter.admission) return true;
  return false;
}

export function ChartReview({
  chartTab,
  setChartTab,
  encounters,
  documents,
  notes,
  selectedDocId,
  onSelectDocument,
  onNewNote,
}: {
  chartTab: ChartTab;
  setChartTab: (tab: ChartTab) => void;
  encounters: Encounter[];
  documents: ClinicalDocument[];
  notes: Note[];
  selectedDocId: string | null;
  onSelectDocument: (docId: string) => void;
  onNewNote: () => void;
}) {
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());

  function toggleFilter(key: FilterKey) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleEncounters = useMemo(
    () => encounters.filter((encounter) => matchesFilters(encounter, filters)),
    [encounters, filters],
  );

  return (
    <section className="chart-review">
      <div className="chart-title-row">
        <div>
          <h1>Chart Review</h1>
        </div>

        <div className="chart-title-actions">
          <button>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button>
            <Printer size={14} />
            Print
          </button>
          <button>Log Out</button>
        </div>
      </div>

      <TabStrip variant="sub" tabs={chartTabs} selected={chartTab} onSelect={setChartTab} />

      <ChartToolbar />

      {chartTab === "encounters" && (
        <div className="chart-filters">
          <span className="chart-filters-label">
            <Info size={13} />
            Filters
          </span>
          {ENCOUNTER_FILTERS.map((filter) => (
            <label key={filter.key} className="chart-filter">
              <input
                type="checkbox"
                checked={filters.has(filter.key)}
                onChange={() => toggleFilter(filter.key)}
              />
              {filter.label}
            </label>
          ))}
          <div className="toolbar-spacer" />
          <button onClick={() => setFilters(new Set())}>Clear Filters</button>
          <button className="on-toggle">On</button>
        </div>
      )}

      {noticeOpen && (
        <div className="yellow-notice">
          <AlertTriangle size={15} />
          Not all records have been loaded and sorted. Load remaining records to sort all records.
          <button>Load Additional Records</button>
          <button onClick={() => setNoticeOpen(false)}>Hide</button>
        </div>
      )}

      <div className="chart-panel">
        {chartTab === "encounters" && (
          <EncounterTable
            encounters={visibleEncounters}
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDocument={onSelectDocument}
          />
        )}
        {chartTab === "notes" && <NotesBrowser notes={notes} onNewNote={onNewNote} />}
        {chartTab === "labs" && <LabsPanel />}
        {chartTab !== "encounters" && chartTab !== "notes" && chartTab !== "labs" && (
          <GenericChartTab label={chartTabs.find((t) => t.key === chartTab)?.label ?? ""} />
        )}
      </div>
    </section>
  );
}

function ChartToolbar() {
  return (
    <div className="chart-toolbar">
      <button>Preview</button>
      <button>
        <RefreshCw size={13} />
        Refresh
      </button>
      <button>Encounter</button>
      <button>Route</button>
      <button>External Image Exchange</button>
      <button>Image Archive</button>
      <button>More ▾</button>
      <div className="toolbar-spacer" />
    </div>
  );
}

function GenericChartTab({ label }: { label: string }) {
  return (
    <div className="generic-tab">
      <FileText size={32} />
      <h2>{label}</h2>
      <p>
        Placeholder module for future synthetic EHR training content.
      </p>
    </div>
  );
}
