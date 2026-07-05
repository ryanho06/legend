import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { formatClinician } from "../../lib/clinician";
import { htmlToPlainText, wordCount } from "../../lib/noteText";
import { scoreNote } from "../../lib/rubric";
import { formatStamp } from "../../lib/userNotes";
import { attemptKey, parseAttempt, type StoredAttempt } from "../../lib/wrapupAttempt";
import { caseCholangitis001Rubric as rubric } from "../../data/patients/cholangitis001/rubric";
import type { ClinicalNote, NoteDraft } from "../../types";
import { FeedbackReport } from "./FeedbackReport";

type Candidate = {
  key: string;
  label: string;
  meta: string;
  text: string;
};

/**
 * Wrap-up activity: submit an open draft or one of your signed notes for
 * rubric feedback. The last attempt persists per case so the report survives
 * reloads.
 */
export function WrapUpModule({
  editors,
  userNotes,
  embedded = false,
}: {
  editors: NoteDraft[];
  userNotes: ClinicalNote[];
  /** When docked in the floating panel, hide the module's own title row. */
  embedded?: boolean;
}) {
  const [storedAttempt, setStoredAttempt] = usePersistentState(
    attemptKey(rubric.caseId),
    "",
  );
  const attempt = parseAttempt(storedAttempt);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const candidates: Candidate[] = [
    ...editors.map((draft) => {
      const text = htmlToPlainText(draft.body);
      return {
        key: draft.id,
        label: `${draft.noteType} (open draft)`,
        meta: `${draft.service} · ${wordCount(text)} words`,
        text,
      };
    }),
    ...userNotes
      .filter((note) => note.status === "signed")
      .map((note) => ({
        key: note.id,
        label: `${note.noteType} (signed)`,
        meta: `${formatClinician(note.author, note.credential)} · ${note.dateOfService} · ${wordCount(note.body)} words`,
        text: note.body,
      })),
  ];
  const selected =
    candidates.find((c) => c.key === selectedKey) ?? candidates[0] ?? null;

  function submit() {
    if (!selected) return;
    setStoredAttempt(
      JSON.stringify({ text: selected.text, at: formatStamp(new Date()) } satisfies StoredAttempt),
    );
  }

  return (
    <div className={embedded ? "wrapup-module embedded" : "wrapup-module"}>
      {!embedded && (
        <div className="wrapup-title-row">
          <h1>
            <ClipboardCheck size={15} /> Wrap-Up — note feedback
          </h1>
          <span className="wrapup-disclaimer">
            All patient data are synthetic. For education and simulation only. Not
            for clinical use.
          </span>
        </div>
      )}

      {attempt ? (
        <FeedbackReport
          result={scoreNote(attempt.text, rubric)}
          rubric={rubric}
          text={attempt.text}
          scoredAt={attempt.at}
          onReset={() => setStoredAttempt("")}
        />
      ) : candidates.length === 0 ? (
        <div className="wrapup-empty">
          Nothing to score yet. Write your {rubric.noteType.toLowerCase()} in the
          Notes activity (New Note), then Sign it — or come back here with the
          draft still open.
        </div>
      ) : (
        <div className="wrapup-card">
          <div className="wrapup-card-head">Submit a note for feedback</div>
          <div className="wrapup-card-body">
            {candidates.map((candidate) => (
              <label key={candidate.key} className="wrapup-draft-row">
                <input
                  type="radio"
                  name="wrapup-draft"
                  checked={selected?.key === candidate.key}
                  onChange={() => setSelectedKey(candidate.key)}
                />
                <span className="wrapup-draft-name">{candidate.label}</span>
                <span className="wrapup-draft-meta">{candidate.meta}</span>
              </label>
            ))}
            <button
              className="wrapup-submit"
              onClick={submit}
              disabled={!selected || wordCount(selected.text) === 0}
            >
              Submit for feedback
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
