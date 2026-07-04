import {
  Copy,
  FilePlus2,
  Printer,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import type { Note } from "../../types";
import { formatClinician } from "../../lib/clinician";
import { reflowNoteBody } from "../../lib/reflow";
import patient from "../../data/patient.json";

/**
 * Read-only preview of the selected note, rendered as an Epic-style letter
 * page (hospital header, body, disclaimer footer). Used both in the notes
 * browser split and the right-rail document viewer; pass `onClose` to show a
 * close control.
 */
export function NotePreview({
  note,
  onClose,
}: {
  note: Note | null;
  onClose?: () => void;
}) {
  if (!note) {
    return (
      <div className="note-preview note-preview-empty">
        <p>No note selected</p>
        <p className="summary-muted">Select a note from the list to preview it.</p>
      </div>
    );
  }

  return (
    <div className="note-preview">
      <div className="note-preview-toolbar">
        <button>
          <FilePlus2 size={13} />
          Addendum
        </button>
        <button>
          <Copy size={13} />
          Copy
        </button>
        <button>
          <Stamp size={13} />
          Cosign
        </button>
        <button>
          <Printer size={13} />
          Print
        </button>
        <button className="danger">
          <Trash2 size={13} />
          Delete
        </button>
        {onClose && (
          <>
            <div className="toolbar-spacer" />
            <button title="Close" onClick={onClose}>
              <X size={13} />
            </button>
          </>
        )}
      </div>

      <div className="note-preview-scroll">
        <div className="note-page">
          <div className="note-page-header">
            <div className="note-page-brand">
              <span className="brand-logo">L</span>
              <div>
                <div className="note-page-hospital">Legend Teaching Hospital</div>
                <div className="note-page-dept">{note.service}</div>
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

          <div className="note-preview-head">
            <div>
              <div className="note-preview-author">
                {formatClinician(note.author, note.credential)}
              </div>
              <div className="note-preview-role">{note.authorRole}</div>
              <div className="note-preview-service">{note.service}</div>
            </div>
            <div className="note-preview-head-right">
              <div className="note-preview-type">{note.noteType}</div>
              <div className="note-preview-dos">
                Date of Service: {note.dateOfService}
              </div>
              {note.status !== "signed" && (
                <span className={`note-status-badge ${note.status}`}>
                  {note.status === "incomplete" ? "Incomplete" : "Needs Cosign"}
                </span>
              )}
            </div>
          </div>

          <pre className="note-preview-body">{reflowNoteBody(note.body)}</pre>

          {note.addendum && (
            <div className="note-preview-addendum">
              <strong>Addendum</strong>
              <pre className="note-preview-body">{reflowNoteBody(note.addendum)}</pre>
            </div>
          )}

          {note.status === "signed" && (
            <div className="note-preview-signoff">
              Report electronically signed by:
              <br />
              {formatClinician(note.author, note.credential)}
              <br />
              {note.service}
            </div>
          )}

          <div className="note-page-footer">
            <span>
              All patient data are synthetic. For education and simulation only.
              Not for clinical use.
            </span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
