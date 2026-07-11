import { describe, expect, test } from "vitest";
import { hydrateSession } from "./sessionState";

const known = (id: string) => id === "a" || id === "b";
const EMPTY = { openCaseIds: [], activeCaseId: null, caseUi: {} };

describe("hydrateSession", () => {
  test("null or malformed JSON returns empty state", () => {
    expect(hydrateSession(null, known)).toEqual(EMPTY);
    expect(hydrateSession("{not json", known)).toEqual(EMPTY);
    expect(hydrateSession("42", known)).toEqual(EMPTY);
  });

  test("drops unknown case ids and their ui entries", () => {
    const raw = JSON.stringify({
      openCaseIds: ["a", "gone"],
      activeCaseId: "a",
      caseUi: { a: { mainTab: "notes" }, gone: { mainTab: "chart" } },
    });
    const out = hydrateSession(raw, known);
    expect(out.openCaseIds).toEqual(["a"]);
    expect(Object.keys(out.caseUi)).toEqual(["a"]);
  });

  test("resets a dangling activeCaseId to null", () => {
    const raw = JSON.stringify({ openCaseIds: ["b"], activeCaseId: "gone", caseUi: {} });
    expect(hydrateSession(raw, known).activeCaseId).toBe(null);
  });

  test("keeps a valid active id", () => {
    const raw = JSON.stringify({ openCaseIds: ["a", "b"], activeCaseId: "b", caseUi: {} });
    expect(hydrateSession(raw, known).activeCaseId).toBe("b");
  });
});
