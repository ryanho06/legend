import { AlertTriangle, Check, X } from "lucide-react";
import type { CaseRubric, RubricItem, RubricResult } from "../../types";

const CATEGORY_ORDER: { key: RubricItem["category"]; label: string }[] = [
  { key: "safety", label: "Safety" },
  { key: "findings", label: "Findings" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

/** Deterministically scored dimensions; the rest need clinical judgment. */
const MACHINE_SCORED_NOTE =
  "Deterministic scoring covers thorough (checklist), organized (sections) and succinct (word band). The judgment-heavy PDQI-9 dimensions are not machine-scored.";

export function FeedbackReport({
  result,
  rubric,
  text,
  scoredAt,
  onReset,
}: {
  result: RubricResult;
  rubric: CaseRubric;
  text: string;
  scoredAt: string;
  onReset: () => void;
}) {
  const percent =
    result.possible > 0 ? Math.round((100 * result.total) / result.possible) : 0;
  const overBand = result.words > rubric.wordBand.max;

  return (
    <div className="wrapup-report">
      <div className="wrapup-score-banner">
        <div className="wrapup-score-value">
          {result.total} / {result.possible} <span>({percent}%)</span>
        </div>
        <div className="wrapup-score-meta">
          Scored {scoredAt} · {result.words} words
          {result.wordPenalty > 0 && ` · −${result.wordPenalty} verbosity`}
        </div>
        <button className="wrapup-reset" onClick={onReset}>
          Score another draft
        </button>
      </div>

      {result.criticalMisses.length > 0 && (
        <div className="wrapup-unsafe">
          <div className="wrapup-unsafe-head">
            <AlertTriangle size={14} /> Unsafe omission
            {result.criticalMisses.length > 1 && "s"}
          </div>
          {result.criticalMisses.map((item) => (
            <div key={item.id} className="wrapup-unsafe-item">
              <strong>{item.label}.</strong> {item.explanation}
            </div>
          ))}
        </div>
      )}

      {CATEGORY_ORDER.map(({ key, label }) => {
        const rows = result.items.filter((r) => r.item.category === key);
        if (rows.length === 0) return null;
        return (
          <div key={key} className="wrapup-card">
            <div className="wrapup-card-head">{label}</div>
            <div className="wrapup-card-body">
              {rows.map(({ item, matched }) => (
                <div key={item.id} className="wrapup-item">
                  <span
                    className={matched ? "wrapup-mark hit" : "wrapup-mark miss"}
                    aria-label={matched ? "covered" : "missed"}
                  >
                    {matched ? <Check size={13} /> : <X size={13} />}
                  </span>
                  <div>
                    <div className="wrapup-item-label">
                      {item.label} <em>({item.weight} pts)</em>
                    </div>
                    {!matched && (
                      <div className="wrapup-item-explain">{item.explanation}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="wrapup-card">
        <div className="wrapup-card-head">Structure &amp; conciseness</div>
        <div className="wrapup-card-body">
          <div className="wrapup-item">
            <span className={overBand ? "wrapup-mark miss" : "wrapup-mark hit"}>
              {overBand ? <X size={13} /> : <Check size={13} />}
            </span>
            <div className="wrapup-item-label">
              {result.words} words (aim ~{rubric.wordBand.target}, penalty past{" "}
              {rubric.wordBand.max})
              {result.wordPenalty > 0 && (
                <em> — {result.wordPenalty} points lost to note bloat</em>
              )}
            </div>
          </div>
          <div className="wrapup-item">
            <span
              className={
                result.sectionsFound.length === result.sectionsExpected
                  ? "wrapup-mark hit"
                  : "wrapup-mark miss"
              }
            >
              {result.sectionsFound.length === result.sectionsExpected ? (
                <Check size={13} />
              ) : (
                <X size={13} />
              )}
            </span>
            <div className="wrapup-item-label">
              Sections found: {result.sectionsFound.length}/{result.sectionsExpected}
              {result.sectionsFound.length > 0 && (
                <em> ({result.sectionsFound.join(", ")})</em>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="wrapup-card">
        <div className="wrapup-card-head">PDQI-9 dimensions</div>
        <div className="wrapup-card-body">
          <div className="wrapup-pdqi-chips">
            {Object.entries(result.pdqi).map(([dimension, counts]) => (
              <span key={dimension} className="wrapup-pdqi-chip">
                {dimension} {counts.matched}/{counts.total}
              </span>
            ))}
            <span className="wrapup-pdqi-chip">
              succinct {result.wordPenalty > 0 ? "0/1" : "1/1"}
            </span>
            <span className="wrapup-pdqi-chip">
              organized {result.sectionsFound.length}/{result.sectionsExpected}
            </span>
          </div>
          <div className="wrapup-pdqi-note">{MACHINE_SCORED_NOTE}</div>
        </div>
      </div>

      <details className="wrapup-model">
        <summary>Reveal the model note</summary>
        <div className="wrapup-compare">
          <div>
            <div className="wrapup-compare-head">Your note</div>
            <pre className="wrapup-note-text">{text}</pre>
          </div>
          <div>
            <div className="wrapup-compare-head">Model note</div>
            <pre className="wrapup-note-text">{rubric.modelNote}</pre>
          </div>
        </div>
      </details>
    </div>
  );
}
