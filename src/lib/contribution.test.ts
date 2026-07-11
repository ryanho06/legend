import { describe, expect, test } from "vitest";
import type { CaseRubric, ClinicalNote, RoundSpec } from "../types";
import { buildContribution } from "./contribution";

const rounds: RoundSpec[] = [
  { at: 0, encounterId: "enc-admission", label: "Post-take ward round (day 1)" },
  { at: 54000, encounterId: "enc-ward-round-d2", label: "Progress note (day 2)", npcNoteId: "npc-d2" },
  { at: 140400, encounterId: "enc-ward-round-d3", label: "Progress note (day 3)", npcNoteId: "npc-d3" },
];

function note(id: string, encounterId: string, body = "acute cholangitis, ERCP, hold metformin"): ClinicalNote {
  return {
    kind: "note",
    id,
    encounterId,
    category: "Progress",
    noteType: "Progress Note",
    author: "Lee, Sam",
    credential: "MD",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery",
    dateOfService: "16/06/26 1700",
    fileTime: "16/06/26 1700",
    timestamp: 1781629200,
    status: "signed",
    body,
  };
}

const rubric = {
  caseId: "x",
  noteType: "Progress Note",
  task: { code: "ptwr", label: "POST-TAKE WARD ROUND", minGrade: "st3" },
  wordBand: { target: 140, max: 240 },
  sections: [["impression"], ["plan"]],
  items: [{ id: "dx", label: "names it", category: "assessment", weight: 10, triggers: [[["cholangitis"]]], explanation: "x", pdqi: ["accurate"] }],
  modelNote: "",
} as unknown as CaseRubric;

describe("buildContribution", () => {
  test("marks a trainee-written round as 'you' with a rubric percent on the rubric round", () => {
    const userNotes = [note("u1", "enc-admission")];
    const rows = buildContribution({ rounds, userNotes, liveNotes: userNotes, rubric, userGrade: "st3", simNow: 0 });
    expect(rows[0].status).toBe("you");
    expect(rows[0].percent).toBe(100); // the note matches the single rubric item
    expect(rows[1].status).toBe("unreached");
  });

  test("a trainee-written day-2 round is 'you' with no percent (single-rubric limitation)", () => {
    const userNotes = [note("u2", "enc-ward-round-d2")];
    const rows = buildContribution({ rounds, userNotes, liveNotes: userNotes, rubric, userGrade: "st3", simNow: 140400 });
    expect(rows[1].status).toBe("you");
    expect(rows[1].percent).toBeNull();
  });

  test("a revealed NPC note marks the round 'team'", () => {
    const npc = note("npc-d2", "enc-ward-round-d2", "day 2 recovering well");
    const rows = buildContribution({ rounds, userNotes: [], liveNotes: [npc], rubric, userGrade: "st3", simNow: 208800 });
    expect(rows[1].status).toBe("team");
  });

  test("a reached-but-empty round is 'current', a future round 'unreached'", () => {
    const rows = buildContribution({ rounds, userNotes: [], liveNotes: [], rubric, userGrade: "st3", simNow: 54000 });
    expect(rows[0].status).toBe("current"); // simNow 54000 >= round 0 at 0, no note
    expect(rows[1].status).toBe("current"); // simNow 54000 >= round 1 at 54000, no note
    expect(rows[2].status).toBe("unreached"); // round 2 at 140400 > simNow
  });

  test("flags aboveGrade neutrally when the trainee is below the case grade", () => {
    const userNotes = [note("u1", "enc-admission")];
    const rows = buildContribution({ rounds, userNotes, liveNotes: userNotes, rubric, userGrade: "fy", simNow: 0 });
    expect(rows[0].aboveGrade).toBe(true);
  });

  test("empty rounds yields no rows", () => {
    expect(buildContribution({ rounds: [], userNotes: [], liveNotes: [], rubric, userGrade: "st3", simNow: 0 })).toEqual([]);
  });
});
