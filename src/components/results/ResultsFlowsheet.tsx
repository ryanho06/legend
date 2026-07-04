import { useEffect, useRef, useState } from "react";
import type { AnalytePanel, AnalyteRow, Cell, ResultColumn, ResultFlag } from "../../data/results";

/** Trailing empty columns, so the grid fills the pane width like a real EMR. */
const BLANK_COLS = 6;

/** Hover dwell before the detail tooltip appears (ms); resets on each new cell. */
const TOOLTIP_DELAY = 250;

type TipState = {
  x: number;
  y: number;
  name: string;
  unit: string;
  range: string;
  collected: string;
  source: string;
  value: string;
  flag?: ResultFlag;
};

/**
 * Compact time-grid flowsheet: one tight row per analyte, one column per
 * collection time, plus trailing blank columns for continuity. Reference range
 * and units live in a hover tooltip (Epic-style) that only appears after a
 * short dwell, since a competent user usually just scans the grid. Abnormal
 * values are shown by colour alone (high = red, low = blue), no H/L glyphs.
 */
export function ResultsFlowsheet({
  panels,
  columns,
}: {
  panels: AnalytePanel[];
  columns: ResultColumn[];
}) {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<TipState | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function enterCell(event: React.MouseEvent, row: AnalyteRow, col: ResultColumn, cell: Cell) {
    pending.current = {
      x: event.clientX,
      y: event.clientY,
      name: row.name,
      unit: row.unit,
      range: row.range,
      collected: col.collected,
      source: col.source,
      value: cell.value,
      flag: cell.flag,
    };
    // New cell: hide any current tooltip and restart the dwell timer.
    setTip(null);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTip(pending.current), TOOLTIP_DELAY);
  }

  function moveCell(event: React.MouseEvent) {
    setTip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
  }

  function leaveCell() {
    if (timer.current) window.clearTimeout(timer.current);
    pending.current = null;
    setTip(null);
  }

  const blanks = Array.from({ length: BLANK_COLS });

  return (
    <div className="results-grid-wrap">
      <table className="results-grid">
        <thead>
          <tr>
            <th className="component-col">Component</th>
            {columns.map((col) => (
              <th key={col.id} className="value-col">
                <div className="result-col-date">{col.date}</div>
                <div className="result-col-time">{col.time}</div>
              </th>
            ))}
            {blanks.map((_, index) => (
              <th key={`blank-${index}`} className="value-col blank" />
            ))}
          </tr>
        </thead>

        <tbody>
          {panels.map((panel) => (
            <PanelRows
              key={panel.id}
              panel={panel}
              columns={columns}
              onEnter={enterCell}
              onMove={moveCell}
              onLeave={leaveCell}
            />
          ))}
        </tbody>
      </table>

      {tip && <ResultTooltip tip={tip} />}
    </div>
  );
}

function PanelRows({
  panel,
  columns,
  onEnter,
  onMove,
  onLeave,
}: {
  panel: AnalytePanel;
  columns: ResultColumn[];
  onEnter: (e: React.MouseEvent, row: AnalyteRow, col: ResultColumn, cell: Cell) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  return (
    <>
      <tr className="result-group-row">
        <td colSpan={columns.length + BLANK_COLS + 1}>{panel.label}</td>
      </tr>
      {panel.rows.map((row) => (
        <tr key={row.name}>
          <td className="component-col">{row.name}</td>
          {columns.map((col) => {
            const cell = row.values[col.id];
            if (!cell) return <td key={col.id} className="value-col empty" />;

            const low = cell.flag === "L" || cell.flag === "LL";
            const high = cell.flag === "H" || cell.flag === "HH";
            const cls = ["value-col", cell.flag ? "abnormal" : "", low ? "low" : "", high ? "high" : ""]
              .filter(Boolean)
              .join(" ");

            return (
              <td
                key={col.id}
                className={cls}
                onMouseEnter={(e) => onEnter(e, row, col, cell)}
                onMouseMove={onMove}
                onMouseLeave={onLeave}
              >
                {cell.value}
              </td>
            );
          })}
          {Array.from({ length: BLANK_COLS }).map((_, index) => (
            <td key={`blank-${index}`} className="value-col blank" />
          ))}
        </tr>
      ))}
    </>
  );
}

function ResultTooltip({ tip }: { tip: TipState }) {
  // Flip to the other side of the cursor near a viewport edge so it stays on-screen.
  const flipX = tip.x > window.innerWidth - 250;
  const flipY = tip.y > window.innerHeight - 170;
  const style: React.CSSProperties = {
    left: flipX ? tip.x - 234 : tip.x + 16,
    top: flipY ? tip.y - 150 : tip.y + 16,
  };

  return (
    <div className="result-tooltip" style={style}>
      <div className="result-tooltip-name">{tip.name}</div>
      <div className="result-tooltip-collected">
        {tip.collected} (Collected) · {tip.source}
      </div>
      <div className="result-tooltip-value">
        {tip.value}
        {tip.flag && <span className="result-tooltip-flag">{tip.flag}</span>}
        {tip.unit && <span className="result-tooltip-unit">{tip.unit}</span>}
      </div>
      <div className="result-tooltip-ref">
        Ref range: {tip.range}
        {tip.unit ? ` ${tip.unit}` : ""}
      </div>
    </div>
  );
}
