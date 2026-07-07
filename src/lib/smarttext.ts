import type { CaseBundle, CasePatient } from "../types";

/**
 * SmartText phrases: Epic-style note templates inserted from the editor's
 * "Insert SmartText" field. `build` returns editor-ready HTML (one <div> per
 * line) with demographics (and, for data-rich templates, vitals/labs) autofilled
 * from the case bundle and `***` wildcard chips for everything the trainee must
 * complete from chart review.
 */
export type SmartPhrase = {
  /** SmartText name shown bold in the picker, e.g. "HP". */
  id: string;
  label: string;
  description: string;
  build: (bundle: CaseBundle, admissionDate: string) => string;
};

/** Inline chip for an unfilled field; NoteEditor Tab-cycles and replaces these. */
const WILDCARD = '<span class="st-wildcard" contenteditable="false">***</span>';

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function line(html: string): string {
  return `<div>${html}</div>`;
}

const BLANK = "<div><br></div>";

function heading(text: string): string {
  return line(`<b>${text}</b>`);
}

/** A bold header followed by a single wildcard line. */
function section(title: string): string {
  return heading(title) + line(WILDCARD);
}

/** "Byrne, Eleanor, MD" — the reference image's PCP format (no uppercasing). */
function careTeamName(member: CasePatient["primaryCare"]): string {
  return `${member.surname}, ${member.forename}, ${member.credential}`;
}

export const SMART_PHRASES: SmartPhrase[] = [
  {
    id: "HP",
    label: "Admission H&P",
    description: "History & physical shell with demographics filled in",
    build: ({ patient }, admissionDate) =>
      [
        heading(escapeHtml("ADMISSION H&P")),
        line(
          `Admission Date: ${escapeHtml(admissionDate)} - PCP: ${escapeHtml(
            careTeamName(patient.primaryCare),
          )}`,
        ),
        BLANK,
        line(`CC: ${WILDCARD}`),
        BLANK,
        heading("HISTORY OF PRESENT ILLNESS:"),
        line(
          `${escapeHtml(patient.displayName)} is a ${patient.age}yr old ` +
            `${escapeHtml(patient.sex.toLowerCase())} with ${WILDCARD}`,
        ),
        BLANK,
        section("PAST MEDICAL HISTORY:"),
        BLANK,
        section("PAST SURGICAL HISTORY:"),
        BLANK,
        heading("ALLERGIES:"),
        line(escapeHtml(patient.allergies)),
        BLANK,
        section("MEDICATIONS:"),
        BLANK,
        section("PHYSICAL EXAM:"),
        BLANK,
        section("LABS:"),
        BLANK,
        section("ASSESSMENT:"),
        BLANK,
        section("PLAN:"),
      ].join(""),
  },
  {
    id: "PROGRESS",
    label: "Progress Note",
    description: "Daily progress note with vitals and labs pulled from the chart",
    build: (bundle) => {
      const { patient, summary, bloods } = bundle;
      const latest = summary.vitalsTrend.at(-1);
      const vitalsLine = latest
        ? line(
            escapeHtml(
              `T ${latest.tempC} · HR ${latest.hr} · BP ${latest.sys}/${latest.dia} · RR ${latest.resp} · SpO2 ${latest.spo2}%`,
            ),
          )
        : line(WILDCARD);
      const labLines = bloods.map((row) =>
        line(
          escapeHtml(
            `${row.test} ${row.value} (${row.range})${row.flag ? ` ${row.flag}` : ""}`,
          ),
        ),
      );
      const exam = ["Gen", "CV", "Lungs", "Abd", "Extremities", "Neuro"].map(
        (system) => line(`${system} - ${WILDCARD}`),
      );
      return [
        line(
          `<b>${escapeHtml(patient.displayName)} | RM ${escapeHtml(patient.location)} | ${escapeHtml(patient.specialty.toUpperCase())} PROGRESS NOTE - HOSPITAL DAY: </b>${WILDCARD}`,
        ),
        BLANK,
        section("INTERVAL HISTORY:"),
        BLANK,
        section("SUBJECTIVE:"),
        BLANK,
        heading("OBJECTIVE:"),
        vitalsLine,
        ...exam,
        heading("LABS:"),
        ...labLines,
        heading("IMAGING:"),
        line(WILDCARD),
        heading("MICRO:"),
        line(WILDCARD),
        BLANK,
        section("ASSESSMENT & PLAN:"),
        BLANK,
        line(`IVF: ${WILDCARD}`),
        line(`Diet: ${WILDCARD}`),
        line(`DVT prophylaxis: ${WILDCARD}`),
      ].join("");
    },
  },
  {
    id: "PTWR",
    label: "Post-Take Ward Round",
    description: "Senior post-take review shell",
    build: ({ patient, specialty }, admissionDate) =>
      [
        heading(`POST-TAKE WARD ROUND — ${escapeHtml(specialty)}`),
        line(`Seen with: ${WILDCARD}`),
        BLANK,
        line(
          `${escapeHtml(patient.displayName)} is a ${patient.age}yr old ` +
            `${escapeHtml(patient.sex.toLowerCase())} admitted ${escapeHtml(admissionDate)} with ${WILDCARD}`,
        ),
        BLANK,
        section("EXAMINATION:"),
        BLANK,
        section("IMPRESSION:"),
        BLANK,
        heading("PLAN:"),
        line(`1. ${WILDCARD}`),
        line(`2. ${WILDCARD}`),
        line(`3. ${WILDCARD}`),
      ].join(""),
  },
];

/**
 * Case-insensitive substring match on phrase id and label. A leading dot is
 * ignored so Epic-trained fingers typing ".hp" still resolve. Empty query
 * matches nothing (the dropdown only opens once the trainee types).
 */
export function matchPhrases(query: string): SmartPhrase[] {
  const q = query.trim().replace(/^\.+/, "").toLowerCase();
  if (!q) return [];
  return SMART_PHRASES.filter(
    (phrase) =>
      phrase.id.toLowerCase().includes(q) || phrase.label.toLowerCase().includes(q),
  );
}

/**
 * Editor HTML from stored plain text: escaped lines in <div>s, blank lines as
 * <div><br></div>, and literal *** reconstituted into wildcard chips so the
 * Sign gate survives a pend -> edit round trip.
 */
export function plainTextToEditorHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return BLANK;
      return `<div>${escapeHtml(line).replace(/\*\*\*/g, WILDCARD)}</div>`;
    })
    .join("");
}
