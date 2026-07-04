import type { ChartTab, MainTab } from "../types";

export const mainTabs: { key: MainTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "chart", label: "Chart Review" },
  { key: "results", label: "Results" },
  { key: "notes", label: "Notes" },
  { key: "treatments", label: "Treatments" },
  { key: "wrapup", label: "Wrap-Up" },
  { key: "messages", label: "Patient Message" },
  { key: "demographics", label: "Demographics" },
  { key: "flowsheets", label: "Flowsheets" },
];

export const chartTabs: { key: ChartTab; label: string }[] = [
  { key: "encounters", label: "Encounters" },
  { key: "notes", label: "Notes" },
  { key: "letters", label: "Letters" },
  { key: "edVisits", label: "ED Visits" },
  { key: "labs", label: "Labs" },
  { key: "radiology", label: "Rad" },
  { key: "meds", label: "Meds" },
  { key: "referrals", label: "Referrals" },
  { key: "media", label: "Media" },
  { key: "orders", label: "Other Orders" },
];
