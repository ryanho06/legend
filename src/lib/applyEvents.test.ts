import { describe, expect, test } from "vitest";
import type { ClinicalNote, ClinicalLab, Encounter, VitalsPoint } from "../types";
import { getCase } from "../data/patients/index";
import { appendAddendum } from "./userNotes";
import { applyEvents, workToEvents } from "./applyEvents";

const bundle = getCase("cholangitis001");

function userNote(id: string, addendum?: string): ClinicalNote {
  return {
    kind: "note",
    id,
    encounterId: "enc-admission",
    category: "Progress",
    noteType: "Progress Note",
    author: "Ho, Ryan",
    credential: "MD",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery",
    dateOfService: "16/06/26 1700",
    fileTime: "16/06/26 1700",
    timestamp: 1781629200,
    status: "signed",
    admission: true,
    body: "user note body",
    addendum,
  };
}

describe("base bundle invariant", () => {
  test("notes equals the kind:note subset of documents", () => {
    expect(bundle.notes).toEqual(bundle.documents.filter((d) => d.kind === "note"));
  });
});

describe("applyEvents identity + immutability", () => {
  test("returns the same reference for no events", () => {
    expect(applyEvents(bundle, [])).toBe(bundle);
  });

  test("never mutates the input bundle", () => {
    const beforeLen = bundle.documents.length;
    const live = applyEvents(bundle, [{ kind: "note.create", note: userNote("u1") }]);
    expect(bundle.documents.length).toBe(beforeLen);
    expect(live.documents).not.toBe(bundle.documents);
  });
});

describe("applyEvents note.create", () => {
  test("appends the note to documents and recomputes notes", () => {
    const note = userNote("u1");
    const live = applyEvents(bundle, [{ kind: "note.create", note }]);
    expect(live.documents.at(-1)).toEqual(note);
    expect(live.notes.at(-1)).toEqual(note);
    expect(live.notes).toEqual(live.documents.filter((d) => d.kind === "note"));
  });
});

describe("applyEvents note.addendum", () => {
  test("appends an addendum block to a static note by id", () => {
    const target = bundle.notes[0];
    const live = applyEvents(bundle, [
      { kind: "note.addendum", noteId: target.id, block: "ADDX" },
    ]);
    const patched = live.documents.find((d) => d.id === target.id) as ClinicalNote;
    expect(patched.addendum).toBe(appendAddendum(target.addendum, "ADDX"));
  });

  test("targets a created user note that carried no addendum", () => {
    const note = userNote("u1");
    const live = applyEvents(bundle, [
      { kind: "note.create", note },
      { kind: "note.addendum", noteId: "u1", block: "ADDX" },
    ]);
    const patched = live.notes.find((n) => n.id === "u1") as ClinicalNote;
    expect(patched.addendum).toBe("ADDX");
  });

  test("ignores an addendum whose target id is absent", () => {
    const live = applyEvents(bundle, [
      { kind: "note.addendum", noteId: "nope", block: "X" },
    ]);
    expect(live.documents.map((d) => d.id)).toEqual(bundle.documents.map((d) => d.id));
  });
});

describe("workToEvents", () => {
  test("emits every note.create before any note.addendum", () => {
    const events = workToEvents([userNote("a"), userNote("b")], { a: "AX" });
    expect(events.map((e) => e.kind)).toEqual(["note.create", "note.create", "note.addendum"]);
  });
});

describe("behaviour preservation vs the old hand-merge", () => {
  test("folded documents and notes deep-equal the old formula", () => {
    const notes = [userNote("u1"), userNote("u2", "static addendum")];
    const addenda: Record<string, string> = {
      [bundle.notes[0].id]: "server addendum on a static note",
      u1: "server addendum on a user note",
    };

    // The exact expressions PatientWorkspace used before this refactor.
    const withAddenda = <T extends ClinicalNote>(note: T): T =>
      addenda[note.id]
        ? { ...note, addendum: appendAddendum(note.addendum, addenda[note.id]) }
        : note;
    const oldDocuments = [
      ...bundle.documents.map((doc) => (doc.kind === "note" ? withAddenda(doc) : doc)),
      ...notes.map(withAddenda),
    ];
    const oldNotes = [...bundle.notes.map(withAddenda), ...notes.map(withAddenda)];

    const live = applyEvents(bundle, workToEvents(notes, addenda));
    expect(live.documents).toEqual(oldDocuments);
    expect(live.notes).toEqual(oldNotes);
  });
});

describe("applyEvents sim-reveal kinds", () => {
  const lab: ClinicalLab = {
    kind: "lab",
    id: "reveal-lab-1",
    encounterId: "enc-admission",
    title: "Repeat LFTs",
    status: "Final",
    specimen: "Blood",
    collected: "17/06/2026 06:00",
    reportedAt: "17/06/2026 07:00",
    rows: [],
  };
  const encounter: Encounter = {
    id: "reveal-enc-1",
    type: "Ward Round",
    date: "17/06/2026",
    time: "08:00",
    class: "inpatient",
    specialty: "General Surgery",
    deptAbbrev: "GSAMU",
    provider: "Team, FY2",
    description: "Day 2 review",
    status: "Open",
    location: "AMU",
  };
  const point: VitalsPoint = {
    t: "16:00",
    sys: 118,
    dia: 72,
    hr: 88,
    resp: 16,
    spo2: 98,
    tempC: 37.0,
  };

  test("result.release appends the document, notes unchanged", () => {
    const live = applyEvents(bundle, [{ kind: "result.release", document: lab }]);
    expect(live.documents.at(-1)).toEqual(lab);
    expect(live.notes).toEqual(bundle.notes);
    expect(live.documents).not.toBe(bundle.documents);
  });

  test("encounter.append prepends at index 0", () => {
    const live = applyEvents(bundle, [{ kind: "encounter.append", encounter }]);
    expect(live.encounters[0]).toEqual(encounter);
    expect(live.encounters.length).toBe(bundle.encounters.length + 1);
    expect(live.encounters).not.toBe(bundle.encounters);
  });

  test("vitals.append appends a point to summary.vitalsTrend", () => {
    const live = applyEvents(bundle, [{ kind: "vitals.append", point }]);
    expect(live.summary.vitalsTrend.at(-1)).toEqual(point);
    expect(live.summary).not.toBe(bundle.summary);
    expect(bundle.summary.vitalsTrend.at(-1)).not.toEqual(point); // input untouched
  });

  test("flag.set writes into a runtime flags map without touching the input", () => {
    const live = applyEvents(bundle, [{ kind: "flag.set", key: "ercpDone", value: true }]);
    expect(live.flags).toEqual({ ercpDone: true });
    expect(bundle.flags).toBeUndefined();
  });

  test("multiple kinds fold together, input bundle never mutates", () => {
    const beforeDocs = bundle.documents.length;
    const beforeEnc = bundle.encounters.length;
    const live = applyEvents(bundle, [
      { kind: "result.release", document: lab },
      { kind: "encounter.append", encounter },
      { kind: "vitals.append", point },
      { kind: "flag.set", key: "n", value: 2 },
    ]);
    expect(live.documents.length).toBe(beforeDocs + 1);
    expect(live.encounters.length).toBe(beforeEnc + 1);
    expect(bundle.documents.length).toBe(beforeDocs);
    expect(bundle.encounters.length).toBe(beforeEnc);
  });
});
