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
import { StickyNotePopup } from "./components/StickyNotePopup";
import { SummaryModule } from "./components/summary/SummaryModule";
import {
  caseCholangitis001Documents,
  caseCholangitis001Notes,
} from "./data/patients/cholangitis001/documents";
import { caseCholangitis001Encounters } from "./data/patients/cholangitis001/encounters";
import { mainTabs } from "./data/tabs";
import patient from "./data/patient.json";
import type { ChartTab, MainTab, NoteDraft } from "./types";
import "./App.css";

function App() {
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

  const selectedDocument = selectedDocId
    ? caseCholangitis001Documents.find((doc) => doc.id === selectedDocId) ?? null
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
      />
    ) : (
      <DocumentPanel
        document={selectedDocument}
        onClose={() => setSelectedDocId(null)}
      />
    );

  return (
    <div className="legend-app">
      <TopSystemBar
        stickyOpen={stickyOpen}
        onToggleSticky={() => setStickyOpen((open) => !open)}
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
                    documents={caseCholangitis001Documents}
                    notes={caseCholangitis001Notes}
                    selectedDocId={selectedDocId}
                    onSelectDocument={setSelectedDocId}
                    onNewNote={openNewNote}
                  />
                )}

                {mainTab === "results" && <ResultsModule />}

                {mainTab === "notes" && (
                  <NotesBrowser
                    notes={caseCholangitis001Notes}
                    onNewNote={openNewNote}
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

      {stickyOpen && <StickyNotePopup onClose={() => setStickyOpen(false)} />}
    </div>
  );
}

export default App;
