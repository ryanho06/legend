import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { ChartReview } from "./components/chart/ChartReview";
import { NotesBrowser } from "./components/chart/NotesBrowser";
import { MainTabBar } from "./components/layout/MainTabBar";
import { TopSystemBar } from "./components/layout/TopSystemBar";
import { NoteEditorPanel } from "./components/notes/NoteEditorPanel";
import { PatientSidebar } from "./components/panels/PatientSidebar";
import { DocumentPanel } from "./components/panels/DocumentPanel";
import { PlaceholderModule } from "./components/PlaceholderModule";
import { ResultsModule } from "./components/results/ResultsModule";
import { SignInPage } from "./components/SignInPage";
import { StickyNotePopup } from "./components/StickyNotePopup";
import { SummaryModule } from "./components/summary/SummaryModule";
import { WrapUpModule } from "./components/wrapup/WrapUpModule";
import {
  caseCholangitis001Documents,
  caseCholangitis001Notes,
} from "./data/patients/cholangitis001/documents";
import { caseCholangitis001Encounters } from "./data/patients/cholangitis001/encounters";
import { mainTabs } from "./data/tabs";
import patient from "./data/patient.json";
import { usePersistentState } from "./hooks/usePersistentState";
import { htmlToPlainText, wordCount } from "./lib/noteText";
import { USER_KEY, userNotesKey } from "./lib/session";
import { buildUserNote } from "./lib/userNotes";
import { saveWrapupAttempt } from "./lib/wrapupAttempt";
import type {
  ChartTab,
  ClinicalNote,
  MainTab,
  NoteDraft,
  NoteStatus,
  UserProfile,
} from "./types";
import "./App.css";

function parseUser(raw: string): UserProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    return typeof parsed.forename === "string" && typeof parsed.surname === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function parseUserNotes(raw: string): ClinicalNote[] {
  try {
    const parsed = JSON.parse(raw) as ClinicalNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function App() {
  const [storedUser, setStoredUser] = usePersistentState(USER_KEY, "");
  const user = parseUser(storedUser);
  const [storedUserNotes, setStoredUserNotes] = usePersistentState(
    userNotesKey("cholangitis001"),
    "[]",
  );
  const userNotes = parseUserNotes(storedUserNotes);
  const [mainTab, setMainTab] = useState<MainTab>("summary");
  const [chartTab, setChartTab] = useState<ChartTab>("encounters");
  const [editors, setEditors] = useState<NoteDraft[]>([]);
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const editorSeq = useRef(0);
  const [stickyOpen, setStickyOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const rightRef = useRef<PanelImperativeHandle>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  function toggleRightPanel() {
    const panel = rightRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }

  // User-authored notes join the case content in every view.
  const allDocuments = [...caseCholangitis001Documents, ...userNotes];
  const allNotes = [...caseCholangitis001Notes, ...userNotes];

  const selectedDocument = selectedDocId
    ? allDocuments.find((doc) => doc.id === selectedDocId) ?? null
    : null;

  // Active draft falls back to the last-opened tab if the active one was closed.
  const activeEditor =
    editors.find((draft) => draft.id === activeEditorId) ?? editors.at(-1) ?? null;

  function openNewNote() {
    editorSeq.current += 1;
    const draft: NoteDraft = {
      id: `draft-${editorSeq.current}`,
      noteType: "Progress Note",
      service: `(A) ${patient.specialty} — ${patient.location.split(" ")[0]}`,
      body: "",
    };
    setEditors((prev) => [...prev, draft]);
    setActiveEditorId(draft.id);
    // Make sure the editor is visible even if the right panel was collapsed.
    rightRef.current?.expand();
  }

  function closeEditor(id: string) {
    setEditors((prev) => prev.filter((draft) => draft.id !== id));
  }

  // Sign publishes the draft as a signed note and opens Wrap-Up feedback on
  // it; Pend files it as an incomplete note. Both remove the draft tab.
  function finishDraft(id: string, status: NoteStatus) {
    if (!user) return;
    const draft = editors.find((d) => d.id === id);
    if (!draft) return;
    const text = htmlToPlainText(draft.body);
    if (wordCount(text) === 0) return;
    const note = buildUserNote(draft, user, text, status, new Date());
    setStoredUserNotes(JSON.stringify([...userNotes, note]));
    closeEditor(id);
    if (status === "signed") {
      saveWrapupAttempt("cholangitis001", text);
      setMainTab("wrapup");
    }
  }

  function updateEditorBody(id: string, body: string) {
    setEditors((prev) =>
      prev.map((draft) => (draft.id === id ? { ...draft, body } : draft)),
    );
  }

  function updateEditorNoteType(id: string, noteType: string) {
    setEditors((prev) =>
      prev.map((draft) => (draft.id === id ? { ...draft, noteType } : draft)),
    );
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
        onSelect={setActiveEditorId}
        onClose={closeEditor}
        onChangeBody={updateEditorBody}
        onChangeNoteType={updateEditorNoteType}
        onSign={(id) => finishDraft(id, "signed")}
        onPend={(id) => finishDraft(id, "incomplete")}
      />
    ) : (
      <DocumentPanel
        document={selectedDocument}
        onClose={() => setSelectedDocId(null)}
      />
    );

  if (!user) {
    return <SignInPage onComplete={(profile) => setStoredUser(JSON.stringify(profile))} />;
  }

  return (
    <div className="legend-app">
      <TopSystemBar
        stickyOpen={stickyOpen}
        onToggleSticky={() => setStickyOpen((open) => !open)}
        user={user}
      />

      <div className="ehr-workspace">
        <div className="fixed-sidebar">
          <PatientSidebar />
        </div>

        <PanelGroup orientation="horizontal" className="workspace-panels">
          <Panel defaultSize="72%" minSize="45%">
            <main className="center-shell">
              <MainTabBar selected={mainTab} onSelect={setMainTab} />

              <div className="module-body">
                {mainTab === "summary" && <SummaryModule />}

                {mainTab === "chart" && (
                  <ChartReview
                    chartTab={chartTab}
                    setChartTab={setChartTab}
                    encounters={caseCholangitis001Encounters}
                    documents={allDocuments}
                    notes={allNotes}
                    selectedDocId={selectedDocId}
                    onSelectDocument={setSelectedDocId}
                    onNewNote={openNewNote}
                  />
                )}

                {mainTab === "results" && <ResultsModule />}

                {mainTab === "notes" && (
                  <NotesBrowser notes={allNotes} onNewNote={openNewNote} />
                )}

                {mainTab === "wrapup" && (
                  <WrapUpModule editors={editors} userNotes={userNotes} />
                )}

                {mainTab !== "summary" &&
                  mainTab !== "chart" &&
                  mainTab !== "results" &&
                  mainTab !== "notes" &&
                  mainTab !== "wrapup" && (
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

      {stickyOpen && <StickyNotePopup onClose={() => setStickyOpen(false)} />}
    </div>
  );
}

export default App;
