import { X } from "lucide-react";
import type { Report } from "../../types";
import { reflowNoteBody } from "../../lib/reflow";
import { LetterPage } from "./LetterPage";

/**
 * Read-only preview of a chart-review document (letter, imaging report, order,
 * encounter summary). Rendered on the shared Epic-style letter page so it
 * matches the Notes previews.
 */
export function ReportPreview({
  report,
  onClose,
}: {
  report: Report;
  onClose: () => void;
}) {
  return (
    <section className="note-preview">
      <div className="note-preview-toolbar">
        <span className="report-preview-title">Report Preview</span>
        <div className="toolbar-spacer" />
        <button title="Close" onClick={onClose}>
          <X size={13} />
        </button>
      </div>

      <div className="note-preview-scroll">
        <LetterPage deptLine={report.department ?? report.type}>
          <div className="note-preview-head">
            <div>
              {report.author && (
                <div className="note-preview-author">{report.author}</div>
              )}
              {report.department && (
                <div className="note-preview-service">{report.department}</div>
              )}
            </div>
            <div className="note-preview-head-right">
              <div className="note-preview-type">{report.type}</div>
              {report.signedAt && (
                <div className="note-preview-dos">Signed: {report.signedAt}</div>
              )}
            </div>
          </div>

          <div className="note-preview-title-line">{report.title}</div>
          <pre className="note-preview-body">{reflowNoteBody(report.body)}</pre>
        </LetterPage>
      </div>
    </section>
  );
}
