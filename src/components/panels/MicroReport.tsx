import { X } from "lucide-react";
import type { ClinicalMicro } from "../../types";
import { ReportBanner } from "./ReportBanner";

/**
 * Microbiology culture & sensitivity report. Renders the sensitivity matrix when
 * organisms are isolated, otherwise the preliminary "no growth to date" narrative.
 */
export function MicroReport({
  micro,
  onClose,
}: {
  micro: ClinicalMicro;
  onClose: () => void;
}) {
  const organisms = micro.organisms ?? [];

  return (
    <section className="report-preview">
      <div className="report-preview-head">
        <span>Microbiology Report</span>
        <button title="Close" onClick={onClose}>
          <X size={13} />
        </button>
      </div>

      <div className="report-preview-body">
        <ReportBanner reportType="Microbiology Report" reportedAt={micro.reportedAt} />

        <div className="result-panel-title">
          {micro.title} <span className="result-status">({micro.status})</span>
        </div>

        <div className="result-footer">
          <div>
            <span className="result-footer-label">Specimen:</span> {micro.specimen}
          </div>
          <div>
            <span className="result-footer-label">Collected:</span> {micro.collected}
            {micro.received ? ` · Received: ${micro.received}` : ""}
          </div>
        </div>

        {organisms.map((org) => (
          <div key={org.name} className="micro-org">
            <div className="micro-org-name">
              {org.name}
              {org.gramStain ? ` — ${org.gramStain}` : ""}
            </div>
            {org.sensitivities && org.sensitivities.length > 0 && (
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Antibiotic</th>
                    <th>MIC (mg/L)</th>
                    <th>Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {org.sensitivities.map((sens) => (
                    <tr key={sens.drug}>
                      <td>{sens.drug}</td>
                      <td>{sens.mic ?? ""}</td>
                      <td className={`sens-${sens.interpretation}`}>{sens.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {micro.resultText && <pre className="result-text">{micro.resultText}</pre>}

        <div className="result-disclaimer">
          All patient data are synthetic. For education and simulation only. Not for clinical use.
        </div>
      </div>
    </section>
  );
}
