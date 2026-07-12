import { useMemo, useRef, useState } from "react";
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
import { ChronosDock } from "./chronos/ChronosDock";
import { StickyNotePopup } from "./StickyNotePopup";
import { SummaryModule } from "./summary/SummaryModule";
import { WrapUpDock } from "./wrapup/WrapUpDock";
import { CaseContext, useCase } from "../context/CaseContext";
import { mainTabs } from "../data/tabs";
import { useCaseWork } from "../hooks/useCaseWork";
import { htmlToPlainText, wordCount } from "../lib/noteText";
import { noteOwnership } from "../lib/noteOwnership";
import {
  buildAddendumBlock,
  buildUserNote,
  refileUserNote,
} from "../lib/userNotes";
import { applyEvents, workToEvents } from "../lib/applyEvents";
import { revealEvents } from "../lib/reveal";
import { currentRound, nextRoundAt } from "../lib/rounds";
import { caseNow } from "../lib/simTime";
import { plainTextToEditorHtml } from "../lib/smarttext";
import type { CaseUiState, Note, NoteStatus, UserProfile } from "../types";

// Draft ids only need uniqueness within a session; module scope survives the
// per-case remounts (the workspace is keyed by caseId).
let draftSeq = 0;

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
  onPatch: (patch: Partial<CaseUiState> | ((prev: CaseUiState) => Partial<CaseUiState>)) => void;
  stickyOpen: boolean;
  onCloseSticky: () => void;
}) {
  const activeCase = useCase();
  const {
    mainTab,
    chartTab,
    selectedDocId,
    editors,
    activeEditorId,
    wrapupOpen,
    openNoteIds,
    activePreviewId,
  } = ui;
  const work = useCaseWork(activeCase.id);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const userNotes = work.notes;
  const addenda = work.addenda;
  const rightRef = useRef<PanelImperativeHandle>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  function toggleRightPanel() {
    const panel = rightRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }

  // Authored sim-events revealed by the server clock (Model B), plus the
  // trainee's own work, fold onto the static case through one applyEvents seam.
  // Reveals go first so trainee notes sort last (newest). With no events.ts and
  // simNow 0 this is identical to the pre-engine merge.
  // Encounter ids the trainee's own notes already cover; an authored NPC round
  // note for a covered encounter is suppressed so there is exactly one note per
  // round (spec §9).
  const coveredEncounterIds = useMemo(
    () => new Set(userNotes.map((note) => note.encounterId)),
    [userNotes],
  );
  const revealed = useMemo(
    () => revealEvents(activeCase.events ?? [], work.simNow, coveredEncounterIds),
    [activeCase.events, work.simNow, coveredEncounterIds],
  );
  // The round the trainee is currently sitting at (drives note stamping +
  // advance-on-sign). Null for a static case, which keeps every path inert.
  const activeRound = useMemo(
    () => currentRound(activeCase.rounds ?? [], work.simNow),
    [activeCase.rounds, work.simNow],
  );
  const events = useMemo(
    () => [...revealed, ...workToEvents(userNotes, addenda)],
    [revealed, userNotes, addenda],
  );
  const liveCase = useMemo(() => applyEvents(activeCase, events), [activeCase, events]);
  const allDocuments = liveCase.documents;
  const allNotes = liveCase.notes;

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

  const ownership = (note: Note) => noteOwnership(note, { userNotes, myHcpId: user.hcpId });
  const canEdit = (note: Note) => ownership(note).canEdit;
  const canDelete = (note: Note) => ownership(note).canDelete;

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

  async function deleteUserNote(id: string) {
    setSaveError(null);
    try {
      await work.deleteNote(id);
      onPatch((prev) => (prev.selectedDocId === id ? { selectedDocId: null } : {}));
    } catch {
      setSaveError("Couldn't delete the note on the server. Try again.");
    }
  }

  // Sign publishes the draft (or appends its addendum); Pend files it as an
  // incomplete note. Edit drafts re-file their target in place; a deleted
  // target degrades to filing as a new note. All paths remove the draft tab.
  // Server-first: the draft tab only closes once the write lands, so a failed
  // save never destroys work. onPatch uses the functional form for every
  // post-await update so it can't clobber editor changes made during the
  // round-trip (it resolves against React's current state, not this render's
  // stale `editors` snapshot).
  async function finishDraft(id: string, status: NoteStatus) {
    if (saving) return;
    const draft = editors.find((d) => d.id === id);
    if (!draft) return;
    const text = htmlToPlainText(draft.body);
    if (wordCount(text) === 0) return;
    setSaveError(null);
    setSaving(true);
    try {
      if (draft.mode === "addendum" && draft.targetNoteId) {
        await work.addAddendum(
          draft.targetNoteId,
          buildAddendumBlock(user, text, caseNow(activeCase.anchor, work.simNow)),
        );
        onPatch((prev) => ({ editors: prev.editors.filter((d) => d.id !== id) }));
        return;
      }
      const target =
        draft.mode === "edit" && draft.targetNoteId
          ? userNotes.find((n) => n.id === draft.targetNoteId)
          : undefined;
      if (target) {
        await work.refileNote(
          refileUserNote(target, draft, text, status, caseNow(activeCase.anchor, work.simNow)),
        );
      } else {
        await work.createNote(
          buildUserNote(
            draft,
            user,
            text,
            status,
            caseNow(activeCase.anchor, work.simNow),
            activeRound?.encounterId ?? "enc-admission",
          ),
        );
      }
      if (status === "signed") {
        // The note is committed once createNote/refileNote above has resolved,
        // so the draft tab must close and the dock must open regardless of
        // whether the attempt write below succeeds — otherwise a retry after a
        // failed saveAttempt would sign a duplicate note.
        try {
          await work.saveAttempt(text, true);
        } catch {
          setSaveError(
            "Note signed and filed, but the feedback attempt didn't save. Submit it again from the Performance dock.",
          );
        }
        onPatch((prev) => ({
          editors: prev.editors.filter((d) => d.id !== id),
          wrapupOpen: true,
        }));
        // Signing a fresh round note advances the ward clock to the next round
        // (spec §7). Edits/refiles and pends never advance. No-op when the case
        // has no rounds or none remain (nextRoundAt returns null).
        if (!target) {
          const nextAt = nextRoundAt(activeCase.rounds ?? [], work.simNow);
          if (nextAt !== null) {
            try {
              await work.advanceSim(nextAt);
            } catch {
              setSaveError("Note signed, but the ward clock didn't advance. Reopen the chart to retry.");
            }
          }
        }
      } else {
        onPatch((prev) => ({ editors: prev.editors.filter((d) => d.id !== id) }));
      }
    } catch {
      setSaveError("Couldn't save to the server. Your draft is untouched; try again.");
    } finally {
      setSaving(false);
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
        error={saveError}
        busy={saving}
      />
    ) : (
      <DocumentPanel
        document={selectedDocument}
        onClose={() => onPatch({ selectedDocId: null })}
      />
    );

  return (
    <CaseContext.Provider value={liveCase}>
      <div className="ehr-workspace">
        <div className="fixed-sidebar">
          <PatientSidebar />
        </div>

        <PanelGroup orientation="horizontal" className="workspace-panels">
          <Panel defaultSize="72%" minSize="45%">
            <main className="center-shell">
              <MainTabBar selected={mainTab} onSelect={(tab) => onPatch({ mainTab: tab })} />

              <div className="module-body">
                {(work.loadError ?? saveError) && (
                  <div className="editor-save-error">{work.loadError ?? saveError}</div>
                )}

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
                    canEdit={canEdit}
                    canDelete={canDelete}
                    openNoteIds={openNoteIds}
                    activePreviewId={activePreviewId}
                    onPreviewChange={(patch) => onPatch(patch)}
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
                    canEdit={canEdit}
                    canDelete={canDelete}
                    openNoteIds={openNoteIds}
                    activePreviewId={activePreviewId}
                    onPreviewChange={(patch) => onPatch(patch)}
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
        attempt={work.attempt}
        simNow={work.simNow}
        onSubmitAttempt={(text, signed) => {
          setSaveError(null);
          work.saveAttempt(text, signed).catch(() => setSaveError("Couldn't save the attempt."));
        }}
        onClearAttempt={() => {
          setSaveError(null);
          work.clearAttempt().catch(() => setSaveError("Couldn't clear the attempt."));
        }}
      />

      {activeCase.chronos && activeCase.chronos.length > 0 && (
        <ChronosDock
          intents={activeCase.chronos}
          onAdvance={(targetAt) => {
            setSaveError(null);
            work.advanceSim(targetAt).catch(() => setSaveError("Chronos couldn't advance the clock."));
          }}
        />
      )}
    </CaseContext.Provider>
  );
}
