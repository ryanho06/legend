import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Pill,
  Scale,
  Syringe,
} from "lucide-react";
import { useCase } from "../../context/CaseContext";
import { BodySilhouette } from "./BodySilhouette";
import { VitalsPanel } from "./VitalsPanel";

export function SummaryModule() {
  const { patient, bloods, summary } = useCase();
  const {
    workingDiagnosis,
    activeProblems,
    firstWeight,
    ipMeds,
    linesDrains,
    microbiology,
    weights,
  } = summary;
  return (
    <div className="summary-module">
      <div className="summary-title-row">
        <h1>Summary</h1>
      </div>

      <div className="summary-grid">
        <SummaryCard title="Patient Summary" icon={<ClipboardList size={14} />}>
          <p className="summary-text">
            {patient.age}
            {patient.sex.charAt(0)} with {patient.presentingComplaint.toLowerCase()}.{" "}
            {patient.acuity}. Working diagnosis: {workingDiagnosis}.
          </p>
        </SummaryCard>

        <SummaryCard title="Vitals" icon={<HeartPulse size={14} />} wide>
          <VitalsPanel />
        </SummaryCard>

        <SummaryCard title="Active Problems" icon={<Activity size={14} />}>
          <ul className="summary-list">
            {activeProblems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </SummaryCard>

        <SummaryCard title="Allergies" icon={<AlertTriangle size={14} />}>
          <p className="summary-danger">{patient.allergies}</p>
        </SummaryCard>

        <SummaryCard title="Current IP Meds" icon={<Pill size={14} />} wide>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Medication</th>
                <th>Conc</th>
                <th>Method</th>
                <th>Freq</th>
                <th>Last dose</th>
              </tr>
            </thead>
            <tbody>
              {ipMeds.map((m) => (
                <tr key={m.medication}>
                  <td>{m.medication}</td>
                  <td>{m.conc}</td>
                  <td>{m.method}</td>
                  <td>{m.freq}</td>
                  <td>{m.lastDose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SummaryCard>

        <SummaryCard title="Recent Labs" icon={<FlaskConical size={14} />}>
          <table className="summary-labs">
            <tbody>
              {bloods.map((b) => (
                <tr key={b.test} className="summary-lab-abn">
                  <td>{b.test}</td>
                  <td>{b.value}</td>
                  <td>{b.flag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SummaryCard>

        <SummaryCard title="Microbiology (last 21 days)" icon={<FlaskConical size={14} />}>
          {microbiology.length === 0 ? (
            <p className="summary-muted">No results in the last 21 days.</p>
          ) : (
            <table className="summary-table">
              <tbody>
                {microbiology.map((m) => (
                  <tr key={`${m.date}-${m.time}`}>
                    <td>{m.date}</td>
                    <td>{m.time}</td>
                    <td>{m.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SummaryCard>

        <SummaryCard title="Weights (Last 2)" icon={<Scale size={14} />}>
          {weights.map((w) => (
            <div key={w.when} className="summary-row">
              <span>{w.when}</span>
              <strong>{w.value}</strong>
            </div>
          ))}
          <div className="summary-row summary-row-divider">
            <span>
              1st recorded <span className="summary-muted">· {firstWeight.when}</span>
            </span>
            <strong>{firstWeight.value}</strong>
          </div>
        </SummaryCard>

        <SummaryCard title="Lines, Drains, and Airways" icon={<Syringe size={14} />}>
          <div className="lda">
            <div className="lda-figure">
              <BodySilhouette />
              {linesDrains.map((l) =>
                l.x != null && l.y != null ? (
                  <span
                    key={l.label}
                    className={`lda-marker lda-${l.kind}`}
                    style={{ left: `${l.x}%`, top: `${l.y}%` }}
                  />
                ) : null,
              )}
            </div>
            <div className="lda-list">
              <div className="lda-legend">
                <span className="lda-line">Lines</span>
                <span className="lda-drain">Drains</span>
                <span className="lda-wound">Wounds</span>
              </div>
              {linesDrains.length === 0 ? (
                <p className="summary-muted">None recorded.</p>
              ) : (
                <ul className="summary-list lda-items">
                  {linesDrains.map((l) => (
                    <li key={l.label}>
                      <span className={`lda-dot lda-${l.kind}`} />
                      {l.label} <span className="summary-muted">{l.days}d</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SummaryCard>

      </div>
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  children,
  wide,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? "summary-card wide" : "summary-card"}>
      <div className="summary-card-head">
        {icon}
        {title}
      </div>
      <div className="summary-card-body">{children}</div>
    </section>
  );
}
