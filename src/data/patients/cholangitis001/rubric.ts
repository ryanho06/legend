import type { CaseRubric } from "../../../types";

/**
 * Scoring rubric for a day-1 ward-round / progress note on the cholangitis
 * case. Items reference facts that exist in the chart (documents.ts /
 * encounters.ts); triggers list the phrasings a student might reasonably use.
 * Weights: safety catches heaviest, then diagnosis and disposition, then
 * supporting findings.
 *
 * All content is fabricated for education and simulation only. Not for clinical use.
 */
export const caseCholangitis001Rubric: CaseRubric = {
  caseId: "cholangitis001",
  noteType: "Progress Note",
  wordBand: { target: 140, max: 240 },
  sections: [
    ["impression", "assessment", "diagnosis"],
    ["plan"],
  ],
  items: [
    {
      id: "safety-penicillin-allergy",
      label: "Catches the penicillin allergy against the antibiotics given",
      category: "safety",
      weight: 15,
      critical: true,
      triggers: [
        [["penicillin"], ["allergy", "allergic", "rash", "switch", "switched", "avoid"]],
        [["ciprofloxacin", "metronidazole"]],
      ],
      explanation:
        "ED started piperacillin/tazobactam on the time-critical sepsis pathway, but the chart documents a penicillin allergy (rash). Medicines reconciliation and microbiology switched her to ciprofloxacin + metronidazole. A ward note that does not carry this forward re-exposes her to the error.",
      pdqi: ["accurate", "useful"],
    },
    {
      id: "safety-hold-metformin",
      label: "Holds metformin during the acute illness",
      category: "safety",
      weight: 10,
      critical: true,
      triggers: [
        [
          ["metformin"],
          [
            "hold",
            "held",
            "holding",
            "stop",
            "stopped",
            "withhold",
            "withheld",
            "suspend",
            "suspended",
          ],
        ],
      ],
      explanation:
        "Metformin was continued on the admission list, then held after the lactate / AKI review: sepsis, possible AKI and NBM status all raise the lactic acidosis risk. The note must document the hold (and the restart criteria).",
      pdqi: ["accurate", "up-to-date"],
    },
    {
      id: "finding-atypical-pain",
      label: "Names the atypical (central epigastric) pain site",
      category: "findings",
      weight: 8,
      triggers: [
        [["epigastric", "midline"], ["atypical", "central", "midline", "not typical"]],
      ],
      explanation:
        "The pain is central epigastric rather than classic RUQ, which anchored the community workup on dyspepsia. Stating the atypia is what stops the next reader from re-anchoring.",
      pdqi: ["thorough", "synthesized"],
    },
    {
      id: "finding-sepsis",
      label: "Recognizes sepsis physiology",
      category: "findings",
      weight: 8,
      triggers: [[["sepsis", "septic", "biliary sepsis"]]],
      explanation:
        "Fever 38.6, HR 112, borderline BP and NEWS2 7 with a positive sepsis screen: this is sepsis until proven otherwise, and it drives the urgency of drainage.",
      pdqi: ["thorough", "accurate"],
    },
    {
      id: "finding-obstructive-lfts",
      label: "Identifies the obstructive LFT pattern",
      category: "findings",
      weight: 8,
      triggers: [
        [["obstructive", "cholestatic"], ["lfts", "lft", "liver", "picture", "pattern"]],
        [["bilirubin", "bili"], ["alp", "ggt"]],
      ],
      explanation:
        "Bilirubin 96 with ALP 402 and GGT 388 against ALT 128 is cholestatic, pointing at duct obstruction rather than a hepatitic process.",
      pdqi: ["thorough", "accurate"],
    },
    {
      id: "finding-imaging-cbd",
      label: "Reports the dilated CBD with an obstructing stone",
      category: "findings",
      weight: 8,
      triggers: [
        [["dilated", "dilatation", "dilation"], ["cbd", "common bile duct", "duct", "biliary"]],
        [["choledocholithiasis"]],
        [["obstructing", "obstructed", "distal"], ["stone", "calculus"]],
      ],
      explanation:
        "Ultrasound shows a CBD of 10 mm (4 mm in 01/2026) with an obstructing distal stone: the anatomical cause, and the target of the ERCP.",
      pdqi: ["thorough", "accurate"],
    },
    {
      id: "finding-not-pancreatitis",
      label: "Reads the lipase in context (not pancreatitis)",
      category: "findings",
      weight: 6,
      triggers: [
        [["lipase"], ["mildly", "mild", "only", "slightly", "92", "normal"]],
        [["pancreatitis"], ["against", "not", "unlikely", "excluded", "ruled"]],
      ],
      explanation:
        "Lipase 92 is only mildly raised, well short of the 3x threshold for acute pancreatitis. Reading it in context avoids mislabelling the epigastric pain.",
      pdqi: ["accurate", "synthesized"],
    },
    {
      id: "finding-cultures",
      label: "Tracks the cultures (sent before antibiotics, pending)",
      category: "findings",
      weight: 6,
      triggers: [
        [
          ["cultures", "culture"],
          ["pending", "sent", "awaiting", "awaited", "chase", "no growth", "48"],
        ],
      ],
      explanation:
        "Blood cultures x2 and urine were sent before antibiotics; no growth at 48 h so far. The note should carry the pending result forward so someone chases and de-escalates.",
      pdqi: ["up-to-date", "useful"],
    },
    {
      id: "assessment-cholangitis",
      label: "States the diagnosis: acute cholangitis",
      category: "assessment",
      weight: 10,
      triggers: [[["cholangitis"]]],
      explanation:
        "Systemic inflammation + cholestasis + imaging evidence of obstruction meets the TG18 definition of definite acute cholangitis despite the incomplete Charcot triad.",
      pdqi: ["accurate", "synthesized"],
    },
    {
      id: "assessment-severity",
      label: "Grades the severity (TG18 Grade II)",
      category: "assessment",
      weight: 6,
      triggers: [[["tg18", "tokyo", "grade ii", "moderate severity"]]],
      explanation:
        "TG18 Grade II (moderate) is what makes biliary drainage urgent rather than elective. Severity grading is the bridge from diagnosis to timing.",
      pdqi: ["accurate", "synthesized"],
    },
    {
      id: "finding-weight-loss",
      label: "Links the rapid weight loss to new stone formation",
      category: "findings",
      weight: 5,
      triggers: [[["weight"], ["loss", "lost"]]],
      explanation:
        "She lost ~10 kg (12% body weight) after starting metformin and a low-calorie diet: rapid weight loss supersaturates bile and is a recognised driver of new cholesterol stones. The aetiology lives in the GP letters, not the admission bloods.",
      pdqi: ["thorough", "synthesized"],
    },
    {
      id: "plan-ercp",
      label: "Plans urgent biliary decompression (ERCP)",
      category: "plan",
      weight: 10,
      triggers: [[["ercp", "biliary decompression", "sphincterotomy", "drainage"]]],
      explanation:
        "Source control for cholangitis is drainage, not antibiotics alone. Gastroenterology accepted her for urgent ERCP today.",
      pdqi: ["useful", "up-to-date"],
    },
    {
      id: "plan-fluids-monitoring",
      label: "Continues resuscitation and repeat monitoring",
      category: "plan",
      weight: 5,
      triggers: [
        [["fluids", "fluid", "crystalloid"]],
        [["lactate"], ["repeat", "recheck", "monitor", "trend", "6"]],
      ],
      explanation:
        "IV fluids continue with hourly urine output, and lactate / LFTs are repeated at 6 hours to prove the trajectory is right.",
      pdqi: ["useful", "up-to-date"],
    },
    {
      id: "plan-vte",
      label: "Addresses VTE prophylaxis before the procedure",
      category: "plan",
      weight: 5,
      triggers: [
        [["vte", "thromboprophylaxis", "prophylaxis", "dalteparin", "enoxaparin"]],
      ],
      explanation:
        "VTE assessment is outstanding, and the timing matters: INR 1.3 and platelets 132 pre-ERCP make the prophylaxis decision a deliberate one, not a checkbox.",
      pdqi: ["thorough", "useful"],
    },
  ],
  modelNote: `POST-TAKE REVIEW — General Surgery (day 1)

64F admitted overnight: central epigastric pain, rigors, new jaundice. Pain site is atypical for a biliary source and was treated in the community as dyspepsia. Background: gallstones (01/2026), new T2DM with ~10 kg rapid weight loss on metformin — a recognised driver of new stones.

Obs improving after crystalloid: T 38.0, HR 102, BP 108/66.

Bloods: WCC 17.4, CRP 214, obstructive LFTs (bilirubin 96, ALP 402, GGT 388). Lipase only mildly raised at 92, against pancreatitis. Lactate 2.6.
US: dilated CBD 10 mm with an obstructing distal stone.

Impression
Acute cholangitis secondary to choledocholithiasis, TG18 Grade II, with sepsis physiology responding to resuscitation.

Plan
1. Urgent ERCP today for biliary decompression (gastro accepted).
2. Antibiotics: penicillin allergy (rash) caught at med rec — pip/taz switched to ciprofloxacin + metronidazole per microbiology. Cultures sent pre-antibiotics, no growth to date; review at 48 h.
3. HOLD metformin (sepsis, lactate risk); withhold statin while NBM.
4. IV fluids, hourly urine output; repeat lactate and LFTs at 6 h.
5. VTE assessment pre-procedure (INR 1.3, platelets 132).`,
};
