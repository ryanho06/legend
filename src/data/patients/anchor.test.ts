import { describe, expect, test } from "vitest";
import { formatDate } from "../../lib/simTime";
import { getCase } from "./index";

describe("case anchor", () => {
  test("cholangitis001 is anchored to its frozen chart date", () => {
    const anchor = getCase("cholangitis001").anchor;
    expect(anchor).toBe(Date.UTC(2026, 5, 16, 17, 0) / 1000);
    expect(anchor).not.toBeUndefined();
    expect(formatDate(anchor as number)).toBe("16/06/2026");
  });

  test("a non-pilot case has no anchor yet (keeps wall-clock behaviour)", () => {
    expect(getCase("appendicitis001").anchor).toBeUndefined();
  });
});
