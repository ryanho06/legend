import { useState } from "react";
import {
  Copy,
  FilePlus2,
  PenLine,
  Printer,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import type { Note } from "../../types";
import { formatClinician } from "../../lib/clinician";
import { reflowNoteBody } from "../../lib/reflow";
import { SKIP_DELETE_CONFIRM_KEY } from "../../lib/session";
import { LetterPage } from "../panels/LetterPage";

/**
 * Read-only preview of the selected note, rendered as an Epic-style letter
 * page (hospital header, body, disclaimer footer). Used both in the notes
 * browser split and the right-rail document viewer; pass `onClose` to show a
 * close control, `onDelete` (user-authored notes only) to arm Delete,
 * `onEdit` to reopen an incomplete note as a draft, and `onAddendum` to open
 * an addendum draft targeting this note.
 */
export function NotePreview({
  note,
  onClose,
  onDelete,
  onEdit,
  onAddendum,
}: {
  note: Note | null;
  onClose?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onAddendum?: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [skipChecked, setSkipChecked] = useState(false);

  function requestDelete() {
    if (!onDelete) return;
    if (window.localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === "1") {
      onDelete();
      return;
    }
    setSkipChecked(false);
    setConfirmOpen(true);
  }

  function confirmDelete() {
    if (skipChecked) window.localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, "1");
    setConfirmOpen(false);
    onDelete?.();
  }

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
        {note.status === "incomplete" && onEdit ? (
          <button onClick={onEdit}>
            <PenLine size={13} />
            Edit
          </button>
        ) : (
          <button
            disabled={!onAddendum}
            title={
              onAddendum
                ? "Append an addendum to this note"
                : note.status === "incomplete"
                  ? "Incomplete notes cannot be addended"
                  : "Only your own notes can be addended"
            }
            onClick={onAddendum}
          >
            <FilePlus2 size={13} />
            Addendum
          </button>
        )}
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
        <button
          className="danger"
          disabled={!onDelete}
          title={onDelete ? "Delete this note" : "Only your own notes can be deleted"}
          onClick={requestDelete}
        >
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
        <LetterPage deptLine={note.service}>
          <div className="note-preview-head">
            <div>
              <div className="note-preview-author">
                {formatClinician(note.author, note.credential)}
              </div>
              <div className="note-preview-role">
                {note.authorRole}
                {note.authorId ? ` · ${note.authorId}` : ""}
              </div>
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
              {note.authorId ? ` (${note.authorId})` : ""}
              <br />
              {note.service}
            </div>
          )}
        </LetterPage>
      </div>

      {confirmOpen && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-card">
            <p>
              Delete <strong>{note.noteType}</strong>? This cannot be undone.
            </p>
            <label className="confirm-skip">
              <input
                type="checkbox"
                checked={skipChecked}
                onChange={(event) => setSkipChecked(event.target.checked)}
              />
              Always ignore this message
            </label>
            <div className="confirm-actions">
              <button onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="danger" onClick={confirmDelete}>
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
