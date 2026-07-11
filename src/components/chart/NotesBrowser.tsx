import { useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  RefreshCw,
  Search,
  SquarePen,
  X,
} from "lucide-react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import type { Note, NoteCategory } from "../../types";
import { NoteList } from "./NoteList";
import { NotePreview } from "./NotePreview";

type TabKey = "All Notes" | "Admission" | NoteCategory | "Incomplete";

const NOTE_TABS: TabKey[] = [
  "All Notes",
  "Admission",
  "H&P",
  "Progress",
  "Nursing",
  "Procedures",
  "Consults",
  "ED Notes",
  "Discharge",
  "Incomplete",
];

function filterNotes(notes: Note[], tab: TabKey): Note[] {
  if (tab === "All Notes") return notes;
  if (tab === "Admission") return notes.filter((n) => n.admission);
  if (tab === "Incomplete") return notes.filter((n) => n.status === "incomplete");
  return notes.filter((n) => n.category === tab);
}

/** Epic-style text search across body, author, type and service. */
function searchNotes(notes: Note[], query: string): Note[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return notes;
  return notes.filter((note) =>
    [note.body, note.author, note.noteType, note.service, note.authorRole]
      .join("\n")
      .toLowerCase()
      .includes(needle),
  );
}

/**
 * Dense notes activity (Notes main tab): action toolbar, category tabs, text
 * search and a resizable mailbox list / preview split. Selected notes open as
 * preview tabs so several can be cross-referenced while writing in the
 * right-rail NoteEditor (opened via onNewNote).
 */
export function NotesBrowser({
  notes,
  onNewNote,
  onDeleteNote,
  onEditNote,
  onAddendumNote,
  canEdit,
  canDelete,
  openNoteIds,
  activePreviewId,
  onPreviewChange,
}: {
  notes: Note[];
  onNewNote: () => void;
  onDeleteNote: (id: string) => void;
  onEditNote: (note: Note) => void;
  onAddendumNote: (note: Note) => void;
  canEdit: (note: Note) => boolean;
  canDelete: (note: Note) => boolean;
  openNoteIds: string[];
  activePreviewId: string | null;
  onPreviewChange: (patch: { openNoteIds?: string[]; activePreviewId?: string | null }) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("All Notes");
  const [query, setQuery] = useState("");
  const listRef = useRef<PanelImperativeHandle>(null);
  const [listCollapsed, setListCollapsed] = useState(false);

  // Newest first; Unix timestamp is the sort key so mixed date labels stay correct.
  const filtered = useMemo(
    () =>
      searchNotes(filterNotes(notes, activeTab), query)
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp),
    [notes, activeTab, query],
  );

  // Preview tabs live in CaseUiState now (controlled), so they survive main-tab
  // switches and reload. An empty persisted set falls back to the newest note.
  const openIds = openNoteIds.length ? openNoteIds : filtered[0] ? [filtered[0].id] : [];
  const previewId = activePreviewId ?? openIds[0] ?? null;

  const openNotes = openIds
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is Note => Boolean(n));
  const activeNote = openNotes.find((n) => n.id === previewId) ?? openNotes.at(-1) ?? null;

  // Browser-tab behavior: on close, freeze the current per-tab width so the
  // remaining close buttons stay under the cursor; re-flow once the pointer
  // leaves the tab bar.
  const tabbarRef = useRef<HTMLDivElement>(null);
  const [frozenTabWidth, setFrozenTabWidth] = useState<number | null>(null);

  function openPreview(id: string) {
    // Opening a tab is a fresh flow: drop any freeze left over from closing.
    setFrozenTabWidth(null);
    const nextIds = openIds.includes(id) ? openIds : [...openIds, id];
    onPreviewChange({ openNoteIds: nextIds, activePreviewId: id });
  }

  function closePreview(id: string) {
    // Freeze only while 2+ tabs remain (the bar hides at 1, so no stale width).
    const firstTab = tabbarRef.current?.querySelector(".preview-tab");
    setFrozenTabWidth(
      firstTab && openNotes.length > 2 ? firstTab.getBoundingClientRect().width : null,
    );
    const remaining = openIds.filter((openId) => openId !== id);
    // When the closed tab was the active one, hand focus to the neighbour so the
    // persisted activePreviewId never dangles at a note that is no longer open.
    onPreviewChange({
      openNoteIds: remaining,
      ...(id === previewId ? { activePreviewId: remaining.at(-1) ?? null } : {}),
    });
  }

  function toggleList() {
    const panel = listRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }

  return (
    <div className="notes-browser">
      <div className="notes-toolbar">
        <button className="notes-toolbar-primary" onClick={onNewNote}>
          <SquarePen size={14} />
          New Note
        </button>
        <button>
          <CheckCheck size={14} />
          Cosign Note
        </button>
        <button>
          <Info size={14} />
          Legend
        </button>
        <button>
          <Filter size={14} />
          Filter
        </button>
        <div className="notes-search">
          <Search size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search note text..."
            aria-label="Search note text"
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={12} />
            </button>
          )}
        </div>
        <div className="toolbar-spacer" />
        <button>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="notes-tabs" role="tablist">
        {NOTE_TABS.map((tab) => {
          const count = searchNotes(filterNotes(notes, tab), query).length;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={tab === activeTab}
              className={tab === activeTab ? "notes-tab active" : "notes-tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              <span className="notes-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="notes-shown">
        Number of notes shown: {filtered.length} of {notes.length}. All loaded.
      </div>

      <div className="notes-split">
        <PanelGroup orientation="horizontal" className="notes-panels">
          <Panel
            // Pixel-locked: resizing the window or outer panels leaves the
            // list width alone; only the preview flexes.
            defaultSize="340px"
            minSize="250px"
            maxSize="520px"
            groupResizeBehavior="preserve-pixel-size"
            collapsible
            collapsedSize="0px"
            panelRef={listRef}
            onResize={() => setListCollapsed(listRef.current?.isCollapsed() ?? false)}
          >
            <NoteList
              notes={filtered}
              selectedId={activeNote?.id ?? null}
              onSelect={openPreview}
            />
          </Panel>

          <PanelResizeHandle className="resize-handle inner">
            <button
              className="handle-collapse"
              aria-label={listCollapsed ? "Show note list" : "Hide note list"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={toggleList}
            >
              {listCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
          </PanelResizeHandle>

          <Panel minSize="35%" groupResizeBehavior="preserve-relative-size">
            <div className="preview-pane">
              {openNotes.length > 1 && (
                <div
                  className="preview-tabbar"
                  role="tablist"
                  ref={tabbarRef}
                  onMouseLeave={() => setFrozenTabWidth(null)}
                >
                  {openNotes.map((note) => (
                    <div
                      key={note.id}
                      className={
                        note.id === activeNote?.id
                          ? "preview-tab active"
                          : "preview-tab"
                      }
                      style={
                        frozenTabWidth != null
                          ? { flex: "none", width: frozenTabWidth, maxWidth: "none" }
                          : undefined
                      }
                    >
                      <button
                        role="tab"
                        aria-selected={note.id === activeNote?.id}
                        className="preview-tab-label"
                        onClick={() => onPreviewChange({ activePreviewId: note.id })}
                      >
                        {note.noteType}
                      </button>
                      <button
                        className="preview-tab-close"
                        aria-label={`Close ${note.noteType}`}
                        onClick={() => closePreview(note.id)}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <NotePreview
                note={activeNote}
                // Only notes authored by the current persona are deletable;
                // deleting also closes the note's preview tab.
                onDelete={
                  activeNote && canDelete(activeNote)
                    ? () => {
                        closePreview(activeNote.id);
                        onDeleteNote(activeNote.id);
                      }
                    : undefined
                }
                onEdit={
                  activeNote &&
                  activeNote.status === "incomplete" &&
                  canEdit(activeNote)
                    ? () => onEditNote(activeNote)
                    : undefined
                }
                onAddendum={
                  activeNote && activeNote.status !== "incomplete"
                    ? () => onAddendumNote(activeNote)
                    : undefined
                }
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
