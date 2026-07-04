import { CircleAlert } from "lucide-react";
import type { Note } from "../../types";
import { formatClinician } from "../../lib/clinician";

function initials(author: string): string {
  // Author is stored "Surname, Forename" — take first letter of each part.
  return author
    .split(/[,\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Mailbox-style list of notes; clicking a row drives the preview pane. */
export function NoteList({
  notes,
  selectedId,
  onSelect,
}: {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (notes.length === 0) {
    return (
      <div className="note-list note-list-empty">
        <p className="summary-muted">No notes in this category.</p>
      </div>
    );
  }

  return (
    <div className="note-list" role="listbox">
      {notes.map((note) => (
        <button
          key={note.id}
          role="option"
          aria-selected={note.id === selectedId}
          className={note.id === selectedId ? "note-row selected" : "note-row"}
          onClick={() => onSelect(note.id)}
        >
          <div className="note-row-avatar">{initials(note.author)}</div>

          <div className="note-row-body">
            <div className="note-row-top">
              <span className="note-row-author">
                {formatClinician(note.author, note.credential)}
              </span>
              <span className="note-row-type">
                {note.urgent && (
                  <CircleAlert
                    size={13}
                    className="note-urgent-mark"
                    aria-label="Time-critical"
                  />
                )}
                {note.noteType}
              </span>
            </div>
            <div className="note-row-role">{note.authorRole}</div>
            <div className="note-row-meta">
              <span className="meta-label">Date of Service:</span>
              <span className="meta-value">{note.dateOfService}</span>
            </div>
            <div className="note-row-meta">
              <span className="meta-label">{note.service} · File Time:</span>
              <span className="meta-value">{note.fileTime}</span>
            </div>
            {note.status !== "signed" && (
              <span className={`note-status-badge ${note.status}`}>
                {note.status === "incomplete" ? "Incomplete" : "Needs Cosign"}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
