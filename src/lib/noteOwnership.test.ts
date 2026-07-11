import { describe, expect, test } from "vitest";
import type { Note } from "../types";
import { noteOwnership } from "./noteOwnership";

function note(id: string, authorId?: string): Note {
  return {
    kind: "note", id, encounterId: "enc-admission", category: "Progress",
    noteType: "Progress Note", author: "X, Y", credential: "MD", authorRole: "*PHYSICIAN",
    service: "(A) General Surgery", dateOfService: "16/06 17:00", fileTime: "16/06 17:00",
    timestamp: 1, status: "signed", authorId, body: "b",
  };
}

describe("noteOwnership", () => {
  const mine = note("n1", "d9-ME");
  const otherAlias = note("n2", "d9-OTHER");
  const legacy = note("n3"); // account note, no authorId stamped
  const userNotes = [mine, otherAlias, legacy];
  const args = { userNotes, myHcpId: "d9-ME" };

  test("current persona's note: editable and deletable", () => {
    expect(noteOwnership(mine, args)).toEqual({ canEdit: true, canDelete: true });
  });
  test("another alias's account note: not editable or deletable", () => {
    expect(noteOwnership(otherAlias, args)).toEqual({ canEdit: false, canDelete: false });
  });
  test("legacy account note with no authorId: grandfathered to current persona", () => {
    expect(noteOwnership(legacy, args)).toEqual({ canEdit: true, canDelete: true });
  });
  test("a note not owned by the account: not editable or deletable", () => {
    expect(noteOwnership(note("zzz", "d9-STRANGER"), args)).toEqual({ canEdit: false, canDelete: false });
  });
});
