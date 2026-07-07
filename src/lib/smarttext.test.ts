import { describe, expect, test } from "vitest";
import { matchPhrases, plainTextToEditorHtml, SMART_PHRASES } from "./smarttext";
import type { CasePatient } from "../types";

const patient: CasePatient = {
  surname: "Bennett",
  forename: "Sandra",
  displayName: "Bennett, Sandra",
  initials: "SB",
  pronouns: "she/her",
  sex: "Female",
  age: 57,
  dob: "22/09/1968",
  mrn: "LEG-000003",
  location: "AMU Bay 7",
  specialty: "General Medicine",
  attending: {
    forename: "Folake",
    surname: "Adeyemi",
    credential: "MD",
    specialty: "General Medicine",
  },
  primaryCare: {
    forename: "Eleanor",
    surname: "Byrne",
    credential: "MD",
    specialty: "General Practice",
  },
  // Angle brackets on purpose: proves patient data is HTML-escaped.
  allergies: "Aspirin <angioedema & bronchospasm>",
  isolation: "None",
  code: "For escalation",
  acuity: "",
  presentingComplaint: "",
  phone: "",
  infection: "",
  bmi: "31.4",
  stickyNote: "",
};

function wildcardCount(html: string): number {
  return (html.match(/st-wildcard/g) ?? []).length;
}

describe("matchPhrases", () => {
  test("matches ids case-insensitively", () => {
    expect(matchPhrases("hp").map((p) => p.id)).toContain("HP");
    expect(matchPhrases("HP").map((p) => p.id)).toContain("HP");
  });

  test("ignores a leading dot, so trainees can type Epic-style .hp", () => {
    expect(matchPhrases(".hp").map((p) => p.id)).toContain("HP");
  });

  test("matches by substring of id or label", () => {
    expect(matchPhrases("prog").map((p) => p.id)).toEqual(["PROGRESS"]);
    expect(matchPhrases("admission").map((p) => p.id)).toEqual(["HP"]);
  });

  test("empty or whitespace query matches nothing", () => {
    expect(matchPhrases("")).toEqual([]);
    expect(matchPhrases("   ")).toEqual([]);
  });

  test("no-match query returns empty", () => {
    expect(matchPhrases("zzz")).toEqual([]);
  });
});

describe("HP template", () => {
  const hp = SMART_PHRASES.find((p) => p.id === "HP")!;
  const html = hp.build(patient, "01/07/2026");

  test("autofills the demographics stem", () => {
    expect(html).toContain("Bennett, Sandra is a 57yr old female with ");
  });

  test("autofills admission date and PCP", () => {
    expect(html).toContain("Admission Date: 01/07/2026");
    expect(html).toContain("Byrne, Eleanor, MD");
  });

  test("autofills allergies, HTML-escaped", () => {
    expect(html).toContain("Aspirin &lt;angioedema &amp; bronchospasm&gt;");
    expect(html).not.toContain("<angioedema");
  });

  test("has exactly 9 wildcard chips, all non-editable", () => {
    expect(wildcardCount(html)).toBe(9);
    expect(
      (html.match(/<span class="st-wildcard" contenteditable="false">\*\*\*<\/span>/g) ?? [])
        .length,
    ).toBe(9);
  });

  test("has the chart-review section headers", () => {
    for (const header of [
      "HISTORY OF PRESENT ILLNESS:",
      "PAST MEDICAL HISTORY:",
      "PAST SURGICAL HISTORY:",
      "ALLERGIES:",
      "MEDICATIONS:",
      "PHYSICAL EXAM:",
      "LABS:",
      "ASSESSMENT:",
      "PLAN:",
    ]) {
      expect(html).toContain(header);
    }
  });
});

describe("PROGRESS template", () => {
  const progress = SMART_PHRASES.find((p) => p.id === "PROGRESS")!;
  const html = progress.build(patient, "01/07/2026");

  test("has the SOAP skeleton with 4 wildcards", () => {
    expect(wildcardCount(html)).toBe(4);
    for (const header of ["Subjective:", "Objective:", "Assessment:", "Plan:"]) {
      expect(html).toContain(header);
    }
  });

  test("stems with the patient name and admission date", () => {
    expect(html).toContain("Bennett, Sandra");
    expect(html).toContain("01/07/2026");
  });
});

describe("plainTextToEditorHtml", () => {
  test("wraps lines in divs and blank lines as <div><br></div>", () => {
    expect(plainTextToEditorHtml("One\n\nTwo")).toBe(
      "<div>One</div><div><br></div><div>Two</div>",
    );
  });

  test("escapes HTML in the stored text", () => {
    expect(plainTextToEditorHtml("a <b> & c")).toBe("<div>a &lt;b&gt; &amp; c</div>");
  });

  test("reconstitutes *** into wildcard chips so the Sign gate survives", () => {
    const html = plainTextToEditorHtml("CC: ***");
    expect(html).toBe(
      '<div>CC: <span class="st-wildcard" contenteditable="false">***</span></div>',
    );
  });

  test("multiple wildcards on one line each become chips", () => {
    expect(
      (plainTextToEditorHtml("*** and ***").match(/st-wildcard/g) ?? []).length,
    ).toBe(2);
  });
});
