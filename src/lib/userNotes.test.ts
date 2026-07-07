import { describe, expect, test } from "vitest";
import type { ClinicalNote, NoteDraft, UserProfile } from "../types";
import {
  appendAddendum,
  buildAddendumBlock,
  buildUserNote,
  formatStamp,
  generateHcpId,
  isOwnNote,
  refileUserNote,
} from "./userNotes";

const draft: NoteDraft = {
  id: "draft-1",
  noteType: "Progress Note",
  service: "(A) General Surgery — AMU",
  body: "<div>unused here</div>",
};

const user: UserProfile = { forename: "Ryan", surname: "Ho", hcpId: "d912345" };
const now = new Date(2026, 6, 4, 9, 5); // 04/07/2026 09:05 local

describe("formatStamp", () => {
  test("formats DD/MM HH:MM with zero padding", () => {
    expect(formatStamp(now)).toBe("04/07 09:05");
  });
});

describe("buildUserNote", () => {
  test("builds a signed note attributed to the user", () => {
    const note = buildUserNote(draft, user, "Plan: ERCP.", "signed", now);
    expect(note.kind).toBe("note");
    expect(note.author).toBe("Ho, Ryan");
    expect(note.credential).toBe("MS");
    expect(note.authorRole).toBe("*MEDICAL STUDENT");
    expect(note.status).toBe("signed");
    expect(note.body).toBe("Plan: ERCP.");
    expect(note.admission).toBe(true);
    expect(note.encounterId).toBe("enc-admission");
    expect(note.dateOfService).toBe("04/07 09:05");
    expect(note.fileTime).toBe("04/07 09:05");
    expect(note.timestamp).toBe(Math.floor(now.getTime() / 1000));
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
      const note = buildUserNote({ ...draft, noteType }, user, "x", "signed", now);
      expect(note.category, noteType).toBe(category);
    }
  });

  test("pended drafts become incomplete notes with a dash file time", () => {
    const note = buildUserNote(draft, user, "wip", "incomplete", now);
    expect(note.status).toBe("incomplete");
    expect(note.fileTime).toBe("—");
  });

  test("ids are unique per draft and time", () => {
    const a = buildUserNote(draft, user, "x", "signed", now);
    const b = buildUserNote({ ...draft, id: "draft-2" }, user, "x", "signed", now);
    expect(a.id).not.toBe(b.id);
  });
});

const testUser: UserProfile = { forename: "Jordan", surname: "Lee", hcpId: "d912345" };

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

describe("generateHcpId", () => {
  test("is a d9-prefixed six-digit doctor id", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateHcpId()).toMatch(/^d9\d{5}$/);
    }
  });
});

describe("isOwnNote", () => {
  test("matches the login's doctor id", () => {
    expect(isOwnNote({ ...baseNote, authorId: "d912345" }, "d912345")).toBe(true);
  });

  test("matches the case's player persona id", () => {
    expect(isOwnNote({ ...baseNote, authorId: "d284617" }, "d912345", "d284617")).toBe(true);
  });

  test("rejects other authors and notes without an authorId", () => {
    expect(isOwnNote({ ...baseNote, authorId: "d000001" }, "d912345", "d284617")).toBe(false);
    expect(isOwnNote(baseNote, "d912345", "d284617")).toBe(false);
  });

  test("user-note- prefix is a backstop for pre-ID stored notes", () => {
    expect(isOwnNote({ ...baseNote, id: "user-note-1-draft-1" }, "d912345")).toBe(true);
  });
});

describe("buildAddendumBlock / appendAddendum", () => {
  const now = new Date(2026, 6, 7, 9, 5); // 07/07/2026 09:05

  test("stamps author and full date", () => {
    expect(buildAddendumBlock(testUser, "Seen again post ERCP.", now)).toBe(
      "ADDENDUM — Lee, Jordan, MS — 07/07/2026 09:05:\nSeen again post ERCP.",
    );
  });

  test("appendAddendum stacks blocks with a blank line", () => {
    const first = buildAddendumBlock(testUser, "One.", now);
    const second = buildAddendumBlock(testUser, "Two.", now);
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
    credential: "MS",
    authorRole: "*MEDICAL STUDENT",
    authorId: "d912345",
    status: "incomplete",
    fileTime: "—",
  };
  const now = new Date(2026, 6, 7, 10, 30);

  test("keeps identity, replaces content and stamps", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "signed", now);
    expect(refiled.id).toBe(original.id);
    expect(refiled.author).toBe("Lee, Jordan");
    expect(refiled.authorId).toBe("d912345");
    expect(refiled.body).toBe("NEW BODY");
    expect(refiled.status).toBe("signed");
    expect(refiled.noteType).toBe("H&P");
    expect(refiled.category).toBe("H&P");
    expect(refiled.timestamp).toBe(Math.floor(now.getTime() / 1000));
    expect(refiled.dateOfService).toBe("07/07 10:30");
    expect(refiled.fileTime).toBe("07/07 10:30");
  });

  test("pending again leaves fileTime em-dashed", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "incomplete", now);
    expect(refiled.fileTime).toBe("—");
  });
});

describe("buildUserNote authorId", () => {
  test("stamps the login's doctor id", () => {
    const draft: NoteDraft = { id: "draft-1", noteType: "Progress Note", service: "(A) GS", body: "" };
    const note = buildUserNote(draft, testUser, "text", "signed", new Date(2026, 6, 7));
    expect(note.authorId).toBe("d912345");
  });
});
