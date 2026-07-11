import { describe, expect, test } from "vitest";
import { buildUserNote } from "./userNotes";
import { caseNow } from "./simTime";
import type { NoteDraft, UserProfile } from "../types";

const draft: NoteDraft = { id: "d1", noteType: "Progress Note", service: "(A) General Surgery", body: "" };
const user: UserProfile = { forename: "Sam", surname: "Lee", hcpId: "d912345", grade: "st3" };

describe("caseNow offset", () => {
  test("adds a sim offset to the anchor", () => {
    expect(caseNow(1000, 3600)).toBe(4600);
  });
  test("defaults to offset 0 (back-compat)", () => {
    expect(caseNow(1000)).toBe(1000);
  });
});

describe("buildUserNote encounterId", () => {
  test("defaults to enc-admission", () => {
    const note = buildUserNote(draft, user, "body", "signed", 1000);
    expect(note.encounterId).toBe("enc-admission");
  });
  test("uses the provided round encounterId", () => {
    const note = buildUserNote(draft, user, "body", "signed", 1000, "enc-ward-round-d2");
    expect(note.encounterId).toBe("enc-ward-round-d2");
  });
});
