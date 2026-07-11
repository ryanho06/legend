import { describe, expect, test } from "vitest";
import type { ClinicalNote, NoteDraft, UserProfile } from "../types";
import {
  appendAddendum,
  buildAddendumBlock,
  buildUserNote,
  foldAddenda,
  formatStamp,
  refileUserNote,
} from "./userNotes";
import { caseNow } from "./simTime";

const draft: NoteDraft = {
  id: "draft-1",
  noteType: "Progress Note",
  service: "(A) General Surgery — AMU",
  body: "<div>unused here</div>",
};

const user: UserProfile = { forename: "Ryan", surname: "Ho", hcpId: "d912345", grade: "fy" };
const nowSec = Date.UTC(2026, 6, 4, 9, 5) / 1000; // 04/07/2026 09:05 UTC

describe("formatStamp", () => {
  test("formats DD/MM HH:MM with zero padding", () => {
    expect(formatStamp(new Date(2026, 6, 4, 9, 5))).toBe("04/07 09:05");
  });
});

describe("buildUserNote", () => {
  test("builds a signed note attributed to the user", () => {
    const note = buildUserNote(draft, user, "Plan: ERCP.", "signed", nowSec);
    expect(note.kind).toBe("note");
    expect(note.author).toBe("Ho, Ryan");
    expect(note.credential).toBe("MD");
    expect(note.authorRole).toBe("*PHYSICIAN: RESIDENT");
    expect(note.status).toBe("signed");
    expect(note.body).toBe("Plan: ERCP.");
    expect(note.admission).toBe(true);
    expect(note.encounterId).toBe("enc-admission");
    expect(note.dateOfService).toBe("04/07/26 0905");
    expect(note.fileTime).toBe("04/07/26 0905");
    expect(note.timestamp).toBe(nowSec);
  });

  test("maps each editor note type to its browser category", () => {
    const cases: [string, string][] = [
      ["Progress Note", "Progress"],
      ["H&P", "H&P"],
      ["Consult Note", "Consults"],
      ["Procedure Note", "Procedures"],
      ["Nursing Note", "Nursing"],
      ["Discharge Summary", "Discharge"],
    ];
    for (const [noteType, category] of cases) {
      const note = buildUserNote({ ...draft, noteType }, user, "x", "signed", nowSec);
      expect(note.category, noteType).toBe(category);
    }
  });

  test("pended drafts become incomplete notes with a dash file time", () => {
    const note = buildUserNote(draft, user, "wip", "incomplete", nowSec);
    expect(note.status).toBe("incomplete");
    expect(note.fileTime).toBe("—");
  });

  test("server assigns the id on POST", () => {
    const a = buildUserNote(draft, user, "x", "signed", nowSec);
    const b = buildUserNote({ ...draft, id: "draft-2" }, user, "x", "signed", nowSec);
    expect(a.id).toBe("");
    expect(b.id).toBe("");
  });
});

const testUser: UserProfile = { forename: "Jordan", surname: "Lee", hcpId: "d912345", grade: "fy" };

const baseNote: ClinicalNote = {
  kind: "note",
  id: "note-prog-003",
  encounterId: "enc-admission",
  category: "Progress",
  noteType: "Gastroenterology Progress",
  author: "Mensah, Daniel",
  credential: "MD",
  authorRole: "*PHYSICIAN: RESIDENT",
  service: "(A) Gastroenterology",
  dateOfService: "Today 13:10",
  fileTime: "Today 13:24",
  timestamp: 1781529000,
  status: "cosign",
  body: "PROGRESS NOTE BODY",
};

describe("buildAddendumBlock / appendAddendum", () => {
  const nowSec = Date.UTC(2026, 6, 7, 9, 5) / 1000; // 07/07/2026 09:05 UTC

  test("stamps author and full date", () => {
    expect(buildAddendumBlock(testUser, "Seen again post ERCP.", nowSec)).toBe(
      "ADDENDUM — Lee, Jordan, MD — 07/07/2026 09:05:\nSeen again post ERCP.",
    );
  });

  test("consultant addendum stamps MD too, role follows grade on filed notes", () => {
    const consultant: UserProfile = { ...testUser, grade: "consultant" };
    const draft: NoteDraft = { id: "draft-2", noteType: "Progress Note", service: "(A) GS", body: "" };
    const note = buildUserNote(draft, consultant, "text", "signed", Date.UTC(2026, 6, 7) / 1000);
    expect(note.credential).toBe("MD");
    expect(note.authorRole).toBe("*PHYSICIAN: FACULTY");
  });

  test("appendAddendum stacks blocks with a blank line", () => {
    const first = buildAddendumBlock(testUser, "One.", nowSec);
    const second = buildAddendumBlock(testUser, "Two.", nowSec);
    expect(appendAddendum(undefined, first)).toBe(first);
    expect(appendAddendum(first, second)).toBe(`${first}\n\n${second}`);
  });
});

describe("refileUserNote", () => {
  const draft: NoteDraft = {
    id: "draft-9",
    noteType: "H&P",
    service: "(A) Gastroenterology",
    body: "<div>ignored, plainBody wins</div>",
    mode: "edit",
    targetNoteId: "user-note-5-draft-2",
  };
  const original: ClinicalNote = {
    ...baseNote,
    id: "user-note-5-draft-2",
    author: "Lee, Jordan",
    credential: "MD",
    authorRole: "*PHYSICIAN: RESIDENT",
    authorId: "d912345",
    status: "incomplete",
    fileTime: "—",
  };
  const nowSec = Date.UTC(2026, 6, 7, 10, 30) / 1000;

  test("keeps identity, replaces content and stamps", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "signed", nowSec);
    expect(refiled.id).toBe(original.id);
    expect(refiled.author).toBe("Lee, Jordan");
    expect(refiled.authorId).toBe("d912345");
    expect(refiled.body).toBe("NEW BODY");
    expect(refiled.status).toBe("signed");
    expect(refiled.noteType).toBe("H&P");
    expect(refiled.category).toBe("H&P");
    expect(refiled.timestamp).toBe(nowSec);
    expect(refiled.dateOfService).toBe("07/07/26 1030");
    expect(refiled.fileTime).toBe("07/07/26 1030");
  });

  test("pending again leaves fileTime em-dashed", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "incomplete", nowSec);
    expect(refiled.fileTime).toBe("—");
  });
});

describe("buildUserNote authorId", () => {
  test("stamps the login's doctor id", () => {
    const draft: NoteDraft = { id: "draft-1", noteType: "Progress Note", service: "(A) GS", body: "" };
    const note = buildUserNote(draft, testUser, "text", "signed", Date.UTC(2026, 6, 7) / 1000);
    expect(note.authorId).toBe("d912345");
  });
});

describe("foldAddenda", () => {
  test("folds rows into per-note blocks in createdAt order", () => {
    const folded = foldAddenda([
      { noteId: "n1", body: "second", createdAt: 2 },
      { noteId: "n1", body: "first", createdAt: 1 },
      { noteId: "n2", body: "only", createdAt: 3 },
    ]);
    expect(folded["n1"]).toBe("first\n\nsecond");
    expect(folded["n2"]).toBe("only");
  });
  test("returns an empty record for no rows", () => {
    expect(foldAddenda([])).toEqual({});
  });
});

describe("caseNow offset", () => {
  test("adds a sim offset to the anchor", () => {
    expect(caseNow(1000, 3600)).toBe(4600);
  });
  test("defaults to offset 0 (back-compat)", () => {
    expect(caseNow(1000)).toBe(1000);
  });
});

describe("buildUserNote encounterId param", () => {
  test("defaults to enc-admission", () => {
    const note = buildUserNote(draft, user, "body", "signed", nowSec);
    expect(note.encounterId).toBe("enc-admission");
  });
  test("uses the provided round encounterId", () => {
    const note = buildUserNote(draft, user, "body", "signed", nowSec, "enc-ward-round-d2");
    expect(note.encounterId).toBe("enc-ward-round-d2");
  });
});
