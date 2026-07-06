import { useCase } from "../../context/CaseContext";

/**
 * Institution / patient header for structured result reports (labs, micro),
 * mirroring an Epic/Beaker printout: a simulation warning banner, the issuing
 * lab, the report date/time, and a patient demographics block.
 */
export function ReportBanner({
  reportType,
  reportedAt,
}: {
  reportType: string;
  reportedAt: string;
}) {
  const { patient } = useCase();
  return (
    <div className="report-banner">
      <div className="report-banner-warn">
        SIMULATION — synthetic data, not for clinical use
      </div>
      <div className="report-banner-head">
        <div className="report-banner-org">
          <div className="report-banner-brand">LegendCare</div>
          <div className="report-banner-sub">
            Mount Verdant Hospital · Department of Clinical Laboratories
          </div>
          <div className="report-banner-line">{reportType}</div>
          <div className="report-banner-line">Report Date/Time: {reportedAt}</div>
        </div>
        <div className="report-banner-pt">
          <div className="report-banner-ptname">
            {patient.displayName} · {patient.mrn}
          </div>
          <div className="report-banner-line">
            {patient.sex}, {patient.age} yrs · DOB {patient.dob}
          </div>
          <div className="report-banner-line">Location: {patient.location}</div>
        </div>
      </div>
    </div>
  );
}
