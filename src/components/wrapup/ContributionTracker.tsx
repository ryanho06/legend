import type { ContributionRow } from "../../lib/contribution";

const STATUS_LABEL: Record<ContributionRow["status"], string> = {
  you: "you wrote this",
  team: "team covered",
  current: "on the ward now",
  unreached: "not yet reached",
};

/**
 * Private, self-only round tracker (spec §3). Neutral and formative: no
 * forfeiture, no leaderboard. Shows which rounds the trainee personally wrote,
 * which the team covered, and flags any above their grade without penalty.
 */
export function ContributionTracker({ rows }: { rows: ContributionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="contribution-tracker">
      <div className="contribution-head">Rounds covered</div>
      <ul className="contribution-list">
        {rows.map((row) => (
          <li key={row.key} className={`contribution-row ${row.status}`}>
            <span className="contribution-label">{row.label}</span>
            <span className="contribution-meta">
              {row.percent !== null && <span className="contribution-percent">{row.percent}%</span>}
              <span className="contribution-status">{STATUS_LABEL[row.status]}</span>
              {row.aboveGrade && row.status === "you" && (
                <span className="contribution-above" title="Above the grade this case expects; not penalised here.">
                  above your grade
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
