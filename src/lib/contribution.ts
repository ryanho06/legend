import type { CaseRubric, ClinicalNote, Grade, RoundSpec } from "../types";
import { scoreNote } from "./rubric";
import { isOverreach } from "./grades";

/**
 * The contribution tracker (spec §3): private, self-only, formative. Derived
 * from the trainee's own notes joined to the case's round schedule and the
 * currently revealed chart. No table, no forfeiture, no leaderboard. Pure; no
 * React.
 *
 * v1 single-rubric limitation (fork A): a rubric percentage is shown only for
 * the round the case's one rubric scores (the round whose encounterId matches a
 * trainee note the rubric applies to, i.e. the day-1 round on enc-admission).
 * Other rounds a trainee wrote show "you wrote this" without a percentage.
 */
export type ContributionStatus = "you" | "team" | "current" | "unreached";

export type ContributionRow = {
  key: string;
  label: string;
  status: ContributionStatus;
  /** Rubric percentage for the rubric round only; null elsewhere. */
  percent: number | null;
  /** Neutral flag: the trainee is acting above the case's expected grade. */
  aboveGrade: boolean;
};

export function buildContribution(args: {
  rounds: RoundSpec[];
  userNotes: ClinicalNote[];
  liveNotes: ClinicalNote[];
  rubric: CaseRubric;
  userGrade: Grade;
  simNow: number;
}): ContributionRow[] {
  const { rounds, userNotes, liveNotes, rubric, userGrade, simNow } = args;
  const userIds = new Set(userNotes.map((n) => n.id));
  const aboveGrade = isOverreach(userGrade, rubric.task.minGrade);
  // The rubric scores the day-1 round; its encounter is where trainee notes land
  // by default (enc-admission). Percent is shown only there.
  const rubricEncounterId = "enc-admission";

  return rounds.map((round) => {
    const mine = userNotes.find((n) => n.encounterId === round.encounterId);
    if (mine) {
      const isRubricRound = round.encounterId === rubricEncounterId;
      const result = isRubricRound ? scoreNote(mine.body, rubric) : null;
      const percent =
        result && result.possible > 0 ? Math.round((100 * result.total) / result.possible) : null;
      return { key: round.encounterId, label: round.label, status: "you", percent, aboveGrade };
    }
    const npc = liveNotes.find((n) => n.encounterId === round.encounterId && !userIds.has(n.id));
    if (npc) {
      return { key: round.encounterId, label: round.label, status: "team", percent: null, aboveGrade: false };
    }
    const status: ContributionStatus = simNow >= round.at ? "current" : "unreached";
    return { key: round.encounterId, label: round.label, status, percent: null, aboveGrade: false };
  });
}
