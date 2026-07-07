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
  /** Doctor ID of the author; ownership compares this to the login/persona. */
  authorId?: string;
  /** True for notes that belong to the admission episode (cross-cuts category). */
  admission?: boolean;
  /** Time-critical content (e.g. ED triage); shown with a red marker in lists. */
  urgent?: boolean;
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

/** The trainee using the simulator; captured by the sign-in page. */
export type UserProfile = {
  forename: string;
  surname: string;
  /** Synthetic doctor ID, e.g. "d912345". d9##### = runtime-generated logins;
   * authored case staff use d0#####-d8##### so they can never collide. */
  hcpId: string;
};

/** An open note in the right-rail NoteWriter; multiple can be edited at once. */
export type NoteDraft = {
  id: string;
  noteType: string;
  service: string;
  body: string;
  /** "edit" reopens an incomplete user note; "addendum" appends to a signed one. */
  mode?: "edit" | "addendum";
  /** The stored note an edit/addendum draft targets. */
  targetNoteId?: string;
};

/**
 * The parts of a patient workspace that survive switching away and back:
 * held per case in App, passed into PatientWorkspace as controlled state.
 */
export type CaseUiState = {
  mainTab: MainTab;
  chartTab: ChartTab;
  selectedDocId: string | null;
  editors: NoteDraft[];
  activeEditorId: string | null;
  wrapupOpen: boolean;
};

/** PDQI-9 note-quality dimensions (Stetson et al., 2012). */
export type PdqiDimension =
  | "up-to-date"
  | "accurate"
  | "thorough"
  | "useful"
  | "organized"
  | "comprehensible"
  | "succinct"
  | "synthesized"
  | "internally consistent";

/**
 * One way to satisfy a rubric item: AND over groups, OR over the synonym
 * phrases within a group. E.g. [["bilirubin"], ["raised", "elevated", "high"]]
 * needs "bilirubin" plus any of the qualifiers somewhere in the note.
 */
export type RubricTrigger = string[][];

export type RubricItem = {
  id: string;
  /** Shown in feedback, e.g. "Recognizes the obstructive LFT pattern". */
  label: string;
  category: "findings" | "assessment" | "plan" | "safety";
  /** Points awarded when matched. */
  weight: number;
  /** A missed critical item is an unsafe omission, not just lost points. */
  critical?: boolean;
  /** Item matches if ANY trigger matches. */
  triggers: RubricTrigger[];
  /** Teaching text shown after scoring (why it matters, where it was in the chart). */
  explanation: string;
  /** PDQI-9 dimensions this item evidences. */
  pdqi: PdqiDimension[];
};

export type CaseRubric = {
  caseId: string;
  /** Which draft type this rubric applies to, e.g. "Progress Notes". */
  noteType: string;
  items: RubricItem[];
  /** Conciseness band: no penalty up to max, then 1 point per 25 words, capped at 10. */
  wordBand: { target: number; max: number };
  /** Section headers scored as "organized": OR within a group, one group per expected section. */
  sections: string[][];
  /** Consultant-standard note, revealed only after scoring. Plain text. */
  modelNote: string;
};

/** A named clinician on the sidebar care team (attending, GP). */
export type CareTeamMember = {
  forename: string;
  surname: string;
  credential: string;
  specialty: string;
};

/** Per-case patient demographics and banner content (the case's patient.json). */
export type CasePatient = {
  surname: string;
  forename: string;
  displayName: string;
  initials: string;
  pronouns: string;
  sex: string;
  age: number;
  /** DD/MM/YYYY. */
  dob: string;
  /** Synthetic case MRN, e.g. "LEG-000001". */
  mrn: string;
  location: string;
  specialty: string;
  attending: CareTeamMember;
  primaryCare: CareTeamMember;
  allergies: string;
  isolation: string;
  code: string;
  acuity: string;
  presentingComplaint: string;
  phone: string;
  infection: string;
  bmi: string;
  /** Seed content for the trainee's sticky-note scratchpad. */
  stickyNote: string;
};

/** One timepoint on the Summary vitals trend. */
export type VitalsPoint = {
  t: string;
  sys: number;
  dia: number;
  hr: number;
  resp: number;
  spo2: number;
  tempC: number;
};

export type IpMed = {
  medication: string;
  conc: string;
  method: string;
  freq: string;
  lastDose: string;
};

export type WeightEntry = { when: string; value: string };

export type MicroSummaryEntry = { date: string; time: string; state: string };

export type LineDrain = {
  label: string;
  kind: "line" | "drain" | "wound";
  days: number;
  /** Position over the body silhouette, as a percentage of its box. */
  x?: number;
  y?: number;
};

/** One row of the recent-bloods table (Summary + the admission lab receipt). */
export type BloodRow = {
  test: string;
  value: string;
  range: string;
  flag: string;
};

/** Everything the Summary dashboard renders for a case. */
export type CaseSummary = {
  /** Completes "Working diagnosis: ..." on the Patient Summary card. */
  workingDiagnosis: string;
  vitalsTrend: VitalsPoint[];
  activeProblems: string[];
  ipMeds: IpMed[];
  weights: WeightEntry[];
  firstWeight: WeightEntry;
  microbiology: MicroSummaryEntry[];
  linesDrains: LineDrain[];
  diseaseReports: string[];
};

/**
 * One complete training case: everything the app needs to open a patient.
 * Registered in src/data/patients/index.ts; adding a case is a folder plus one
 * registry entry (see CASE_AUTHORING.md).
 */
export type CaseBundle = {
  /** Folder name under src/data/patients/, e.g. "cholangitis001". */
  id: string;
  /** Patient-list grouping, e.g. "General Surgery". */
  specialty: string;
  /** One-line handoff summary shown in the patient list row. */
  handoff: string;
  /** Doctor ID of the simulated persona the trainee plays in this case, if any. */
  playerHcpId?: string;
  patient: CasePatient;
  documents: ClinicalDocument[];
  /** kind:"note" subset of documents (static pre-authored notes). */
  notes: ClinicalNote[];
  encounters: Encounter[];
  rubric: CaseRubric;
  summary: CaseSummary;
  bloods: BloodRow[];
};

export type RubricItemResult = {
  item: RubricItem;
  matched: boolean;
};

export type RubricResult = {
  items: RubricItemResult[];
  /** Sum of matched item weights / sum of all weights. */
  earned: number;
  possible: number;
  /** Critical items that were missed (unsafe omissions). */
  criticalMisses: RubricItem[];
  words: number;
  wordPenalty: number;
  /** First synonym of each section group that was found, in rubric order. */
  sectionsFound: string[];
  sectionsExpected: number;
  /** Per-dimension matched/total item counts. */
  pdqi: Partial<Record<PdqiDimension, { matched: number; total: number }>>;
  /** earned - wordPenalty, floored at 0. */
  total: number;
};
