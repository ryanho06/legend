import { X } from "lucide-react";
import type { ClinicalLab } from "../../types";
import { ReportBanner } from "./ReportBanner";

/** Epic/Beaker-style laboratory result report rendered in the right rail. */
export function LabReport({
  lab,
  onClose,
}: {
  lab: ClinicalLab;
  onClose: () => void;
}) {
  return (
    <section className="report-preview">
      <div className="report-preview-head">
        <span>Laboratory Report</span>
        <button title="Close" onClick={onClose}>
          <X size={13} />
        </button>
      </div>

      <div className="report-preview-body">
        <ReportBanner reportType="Laboratory Report" reportedAt={lab.reportedAt} />

        <div className="result-panel-title">
          {lab.title} <span className="result-status">({lab.status})</span>
        </div>

        <table className="result-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Value</th>
              <th>Flag</th>
              <th>Reference Range</th>
              <th>Units</th>
            </tr>
          </thead>
          <tbody>
            {lab.rows.map((row) => (
              <tr key={row.test} className={row.flag ? "result-abn" : undefined}>
                <td>{row.test}</td>
                <td className="result-value">{row.value}</td>
                <td className="result-flag">{row.flag}</td>
                <td>{row.range}</td>
                <td>{row.units}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="result-footer">
          <div>
            <span className="result-footer-label">Specimen:</span> {lab.specimen}
          </div>
          <div>
            <span className="result-footer-label">Collected:</span> {lab.collected}
            {lab.received ? ` · Received: ${lab.received}` : ""}
          </div>
          {lab.orderedBy && (
            <div>
              <span className="result-footer-label">Authorising clinician:</span>{" "}
              {lab.orderedBy}
            </div>
          )}
          {lab.resultingLab && (
            <div>
              <span className="result-footer-label">Resulting lab:</span> {lab.resultingLab}
            </div>
          )}
        </div>

        <div className="result-disclaimer">
          All patient data are synthetic. For education and simulation only. Not for clinical use.
        </div>
      </div>
    </section>
  );
}
