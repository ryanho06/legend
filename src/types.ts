export type MainTab =
  | "summary"
  | "chart"
  | "results"
  | "notes"
  | "treatments"
  | "wrapup"
  | "messages"
  | "demographics"
  | "flowsheets";

export type ChartTab =
  | "encounters"
  | "notes"
  | "letters"
  | "edVisits"
  | "labs"
  | "radiology"
  | "meds"
  | "referrals"
  | "media"
  | "orders";

/** Coarse encounter class, drives the Chart Review filter bar. */
export type EncounterClass = "inpatient" | "outpatient" | "ed";

/**
 * A visit/event on the Chart Review timeline. Documents attach to an encounter
 * via `encounterId`; a row resolves its primary document (see resolvePrimary in
 * EncounterTable) rather than carrying a hand-maintained link.
 *
 * Curated array order is the timeline's source of truth: the recency-bucket
 * `group` labels ("2 Months Ago" for a 20/03 entry) are hand-tuned and not
 * reproducible by date math, so rows are kept in display order. Per-document
 * `timestamp` remains the Notes sort key.
 */
export type Encounter = {
  id: string;
  type: string;
  /** Full date DD/MM/YYYY; never a relative label like "Today". */
  date: string;
  /** Time HH:MM, when known. */
  time?: string;
  class: EncounterClass;
  specialty: string;
  /** Department abbreviation shown in the timeline, e.g. "GSAMU". */
  deptAbbrev: string;
  /** "Surname, Forename, Credential"; empty for system/lab rows with no named provider. */
  provider: string;
  description: string;
  status: string;
  location: string;
  /** Recency-bucket header to render above this row, e.g. "2 Weeks Ago". */
  group?: string;
  principalProblem?: string;
  /** True only for the admission event itself (red Type, Admissions filter). */
  admission?: boolean;
};

export type NoteCategory =
  | "H&P"
  | "Progress"
  | "Nursing"
  | "Procedures"
  | "Consults"
  | "ED Notes"
  | "Discharge";

export type NoteStatus = "signed" | "incomplete" | "cosign";

/**
 * A note-kind clinical document: the rich, authored documents shown in the Notes
 * activity (and the Chart Review > Notes sub-tab). Same record drives the
 * right-rail viewer when its encounter row is opened.
 */
export type ClinicalNote = {
  kind: "note";
  id: string;
  /** The encounter this note belongs to (see `Encounter.id`). */
  encounterId: string;
  category: NoteCategory;
  /** Display label shown in the list, e.g. "Progress Notes", "Consult Note". */
  noteType: string;
  /** Stored "Surname, Forename"; rendered with surname uppercased via formatClinician. */
  author: string;
  /** Post-nominal, e.g. "MD", "RN", "PharmD". */
  credential: string;
  /** Credential line under the author, e.g. "*PHYSICIAN: FACULTY", ".NURSE". */
  authorRole: string;
  service: string;
  /** Human label shown in the UI, e.g. "Today 08:20". */
  dateOfService: string;
  fileTime: string;
  /** Unix epoch seconds; sort key for the list (display uses dateOfService). */
  timestamp: number;
  status: NoteStatus;
  /** True for notes that belong to the admission episode (cross-cuts category). */
  admission?: boolean;
  body: string;
  addendum?: string;
};

/**
 * A report-kind clinical document: letters, imaging reports, orders and the
 * admission encounter summary. Rendered by ReportPreview. No `timestamp` — these
 * are not part of the timestamp-sorted Notes list; they carry a human `signedAt`
 * and are reached via their encounter row.
 */
export type ClinicalReport = {
  kind: "letter" | "report" | "order" | "encounterSummary";
  id: string;
  /** The encounter this document belongs to (see `Encounter.id`). */
  encounterId: string;
  title: string;
  type: string;
  department?: string;
  author?: string;
  signedAt?: string;
  body: string;
};

/** HL7-style abnormal result flag. "" = within range. */
export type LabFlag = "H" | "HH" | "L" | "LL" | "A" | "";

export type LabRow = {
  test: string;
  value: string;
  units?: string;
  range: string;
  flag: LabFlag;
};

/**
 * A structured laboratory result report (biochemistry / haematology), rendered as
 * an Epic/Beaker-style receipt by LabReport.
 */
export type ClinicalLab = {
  kind: "lab";
  id: string;
  encounterId: string;
  /** Panel name, e.g. "Liver Function + Inflammatory Markers". */
  title: string;
  status: "Final" | "Preliminary" | "In process" | "Corrected";
  specimen: string;
  collected: string;
  received?: string;
  /** Report date/time (when issued). */
  reportedAt: string;
  /** Authorising / requesting clinician. */
  orderedBy?: string;
  resultingLab?: string;
  rows: LabRow[];
};

export type MicroSensitivity = {
  drug: string;
  /** Minimum inhibitory concentration, mg/L (EUCAST). */
  mic?: string;
  interpretation: "S" | "I" | "R";
};

export type MicroOrganism = {
  name: string;
  gramStain?: string;
  sensitivities?: MicroSensitivity[];
};

/**
 * A microbiology culture & sensitivity report, rendered by MicroReport. For a
 * pending/negative culture `organisms` is empty and `resultText` carries the
 * "NO GROWTH TO DATE" preliminary narrative.
 */
export type ClinicalMicro = {
  kind: "micro";
  id: string;
  encounterId: string;
  title: string;
  status: "Preliminary" | "Final";
  specimen: string;
  collected: string;
  received?: string;
  reportedAt: string;
  resultText?: string;
  organisms?: MicroOrganism[];
};

/** Single source of truth for clinical documents; both views derive from it. */
export type ClinicalDocument =
  | ClinicalNote
  | ClinicalReport
  | ClinicalLab
  | ClinicalMicro;

/** Back-compat aliases so list/preview components keep their narrow prop types. */
export type Note = ClinicalNote;
export type Report = ClinicalReport;

/** An open note in the right-rail NoteWriter; multiple can be edited at once. */
export type NoteDraft = {
  id: string;
  noteType: string;
  service: string;
  body: string;
};
