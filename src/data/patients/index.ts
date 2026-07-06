import type { CaseBundle } from "../../types";
import cholangitis001Patient from "./cholangitis001/patient.json";
import { bloods as cholangitis001Bloods } from "./cholangitis001/bloods";
import {
  caseCholangitis001Documents,
  caseCholangitis001Notes,
} from "./cholangitis001/documents";
import { caseCholangitis001Encounters } from "./cholangitis001/encounters";
import { caseCholangitis001Rubric } from "./cholangitis001/rubric";
import { caseCholangitis001Summary } from "./cholangitis001/summary";

/**
 * Every registered training case, in patient-list display order. Adding a case
 * is a folder under src/data/patients/ plus one entry here (CASE_AUTHORING.md
 * has the authoring contract).
 */
export const caseRegistry: CaseBundle[] = [
  {
    id: "cholangitis001",
    specialty: "General Surgery",
    handoff:
      "64F, epigastric pain + rigors + new jaundice. ?Acute cholangitis (TG18 II), for urgent ERCP.",
    patient: cholangitis001Patient,
    documents: caseCholangitis001Documents,
    notes: caseCholangitis001Notes,
    encounters: caseCholangitis001Encounters,
    rubric: caseCholangitis001Rubric,
    summary: caseCholangitis001Summary,
    bloods: cholangitis001Bloods,
  },
];

export function getCase(id: string): CaseBundle {
  const found = caseRegistry.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown case id: ${id}`);
  return found;
}

/** Specialties present in the registry, in first-appearance order. */
export function listSpecialties(): string[] {
  return [...new Set(caseRegistry.map((c) => c.specialty))];
}
