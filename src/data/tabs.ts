import type { ChartTab, MainTab } from "../types";

// Wrap-Up is deliberately NOT here: note feedback is a training overlay, not an
// EMR activity, so it lives in the floating dock (see App's WrapUpDock), not the
// main tab strip.
export const mainTabs: { key: MainTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "chart", label: "Chart Review" },
  { key: "results", label: "Labs & Tests" },
  { key: "notes", label: "Notes" },
  { key: "treatments", label: "Treatments" },
  { key: "messages", label: "Patient Message" },
  { key: "demographics", label: "Demographics" },
  { key: "flowsheets", label: "Flowsheets" },
];

// Labs live under the "Labs & Tests" main tab, so no duplicate chart sub-tab.
export const chartTabs: { key: ChartTab; label: string }[] = [
  { key: "encounters", label: "Encounters" },
  { key: "notes", label: "Notes" },
  { key: "letters", label: "Letters" },
  { key: "edVisits", label: "ED Visits" },
  { key: "radiology", label: "Rad" },
  { key: "meds", label: "Meds" },
  { key: "referrals", label: "Referrals" },
  { key: "media", label: "Media" },
  { key: "orders", label: "Other Orders" },
];
