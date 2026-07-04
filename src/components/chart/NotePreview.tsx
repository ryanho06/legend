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

/**
 * Read-only preview of the selected note. Used both in the notes browser split
 * and the right-rail document viewer; pass `onClose` to show a close control.
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

        <pre className="note-preview-body">{note.body}</pre>

        {note.addendum && (
          <div className="note-preview-addendum">
            <strong>Addendum</strong>
            <pre className="note-preview-body">{note.addendum}</pre>
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
      </div>
    </div>
  );
}
