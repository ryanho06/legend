import type { CasePatient } from "../types";

/**
 * SmartText phrases: Epic-style note templates inserted from the editor's
 * "Insert SmartText" field. `build` returns editor-ready HTML (one <div> per
 * line) with demographics autofilled from the case and `***` wildcard chips
 * for everything the trainee must complete from chart review.
 */
export type SmartPhrase = {
  /** SmartText name shown bold in the picker, e.g. "HP". */
  id: string;
  label: string;
  description: string;
  build: (patient: CasePatient, admissionDate: string) => string;
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
    build: (patient, admissionDate) =>
      [
        heading("ADMISSION H&amp;P"),
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
    label: "Progress Note (SOAP)",
    description: "Ward-round SOAP skeleton",
    build: (patient, admissionDate) =>
      [
        heading("PROGRESS NOTE"),
        line(
          `${escapeHtml(patient.displayName)} - admitted ${escapeHtml(admissionDate)}`,
        ),
        BLANK,
        section("Subjective:"),
        BLANK,
        section("Objective:"),
        BLANK,
        section("Assessment:"),
        BLANK,
        section("Plan:"),
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
