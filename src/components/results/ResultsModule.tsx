import { useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import {
  imaging,
  labPanels,
  microbiology,
  resultColumns,
  resultTree,
  type NarrativeResult,
} from "../../data/results";
import { ResultsFlowsheet } from "./ResultsFlowsheet";
import { ResultsTree } from "./ResultsTree";

/**
 * Results Review module: category tree on the left, results on the right.
 * Numeric lab categories render as a time-grid flowsheet; Microbiology and
 * Imaging render as narrative result cards.
 */
export function ResultsModule() {
  const [selected, setSelected] = useState("all");

  // Map the selected tree node to the panels shown in the grid. "all"/"lab"
  // show every numeric panel; a leaf id shows just that panel.
  const gridPanels =
    selected === "all" || selected === "lab"
      ? labPanels
      : labPanels.filter((panel) => panel.id === selected);

  return (
    <section className="results-module">
      <div className="chart-title-row">
        <h1>Results Review</h1>
        <div className="chart-title-actions">
          <button>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button>
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      <div className="results-body">
        <ResultsTree tree={resultTree} selected={selected} onSelect={setSelected} />

        <div className="results-content">
          {selected === "micro" && (
            <NarrativeList title="Microbiology" results={microbiology} />
          )}
          {selected === "imaging" && <NarrativeList title="Imaging" results={imaging} />}
          {selected !== "micro" && selected !== "imaging" && (
            <ResultsFlowsheet panels={gridPanels} columns={resultColumns} />
          )}

          <p className="results-disclaimer">
            All patient data are synthetic. For education and simulation only. Not for clinical
            use.
          </p>
        </div>
      </div>
    </section>
  );
}

function NarrativeList({ title, results }: { title: string; results: NarrativeResult[] }) {
  return (
    <div className="narrative-results">
      <div className="panel-heading">{title}</div>
      {results.map((result, index) => (
        <article key={`${result.test}-${index}`} className="narrative-card">
          <div className="narrative-head">
            <span className="narrative-test">{result.test}</span>
            <span className={`narrative-status ${result.status.toLowerCase()}`}>
              {result.status}
            </span>
          </div>
          <div className="narrative-collected">{result.collected}</div>
          <p className="narrative-body">{result.body}</p>
        </article>
      ))}
    </div>
  );
}
