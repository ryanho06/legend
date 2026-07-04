import type { ClinicalDocument } from "../../types";
import { NotePreview } from "../chart/NotePreview";
import { LabReport } from "./LabReport";
import { MicroReport } from "./MicroReport";
import { ReportPreview } from "./ReportPreview";

/**
 * Right-rail viewer for the document opened from a Chart Review encounter row.
 * Switches on `kind`: notes -> NotePreview, labs -> LabReport, micro -> MicroReport,
 * everything else (letters, imaging reports, orders, the admission summary) -> ReportPreview.
 */
export function DocumentPanel({
  document,
  onClose,
}: {
  document: ClinicalDocument | null;
  onClose: () => void;
}) {
  if (!document) {
    return (
      <div className="report-empty">
        <p>No document open</p>
        <p className="summary-muted">Select an encounter in Chart Review to view its document.</p>
      </div>
    );
  }

  switch (document.kind) {
    case "note":
      return <NotePreview note={document} onClose={onClose} />;
    case "lab":
      return <LabReport lab={document} onClose={onClose} />;
    case "micro":
      return <MicroReport micro={document} onClose={onClose} />;
    default:
      return <ReportPreview report={document} onClose={onClose} />;
  }
}
