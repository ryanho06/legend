import { describe, expect, test } from "vitest";
import { matchPhrases, plainTextToEditorHtml, SMART_PHRASES } from "./smarttext";
import type { BloodRow, CaseBundle, CasePatient, CaseRubric, CaseSummary, VitalsPoint } from "../types";

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

const vitals: VitalsPoint = { t: "07/07 06:00", sys: 128, dia: 76, hr: 91, resp: 18, spo2: 95, tempC: 37.8 };

const bloods: BloodRow[] = [
  { test: "WBC", value: "14.2", range: "4.0-11.0", flag: "H" },
  { test: "Na", value: "138", range: "133-146", flag: "" },
];

const rubric: CaseRubric = {
  caseId: "test001",
  noteType: "Progress Notes",
  task: { code: "ward", label: "WARD ROUND REVIEW", minGrade: "fy" },
  items: [],
  wordBand: { target: 200, max: 400 },
  sections: [],
  modelNote: "",
};

const summary: CaseSummary = {
  workingDiagnosis: "test",
  vitalsTrend: [
    { ...vitals, t: "06/07 06:00", hr: 80 },
    vitals, // last point is what PROGRESS must use
  ],
  activeProblems: [],
  ipMeds: [],
  weights: [],
  firstWeight: { when: "01/07", value: "70" },
  microbiology: [],
  linesDrains: [],
  diseaseReports: [],
};

const bundle: CaseBundle = {
  id: "test001",
  specialty: "General Medicine",
  handoff: "",
  patient,
  documents: [],
  notes: [],
  encounters: [],
  rubric,
  summary,
  bloods,
};

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
  const html = hp.build(bundle, "01/07/2026");

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
  const html = progress.build(bundle, "01/07/2026");

  test("header autofills name, room, specialty; hospital day is a wildcard", () => {
    expect(html).toContain("Bennett, Sandra | RM AMU Bay 7 | GENERAL MEDICINE PROGRESS NOTE - HOSPITAL DAY: ");
  });

  test("vitals line uses the LAST trend point", () => {
    expect(html).toContain("T 37.8 · HR 91 · BP 128/76 · RR 18 · SpO2 95%");
    expect(html).not.toContain("HR 80");
  });

  test("labs render every blood row with value, range and flag", () => {
    expect(html).toContain("WBC 14.2 (4.0-11.0) H");
    expect(html).toContain("Na 138 (133-146)");
  });

  test("exam bullets and closing fields are wildcards; 15 chips total", () => {
    for (const stub of ["Gen - ", "CV - ", "Lungs - ", "Abd - ", "Extremities - ", "Neuro - ", "IVF: ", "Diet: ", "DVT prophylaxis: "]) {
      expect(html).toContain(stub);
    }
    expect((html.match(/st-wildcard/g) ?? []).length).toBe(15);
  });

  test("has the section headers", () => {
    for (const header of ["INTERVAL HISTORY:", "SUBJECTIVE:", "OBJECTIVE:", "LABS:", "IMAGING:", "MICRO:", "ASSESSMENT & PLAN:"]) {
      expect(html).toContain(header);
    }
  });
});

describe("PTWR template", () => {
  const ptwr = SMART_PHRASES.find((p) => p.id === "PTWR")!;
  const html = ptwr.build(bundle, "01/07/2026");

  test("stems with demographics and admission date", () => {
    expect(html).toContain("POST-TAKE WARD ROUND — General Medicine");
    expect(html).toContain("Bennett, Sandra is a 57yr old female admitted 01/07/2026 with ");
  });

  test("7 chips: seen-with, stem, exam, impression, three plan items", () => {
    expect((html.match(/st-wildcard/g) ?? []).length).toBe(7);
    for (const header of ["Seen with: ", "EXAMINATION:", "IMPRESSION:", "PLAN:"]) {
      expect(html).toContain(header);
    }
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
