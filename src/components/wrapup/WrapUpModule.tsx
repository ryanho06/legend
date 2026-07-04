import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { htmlToPlainText, wordCount } from "../../lib/noteText";
import { scoreNote } from "../../lib/rubric";
import { caseCholangitis001Rubric as rubric } from "../../data/patients/cholangitis001/rubric";
import type { NoteDraft } from "../../types";
import { FeedbackReport } from "./FeedbackReport";

type StoredAttempt = { text: string; at: string };

function parseAttempt(raw: string): StoredAttempt | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAttempt;
    return typeof parsed.text === "string" && typeof parsed.at === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** DD/MM HH:MM, matching the app's absolute-time convention. */
function formatNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Wrap-up activity: submit an open note draft for rubric feedback. The last
 * attempt persists per case so the report survives reloads.
 */
export function WrapUpModule({ editors }: { editors: NoteDraft[] }) {
  const [storedAttempt, setStoredAttempt] = usePersistentState(
    `legend-wrapup-${rubric.caseId}`,
    "",
  );
  const attempt = parseAttempt(storedAttempt);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    editors.find((draft) => draft.id === selectedId) ?? editors[0] ?? null;

  function submit() {
    if (!selected) return;
    const text = htmlToPlainText(selected.body);
    setStoredAttempt(JSON.stringify({ text, at: formatNow() } satisfies StoredAttempt));
  }

  return (
    <div className="wrapup-module">
      <div className="wrapup-title-row">
        <h1>
          <ClipboardCheck size={15} /> Wrap-Up — note feedback
        </h1>
        <span className="wrapup-disclaimer">
          All patient data are synthetic. For education and simulation only. Not
          for clinical use.
        </span>
      </div>

      {attempt ? (
        <FeedbackReport
          result={scoreNote(attempt.text, rubric)}
          rubric={rubric}
          text={attempt.text}
          scoredAt={attempt.at}
          onReset={() => setStoredAttempt("")}
        />
      ) : editors.length === 0 ? (
        <div className="wrapup-empty">
          No open note drafts. Write your {rubric.noteType.toLowerCase()} in the
          Notes activity (New Note), then come back here to submit it for
          feedback.
        </div>
      ) : (
        <div className="wrapup-card">
          <div className="wrapup-card-head">Submit a draft for feedback</div>
          <div className="wrapup-card-body">
            {editors.map((draft) => {
              const words = wordCount(htmlToPlainText(draft.body));
              return (
                <label key={draft.id} className="wrapup-draft-row">
                  <input
                    type="radio"
                    name="wrapup-draft"
                    checked={selected?.id === draft.id}
                    onChange={() => setSelectedId(draft.id)}
                  />
                  <span className="wrapup-draft-name">{draft.noteType}</span>
                  <span className="wrapup-draft-meta">
                    {draft.service} · {words} words
                  </span>
                </label>
              );
            })}
            <button
              className="wrapup-submit"
              onClick={submit}
              disabled={!selected || wordCount(htmlToPlainText(selected.body)) === 0}
            >
              Submit for feedback
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
