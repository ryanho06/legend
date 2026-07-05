import type { ReactNode } from "react";
import patient from "../../data/patient.json";

/**
 * Epic-style letter "page" chrome: hospital header (logo + department),
 * patient identifiers, a disclaimer footer, with the document body as
 * children. Shared by NotePreview and ReportPreview so notes and chart-review
 * documents render on the same stationery.
 */
export function LetterPage({
  deptLine,
  children,
}: {
  deptLine: string;
  children: ReactNode;
}) {
  return (
    <div className="note-page">
      <div className="note-page-header">
        <div className="note-page-brand">
          <span className="brand-logo">M</span>
          <div>
            <div className="note-page-hospital">Mount Verdant Hospital</div>
            <div className="note-page-dept">{deptLine}</div>
          </div>
        </div>
        <div className="note-page-patient">
          <div>
            <strong>{patient.displayName}</strong> · {patient.sex}, {patient.age}
          </div>
          <div>
            MRN {patient.caseId} · DOB {patient.dob}
          </div>
        </div>
      </div>

      {children}

      <div className="note-page-footer">
        <span>
          All patient data are synthetic. For education and simulation only. Not
          for clinical use.
        </span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
}
