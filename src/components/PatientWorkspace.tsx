import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { ChartReview } from "./chart/ChartReview";
import { NotesBrowser } from "./chart/NotesBrowser";
import { MainTabBar } from "./layout/MainTabBar";
import { NoteEditorPanel } from "./notes/NoteEditorPanel";
import { PatientSidebar } from "./panels/PatientSidebar";
import { DocumentPanel } from "./panels/DocumentPanel";
import { PlaceholderModule } from "./PlaceholderModule";
import { ResultsModule } from "./results/ResultsModule";
import { StickyNotePopup } from "./StickyNotePopup";
import { SummaryModule } from "./summary/SummaryModule";
import { WrapUpDock } from "./wrapup/WrapUpDock";
import { useCase } from "../context/CaseContext";
import { mainTabs } from "../data/tabs";
import { usePersistentState } from "../hooks/usePersistentState";
import { htmlToPlainText, wordCount } from "../lib/noteText";
import { addendaKey, userNotesKey } from "../lib/session";
import {
  appendAddendum,
  buildAddendumBlock,
  buildUserNote,
  isOwnNote,
  refileUserNote,
} from "../lib/userNotes";
import { plainTextToEditorHtml } from "../lib/smarttext";
import { saveWrapupAttempt } from "../lib/wrapupAttempt";
import type { CaseUiState, ClinicalNote, Note, NoteStatus, UserProfile } from "../types";

// Draft ids only need uniqueness within a session; module scope survives the
// per-case remounts (the workspace is keyed by caseId).
let draftSeq = 0;

function parseUserNotes(raw: string): ClinicalNote[] {
  try {
    const parsed = JSON.parse(raw) as ClinicalNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAddenda(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * One patient's chart: sidebar + tabbed modules + right rail + sticky note +
 * feedback dock. Mounted with key={caseId} so per-case localStorage hooks
 * never see a key change; the cross-switch state (tabs, drafts, dock) lives
 * in App's per-case `ui` map and is controlled via `onPatch`.
 */
export function PatientWorkspace({
  user,
  ui,
  onPatch,
  stickyOpen,
  onCloseSticky,
}: {
  user: UserProfile;
  ui: CaseUiState;
  onPatch: (patch: Partial<CaseUiState>) => void;
  stickyOpen: boolean;
  onCloseSticky: () => void;
}) {
  const activeCase = useCase();
  const { mainTab, chartTab, selectedDocId, editors, activeEditorId, wrapupOpen } = ui;
  const [storedUserNotes, setStoredUserNotes] = usePersistentState(
    userNotesKey(activeCase.id),
    "[]",
  );
  const userNotes = parseUserNotes(storedUserNotes);
  const [storedAddenda, setStoredAddenda] = usePersistentState(
    addendaKey(activeCase.id),
    "{}",
  );
  const addenda = parseAddenda(storedAddenda);
  const rightRef = useRef<PanelImperativeHandle>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  function toggleRightPanel() {
    const panel = rightRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }

  // User-authored notes join the case content in every view; runtime addenda
  // overlay onto any note (static or user) by id, after any static addendum.
  const withAddenda = <T extends ClinicalNote>(note: T): T =>
    addenda[note.id]
      ? { ...note, addendum: appendAddendum(note.addendum, addenda[note.id]) }
      : note;
  const mergedUserNotes = userNotes.map(withAddenda);
  const allDocuments = [
    ...activeCase.documents.map((doc) => (doc.kind === "note" ? withAddenda(doc) : doc)),
    ...mergedUserNotes,
  ];
  const allNotes = [...activeCase.notes.map(withAddenda), ...mergedUserNotes];

  const selectedDocument = selectedDocId
    ? allDocuments.find((doc) => doc.id === selectedDocId) ?? null
    : null;

  // Active draft falls back to the last-opened tab if the active one was closed.
  const activeEditor =
    editors.find((draft) => draft.id === activeEditorId) ?? editors.at(-1) ?? null;

  function openNewNote() {
    draftSeq += 1;
    const { patient } = activeCase;
    const draft = {
      id: `draft-${draftSeq}`,
      noteType: "Progress Note",
      service: `(A) ${patient.specialty} — ${patient.location.split(" ")[0]}`,
      body: "",
    };
    onPatch({ editors: [...editors, draft], activeEditorId: draft.id });
    // Make sure the editor is visible even if the right panel was collapsed.
    rightRef.current?.expand();
  }

  const ownNote = (note: Note) => isOwnNote(note, user.hcpId, activeCase.playerHcpId);

  // Reopen an incomplete user note as an editor draft; Sign/Pend re-files it in
  // place. Focuses the existing tab if one is already open for this note.
  function openEditDraft(note: Note) {
    const existing = editors.find((d) => d.mode === "edit" && d.targetNoteId === note.id);
    if (existing) {
      onPatch({ activeEditorId: existing.id });
      rightRef.current?.expand();
      return;
    }
    draftSeq += 1;
    const draft = {
      id: `draft-${draftSeq}`,
      noteType: note.noteType,
      service: note.service,
      body: plainTextToEditorHtml(note.body),
      mode: "edit" as const,
      targetNoteId: note.id,
    };
    onPatch({ editors: [...editors, draft], activeEditorId: draft.id });
    rightRef.current?.expand();
  }

  // Open an empty addendum draft targeting a signed note you own.
  function openAddendumDraft(note: Note) {
    const existing = editors.find(
      (d) => d.mode === "addendum" && d.targetNoteId === note.id,
    );
    if (existing) {
      onPatch({ activeEditorId: existing.id });
      rightRef.current?.expand();
      return;
    }
    draftSeq += 1;
    const draft = {
      id: `draft-${draftSeq}`,
      noteType: "Addendum",
      service: note.service,
      body: "",
      mode: "addendum" as const,
      targetNoteId: note.id,
    };
    onPatch({ editors: [...editors, draft], activeEditorId: draft.id });
    rightRef.current?.expand();
  }

  function closeEditor(id: string) {
    onPatch({ editors: editors.filter((draft) => draft.id !== id) });
  }

  function deleteUserNote(id: string) {
    setStoredUserNotes(JSON.stringify(userNotes.filter((note) => note.id !== id)));
    if (selectedDocId === id) onPatch({ selectedDocId: null });
  }

  // Sign publishes the draft (or appends its addendum); Pend files it as an
  // incomplete note. Edit drafts re-file their target in place; a deleted
  // target degrades to filing as a new note. All paths remove the draft tab.
  function finishDraft(id: string, status: NoteStatus) {
    const draft = editors.find((d) => d.id === id);
    if (!draft) return;
    const text = htmlToPlainText(draft.body);
    if (wordCount(text) === 0) return;
    const remaining = editors.filter((d) => d.id !== id);

    if (draft.mode === "addendum" && draft.targetNoteId) {
      const block = buildAddendumBlock(user, text, new Date());
      setStoredAddenda(
        JSON.stringify({
          ...addenda,
          [draft.targetNoteId]: appendAddendum(addenda[draft.targetNoteId], block),
        }),
      );
      onPatch({ editors: remaining });
      return;
    }

    const target =
      draft.mode === "edit" && draft.targetNoteId
        ? userNotes.find((n) => n.id === draft.targetNoteId)
        : undefined;
    const note = target
      ? refileUserNote(target, draft, text, status, new Date())
      : buildUserNote(draft, user, text, status, new Date());
    const nextNotes = target
      ? userNotes.map((n) => (n.id === target.id ? note : n))
      : [...userNotes, note];
    setStoredUserNotes(JSON.stringify(nextNotes));
    if (status === "signed") {
      saveWrapupAttempt(activeCase.id, text);
      onPatch({ editors: remaining, wrapupOpen: true });
    } else {
      onPatch({ editors: remaining });
    }
  }

  function updateEditorBody(id: string, body: string) {
    onPatch({
      editors: editors.map((draft) => (draft.id === id ? { ...draft, body } : draft)),
    });
  }

  function updateEditorNoteType(id: string, noteType: string) {
    onPatch({
      editors: editors.map((draft) => (draft.id === id ? { ...draft, noteType } : draft)),
    });
  }

  // Right-rail content: the note editor when drafts are open, else the report
  // viewer. Rendered in the panel when expanded, or as a faded hover preview in
  // the edge fly-out when collapsed — exactly one of the two, so its state is
  // single and nothing is lost on collapse.
  const rightContent =
    editors.length > 0 ? (
      <NoteEditorPanel
        editors={editors}
        activeId={activeEditor?.id ?? null}
        onSelect={(id) => onPatch({ activeEditorId: id })}
        onClose={closeEditor}
        onChangeBody={updateEditorBody}
        onChangeNoteType={updateEditorNoteType}
        onSign={(id) => finishDraft(id, "signed")}
        onPend={(id) => finishDraft(id, "incomplete")}
      />
    ) : (
      <DocumentPanel
        document={selectedDocument}
        onClose={() => onPatch({ selectedDocId: null })}
      />
    );

  return (
    <>
      <div className="ehr-workspace">
        <div className="fixed-sidebar">
          <PatientSidebar />
        </div>

        <PanelGroup orientation="horizontal" className="workspace-panels">
          <Panel defaultSize="72%" minSize="45%">
            <main className="center-shell">
              <MainTabBar selected={mainTab} onSelect={(tab) => onPatch({ mainTab: tab })} />

              <div className="module-body">
                {mainTab === "summary" && <SummaryModule />}

                {mainTab === "chart" && (
                  <ChartReview
                    chartTab={chartTab}
                    setChartTab={(tab) => onPatch({ chartTab: tab })}
                    encounters={activeCase.encounters}
                    documents={allDocuments}
                    notes={allNotes}
                    selectedDocId={selectedDocId}
                    onSelectDocument={(id) => onPatch({ selectedDocId: id })}
                    onNewNote={openNewNote}
                    onDeleteNote={deleteUserNote}
                    onEditNote={openEditDraft}
                    onAddendumNote={openAddendumDraft}
                    ownNote={ownNote}
                  />
                )}

                {mainTab === "results" && <ResultsModule />}

                {mainTab === "notes" && (
                  <NotesBrowser
                    notes={allNotes}
                    onNewNote={openNewNote}
                    onDeleteNote={deleteUserNote}
                    onEditNote={openEditDraft}
                    onAddendumNote={openAddendumDraft}
                    ownNote={ownNote}
                  />
                )}

                {mainTab !== "summary" &&
                  mainTab !== "chart" &&
                  mainTab !== "results" &&
                  mainTab !== "notes" && (
                    <PlaceholderModule
                      title={mainTabs.find((tab) => tab.key === mainTab)?.label ?? ""}
                    />
                  )}
              </div>
            </main>
          </Panel>

          <PanelResizeHandle className="resize-handle skinny">
            {!rightCollapsed && (
              <button
                className="handle-collapse"
                aria-label="Hide side panel"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={toggleRightPanel}
              >
                <ChevronRight size={12} />
              </button>
            )}
          </PanelResizeHandle>

          <Panel
            defaultSize="28%"
            minSize="18%"
            maxSize="42%"
            collapsible
            collapsedSize="0%"
            panelRef={rightRef}
            onResize={() => setRightCollapsed(rightRef.current?.isCollapsed() ?? false)}
          >
            <div className="right-panel-frame">{!rightCollapsed && rightContent}</div>
          </Panel>
        </PanelGroup>

        {rightCollapsed && (
          <div className="right-flyout-zone">
            <div className="right-flyout">
              <button
                className="right-flyout-expand"
                aria-label="Show side panel"
                onClick={toggleRightPanel}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="right-flyout-preview">{rightContent}</div>
            </div>
          </div>
        )}
      </div>

      {stickyOpen && <StickyNotePopup onClose={onCloseSticky} />}

      <WrapUpDock
        open={wrapupOpen}
        onToggle={() => onPatch({ wrapupOpen: !wrapupOpen })}
        onClose={() => onPatch({ wrapupOpen: false })}
        editors={editors}
        userNotes={userNotes}
        user={user}
      />
    </>
  );
}
