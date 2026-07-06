import type { CaseSummary } from "../../../types";

/** Synthetic summary-dashboard content for the cholangitis case. */
export const caseCholangitis001Summary: CaseSummary = {
  workingDiagnosis: "acute cholangitis with sepsis physiology",

  /** Vitals trend over the last few hours (one reading per timepoint). */
  vitalsTrend: [
    { t: "04:00", sys: 118, dia: 74, hr: 96, resp: 18, spo2: 97, tempC: 37.5 },
    { t: "06:00", sys: 112, dia: 70, hr: 104, resp: 20, spo2: 96, tempC: 38.1 },
    { t: "08:00", sys: 104, dia: 66, hr: 110, resp: 22, spo2: 95, tempC: 38.5 },
    { t: "10:00", sys: 98, dia: 60, hr: 112, resp: 22, spo2: 94, tempC: 38.6 },
    { t: "12:00", sys: 101, dia: 62, hr: 108, resp: 21, spo2: 95, tempC: 38.3 },
    { t: "14:00", sys: 99, dia: 60, hr: 110, resp: 22, spo2: 94, tempC: 38.3 },
  ],

  activeProblems: [
    "?Acute cholangitis",
    "Sepsis — screen positive",
    "Obstructive jaundice",
    "Hypertension",
  ],

  ipMeds: [
    {
      medication: "Piperacillin/Tazobactam",
      conc: "4.5 g",
      method: "IV",
      freq: "TDS",
      lastDose: "Today 10:05",
    },
    {
      medication: "Sodium chloride 0.9%",
      conc: "1 L",
      method: "IV",
      freq: "Cont.",
      lastDose: "Today 09:40",
    },
    {
      medication: "Paracetamol",
      conc: "1 g",
      method: "IV/PO",
      freq: "QDS PRN",
      lastDose: "Today 08:00",
    },
  ],

  weights: [
    { when: "Today 06:00", value: "82.0 kg" },
    { when: "Yesterday 06:00", value: "82.5 kg" },
  ],

  firstWeight: { when: "12/01/2026", value: "84.0 kg" },

  microbiology: [
    { date: "Today", time: "09:10", state: "Blood cultures — no growth to date (pending)" },
  ],

  // Placeholder patient has pain only — no lines, drains, or wounds yet.
  linesDrains: [],

  diseaseReports: [
    "Home Meds",
    "History",
    "Problem List",
    "Sepsis Bundle",
    "Results Review",
    "Anticoagulation",
    "Microbiology Hx",
    "Imaging",
    "Care Plan",
  ],
};
