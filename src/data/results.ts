/**
 * Synthetic Results Review content for the cholangitis case (Amelia Hart).
 *
 * The Results tab mirrors Epic's Results Review: a category tree on the left and
 * a time-grid flowsheet on the right (analytes as rows, collection times as
 * columns). Numeric panels render in the grid; Microbiology and Imaging are
 * narrative, so they render as result cards instead.
 *
 * All values are synthetic and chosen to be plausible for biliary sepsis in a
 * 64-year-old: a GP baseline with mildly deranged LFTs, then admission bloods
 * showing an obstructive picture, rising inflammatory markers and an early AKI.
 */

export type ResultFlag = "H" | "L" | "HH" | "LL" | "A";

/** One analyte's value at a single collection time. */
export type Cell = {
  value: string;
  flag?: ResultFlag;
};

/** A single test line in the flowsheet, with its values keyed by column id. */
export type AnalyteRow = {
  name: string;
  unit: string;
  range: string;
  /** Value per column id; a missing key renders as a blank cell. */
  values: Record<string, Cell>;
};

/** A grouped set of analytes resulted together, e.g. a Full Blood Count. */
export type AnalytePanel = {
  id: string;
  label: string;
  rows: AnalyteRow[];
};

/** A collection timepoint = one column in the flowsheet. */
export type ResultColumn = {
  id: string;
  /** Header date line, e.g. "16/06/26". */
  date: string;
  /** Header time line, e.g. "08:30". */
  time: string;
  /** Full "collected" string for the hover tooltip. */
  collected: string;
  /** Ordering/source, e.g. "ED", "AMU", "Primary Care". */
  source: string;
};

/** A node in the left-hand category navigator. */
export type ResultNode = {
  id: string;
  label: string;
  /** Count of abnormal results, shown as a small badge. */
  abnormal?: number;
  children?: ResultNode[];
};

/** A non-numeric (text) result, e.g. a culture or an imaging report. */
export type NarrativeResult = {
  test: string;
  collected: string;
  status: "Final" | "Preliminary" | "Pending";
  body: string;
};

/** Collection timepoints, oldest to newest (newest column sits on the right). */
export const resultColumns: ResultColumn[] = [
  { id: "gp", date: "09/11/25", time: "10:15", collected: "09/11/2025 10:15", source: "Primary Care" },
  { id: "ed", date: "16/06/26", time: "08:30", collected: "16/06/2026 08:30", source: "ED" },
  { id: "ward", date: "16/06/26", time: "14:00", collected: "16/06/2026 14:00", source: "AMU" },
];

export const labPanels: AnalytePanel[] = [
  {
    id: "fbc",
    label: "Full Blood Count",
    rows: [
      {
        name: "Haemoglobin",
        unit: "g/L",
        range: "115–160",
        values: { gp: { value: "128" }, ed: { value: "119", flag: "L" }, ward: { value: "116", flag: "L" } },
      },
      {
        name: "White Cell Count",
        unit: "10⁹/L",
        range: "4.0–11.0",
        values: { gp: { value: "7.8" }, ed: { value: "17.4", flag: "H" }, ward: { value: "18.2", flag: "H" } },
      },
      {
        name: "Neutrophils",
        unit: "10⁹/L",
        range: "2.0–7.5",
        values: { gp: { value: "5.1" }, ed: { value: "15.0", flag: "H" }, ward: { value: "15.8", flag: "H" } },
      },
      {
        name: "Lymphocytes",
        unit: "10⁹/L",
        range: "1.0–4.0",
        values: { gp: { value: "1.8" }, ed: { value: "0.9", flag: "L" }, ward: { value: "0.8", flag: "L" } },
      },
      {
        name: "Platelets",
        unit: "10⁹/L",
        range: "150–400",
        values: { gp: { value: "250" }, ed: { value: "168" }, ward: { value: "142", flag: "L" } },
      },
    ],
  },
  {
    id: "ue",
    label: "Urea & Electrolytes",
    rows: [
      {
        name: "Sodium",
        unit: "mmol/L",
        range: "135–145",
        values: { gp: { value: "139" }, ed: { value: "135" }, ward: { value: "134", flag: "L" } },
      },
      {
        name: "Potassium",
        unit: "mmol/L",
        range: "3.5–5.0",
        values: { gp: { value: "4.2" }, ed: { value: "3.6" }, ward: { value: "3.4", flag: "L" } },
      },
      {
        name: "Urea",
        unit: "mmol/L",
        range: "2.5–7.8",
        values: { gp: { value: "5.5" }, ed: { value: "9.2", flag: "H" }, ward: { value: "10.1", flag: "H" } },
      },
      {
        name: "Creatinine",
        unit: "µmol/L",
        range: "45–90",
        values: { gp: { value: "72" }, ed: { value: "92", flag: "H" }, ward: { value: "98", flag: "H" } },
      },
      {
        name: "eGFR",
        unit: "mL/min/1.73m²",
        range: ">90",
        values: { gp: { value: ">90" }, ed: { value: "58", flag: "L" }, ward: { value: "54", flag: "L" } },
      },
    ],
  },
  {
    id: "lft",
    label: "Liver Function Tests",
    rows: [
      {
        name: "Bilirubin",
        unit: "µmol/L",
        range: "<21",
        values: { gp: { value: "24", flag: "H" }, ed: { value: "72", flag: "H" }, ward: { value: "88", flag: "H" } },
      },
      {
        name: "Alkaline Phosphatase",
        unit: "U/L",
        range: "30–130",
        values: { gp: { value: "148", flag: "H" }, ed: { value: "360", flag: "H" }, ward: { value: "410", flag: "H" } },
      },
      {
        name: "ALT",
        unit: "U/L",
        range: "<40",
        values: { gp: { value: "52", flag: "H" }, ed: { value: "120", flag: "H" }, ward: { value: "145", flag: "H" } },
      },
      {
        name: "AST",
        unit: "U/L",
        range: "<40",
        values: { ed: { value: "98", flag: "H" }, ward: { value: "130", flag: "H" } },
      },
      {
        name: "GGT",
        unit: "U/L",
        range: "<40",
        values: { gp: { value: "88", flag: "H" }, ed: { value: "410", flag: "H" }, ward: { value: "480", flag: "H" } },
      },
      {
        name: "Albumin",
        unit: "g/L",
        range: "35–50",
        values: { gp: { value: "42" }, ed: { value: "34", flag: "L" }, ward: { value: "32", flag: "L" } },
      },
    ],
  },
  {
    id: "inflam",
    label: "Inflammatory Markers",
    rows: [
      {
        name: "C-Reactive Protein",
        unit: "mg/L",
        range: "<5",
        values: { gp: { value: "8", flag: "H" }, ed: { value: "210", flag: "H" }, ward: { value: "220", flag: "H" } },
      },
      {
        name: "Lactate (venous)",
        unit: "mmol/L",
        range: "0.5–2.0",
        values: { ed: { value: "2.8", flag: "H" }, ward: { value: "2.1", flag: "H" } },
      },
    ],
  },
  {
    id: "coag",
    label: "Coagulation",
    rows: [
      {
        name: "INR",
        unit: "ratio",
        range: "0.8–1.2",
        values: { ed: { value: "1.3", flag: "H" }, ward: { value: "1.4", flag: "H" } },
      },
      {
        name: "APTT",
        unit: "s",
        range: "24–35",
        values: { ed: { value: "34" }, ward: { value: "36", flag: "H" } },
      },
      {
        name: "Fibrinogen",
        unit: "g/L",
        range: "1.5–4.0",
        values: { ward: { value: "5.2", flag: "H" } },
      },
    ],
  },
  {
    id: "vbg",
    label: "Venous Blood Gas",
    rows: [
      {
        name: "pH",
        unit: "",
        range: "7.35–7.45",
        values: { ed: { value: "7.31", flag: "L" } },
      },
      {
        name: "Bicarbonate",
        unit: "mmol/L",
        range: "22–28",
        values: { ed: { value: "19", flag: "L" } },
      },
      {
        name: "Base Excess",
        unit: "mmol/L",
        range: "-2 to +2",
        values: { ed: { value: "-4.5", flag: "L" } },
      },
      {
        name: "Lactate",
        unit: "mmol/L",
        range: "0.5–2.0",
        values: { ed: { value: "2.8", flag: "H" } },
      },
    ],
  },
];

export const microbiology: NarrativeResult[] = [
  {
    test: "Blood Culture ×2 (aerobic + anaerobic)",
    collected: "16/06/2026 08:40 — ED",
    status: "Pending",
    body: "No growth to date. Set held for 5-day incubation. Interim result; will be updated if organisms isolated.",
  },
  {
    test: "Urine Culture (MSU)",
    collected: "16/06/2026 09:00 — ED",
    status: "Pending",
    body: "Microscopy: no significant pyuria. Culture in progress.",
  },
  {
    test: "Urine Culture (MSU)",
    collected: "09 Nov 2025 — Primary Care",
    status: "Final",
    body: "No bacterial growth after 48 hours.",
  },
];

export const imaging: NarrativeResult[] = [
  {
    test: "US Abdomen — Liver and Biliary Tree",
    collected: "16/06/2026 11:20 — Radiology",
    status: "Preliminary",
    body:
      "Common bile duct dilated to 11 mm with an echogenic focus in the distal duct, in keeping with an obstructing calculus. Multiple gallstones within a thin-walled gallbladder. No discrete hepatic abscess. Appearances consistent with biliary obstruction; correlate clinically for cholangitis.",
  },
  {
    test: "Chest X-ray (AP, supine)",
    collected: "16/06/2026 08:50 — Radiology",
    status: "Final",
    body: "Clear lung fields. No consolidation, effusion or pneumothorax. Heart size normal. No free subdiaphragmatic gas.",
  },
];

/** Left-hand navigator. Leaf ids under "lab" match labPanels[].id. */
export const resultTree: ResultNode[] = [
  { id: "all", label: "All Results", abnormal: 26 },
  {
    id: "lab",
    label: "Lab",
    abnormal: 26,
    children: [
      { id: "fbc", label: "Full Blood Count", abnormal: 6 },
      { id: "ue", label: "Urea & Electrolytes", abnormal: 5 },
      { id: "lft", label: "Liver Function Tests", abnormal: 13 },
      { id: "inflam", label: "Inflammatory Markers", abnormal: 4 },
      { id: "coag", label: "Coagulation", abnormal: 4 },
      { id: "vbg", label: "Venous Blood Gas", abnormal: 4 },
    ],
  },
  { id: "micro", label: "Microbiology" },
  { id: "imaging", label: "Imaging" },
];
