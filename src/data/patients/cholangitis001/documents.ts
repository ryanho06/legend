import type { ClinicalDocument, LabFlag, LabRow } from "../../../types";
import { bloods } from "./bloods";

/** SI units for the admission panel, keyed by `bloods` test name. */
const ADMISSION_LAB_UNITS: Record<string, string> = {
  WCC: "x10⁹/L",
  Neutrophils: "x10⁹/L",
  CRP: "mg/L",
  Bilirubin: "µmol/L",
  ALP: "U/L",
  GGT: "U/L",
  ALT: "U/L",
  Lipase: "U/L",
  Lactate: "mmol/L",
  Creatinine: "µmol/L",
  Sodium: "mmol/L",
  Albumin: "g/L",
  Platelets: "x10⁹/L",
  INR: "",
};

function toLabFlag(descriptive: string): LabFlag {
  if (/low/i.test(descriptive)) return "L";
  if (/high/i.test(descriptive)) return "H";
  return "";
}

/** Admission bloods receipt rows derived from the shared `bloods` summary panel. */
const admissionLabRows: LabRow[] = bloods.map((result) => ({
  test: result.test,
  value: result.value,
  units: ADMISSION_LAB_UNITS[result.test] ?? "",
  range: result.range,
  flag: toLabFlag(result.flag),
}));

/**
 * Single source of truth for the synthetic cholangitis case (Hart, Amelia, 64F):
 * every clinical document, note-kind and report-kind, in one list. Both views
 * derive from it — the Notes activity (and Chart Review > Notes sub-tab) filter
 * to `kind: "note"`, while the Encounters timeline resolves each row's primary
 * document by `encounterId`.
 *
 * Note-kind documents drive the Notes/Trans browser: category tabs filter by
 * `category`, "Admission" by the `admission` flag and "Incomplete" by `status`.
 * The list sorts by `timestamp`. Report-kind documents (letters, imaging, orders,
 * the admission summary) are reached only via their encounter row.
 *
 * CASE SHAPE — an ATYPICAL acute cholangitis for the learner to unpick:
 *  - Pain is CENTRAL EPIGASTRIC (not classic RUQ); Murphy's negative.
 *  - Charcot's triad incomplete on arrival — a reminder of its poor sensitivity;
 *    diagnosis rests on the Tokyo Guidelines (TG18) domains.
 *  - Aetiology twist: rapid intentional weight loss after starting metformin for
 *    new T2DM -> cholesterol-supersaturated bile + gallbladder stasis -> stones.
 *  - Latent / system-factor hooks (NOT individual blame): time-critical sepsis
 *    prescribing where the penicillin allergy is caught downstream at medicines
 *    reconciliation; metformin continued on the admission list then held after a
 *    lactate / AKI review; a reasonable community "dyspepsia" trial that predates
 *    any red flags; the value of reading lipase in context.
 *
 * All content is fabricated for education and simulation only. Not for clinical use.
 */
export const caseCholangitis001Documents: ClinicalDocument[] = [
  {
    kind: "note",
    id: "note-hp-001",
    encounterId: "enc-admission",
    category: "H&P",
    noteType: "H&P",
    author: "Green, Annabel",
    credential: "MD",
    authorRole: "*PHYSICIAN: FACULTY",
    service: "(A) General Surgery — AMU",
    dateOfService: "Today 08:20",
    fileTime: "Today 08:54",
    timestamp: 1781511600,
    status: "signed",
    admission: true,
    body: `GENERAL SURGERY ADMISSION H&P
Admission Date: Today — PCP: Shah, Rajesh, MD

CC: Central epigastric pain, rigors and new jaundice.

HISTORY OF PRESENT ILLNESS:
Amelia Hart is a 64-year-old woman presenting with ~5 days of constant CENTRAL
EPIGASTRIC pain radiating to the back, worse after meals. She was seen by her GP
2 weeks ago and started on omeprazole for presumed dyspepsia, with little relief.
Overnight she developed rigors (shaking chills), passed dark urine, and her family
noticed scleral icterus. She denies prior biliary surgery.

Of note, the pain is MIDLINE rather than right upper quadrant, which initially
pointed away from a biliary cause. She has known gallstones (US 01/2026, then
asymptomatic). Since being diagnosed with Type 2 diabetes in 01/2026 she has lost
~10 kg (84 -> 74 kg, ~12% body weight) on metformin and a low-calorie diet —
rapid weight loss being a recognised driver of new cholesterol gallstones.

In the Emergency Department she was febrile (38.6), tachycardic (HR 112) and
borderline hypotensive (BP 102/64), with a positive sepsis screen.

PAST MEDICAL HISTORY:
- Gallstones (US 01/2026)                         16/01/2026
- Type 2 diabetes mellitus (metformin)            13/01/2026
- Hyperlipidaemia                                 2019
- Essential hypertension                          2019

PAST SURGICAL HISTORY:
- Nil of note.

ALLERGIES:
- Penicillin — rash.

MEDICATIONS (on admission):
- Metformin 500 mg PO BD
- Atorvastatin 40 mg PO ON
- Amlodipine 5 mg PO OD
- Omeprazole 20 mg PO OD (started 05/06/2026 for "dyspepsia")

EXAMINATION:
- Alert, mildly jaundiced, warm peripheries.
- Abdomen: soft; tenderness is EPIGASTRIC > RUQ. Murphy's sign NEGATIVE. No
  peritonism, no palpable mass.
- Chest clear, heart sounds normal.

INVESTIGATIONS:
- WCC 17.4, CRP 214, bilirubin 96, ALP 402, GGT 388, ALT 128, lactate 2.6.
- Lipase only mildly raised (92) — against primary acute pancreatitis.
- ECG sinus tachycardia, troponin not raised (epigastric pain — ACS excluded).
- US abdomen: dilated CBD 10 mm with obstructing distal stone; gallbladder calculi.

IMPRESSION:
Acute cholangitis secondary to choledocholithiasis, with sepsis physiology.
Diagnosis by Tokyo Guidelines (TG18): systemic inflammation (fever, raised
WCC/CRP) + cholestasis (jaundice, obstructive LFTs) + imaging (CBD dilatation +
stone) = DEFINITE acute cholangitis. Severity TG18 Grade II (moderate). The
incomplete Charcot triad on arrival illustrates its limited sensitivity.

PLAN:
1. Sepsis six. Blood + urine cultures sent BEFORE antibiotics; IV crystalloid
   resuscitation; hourly urine output.
2. Antibiotics: broad-spectrum piperacillin/tazobactam started promptly in ED
   on the sepsis pathway. Penicillin allergy identified at ward medicines
   reconciliation — switch to ciprofloxacin + metronidazole (see microbiology).
3. Urgent ERCP today for biliary decompression — gastroenterology referral.
4. NBM pending ERCP. Metformin was continued on the admission medicines list,
   now HELD after lactate / AKI review (lactic acidosis risk in acute illness).
   Withhold statin while NBM.
5. VTE assessment, capillary glucose monitoring, repeat lactate and LFTs at 6h.`,
  },
  {
    kind: "note",
    id: "note-ed-002",
    encounterId: "enc-ed",
    category: "ED Notes",
    noteType: "ED Provider Note",
    author: "Patel, Anita",
    credential: "MD",
    authorRole: "*PHYSICIAN: FACULTY",
    service: "Emergency Department",
    dateOfService: "Today 06:40",
    fileTime: "Today 07:12",
    timestamp: 1781505600,
    status: "signed",
    admission: true,
    urgent: true,
    body: `EMERGENCY DEPARTMENT PROVIDER NOTE

Presenting complaint: central epigastric pain, rigors and jaundice.

HPI: ~5 days of constant midline epigastric pain radiating to the back, worse
after meals. Treated as dyspepsia by GP (omeprazole) with no benefit. Overnight:
rigors, dark urine, family noticed yellow eyes.

On arrival febrile and tachycardic with rigors witnessed in triage. Visibly
jaundiced. Abdomen soft — tenderness EPIGASTRIC, Murphy's sign NEGATIVE.

Because the pain was epigastric I actively excluded mimics:
- ECG sinus tachycardia, no ischaemia; troponin not raised (not ACS).
- Lipase only mildly raised (92) — against primary pancreatitis.
- LFTs are cholestatic (bili 96, ALP 402, GGT 388); WCC 17.4, CRP 214; VBG
  lactate 2.6.

Impression: biliary sepsis — ACUTE CHOLANGITIS despite an atypical (epigastric)
presentation. Sepsis pathway started promptly: IV fluids, blood + urine cultures
sent, catheterised for hourly urine output, and broad-spectrum antibiotics
(piperacillin/tazobactam) given to meet the one-hour sepsis target. Referred to
General Surgery for admission and urgent ERCP. Medicines reconciliation and
allergy review to follow on the ward.`,
  },
  {
    kind: "note",
    id: "note-ed-001",
    encounterId: "enc-triage",
    category: "ED Notes",
    noteType: "ED Triage Note",
    author: "Okafor, Blessing",
    credential: "RN",
    authorRole: ".NURSE: (RN)",
    service: "Emergency Department",
    dateOfService: "Today 05:50",
    fileTime: "Today 06:02",
    timestamp: 1781503500,
    status: "signed",
    admission: true,
    urgent: true,
    body: `ED TRIAGE NOTE

64F self-presented with "tummy pain", chills and "yellow eyes". Rigors in the
waiting room. Pain is across the upper-middle abdomen. Looks unwell.

Obs: T 38.6, HR 112, BP 102/64, RR 22, SpO2 95% RA. NEWS2 = 7.
Allergy band applied: PENICILLIN.

Triage category: Very urgent. Sepsis screen initiated, doctor informed
immediately. Moved to majors. Bloods + VBG taken, IV access x1 sited.`,
  },
  {
    kind: "note",
    id: "note-prog-001",
    encounterId: "enc-ward-round",
    category: "Progress",
    noteType: "Post-Take Ward Round",
    author: "Green, Annabel",
    credential: "MD",
    authorRole: "*PHYSICIAN: FACULTY",
    service: "(A) General Surgery — AMU",
    dateOfService: "Today 09:50",
    fileTime: "Today 10:08",
    timestamp: 1781517000,
    status: "signed",
    admission: true,
    body: `SURGICAL POST-TAKE WARD ROUND NOTE

Seen on the post-take ward round with the on-call team.

64F admitted overnight with central epigastric pain, rigors and new jaundice —
atypical site, treated in the community as dyspepsia. Background gallstones and
rapid weight loss on metformin.

Obs improving after 1 L crystalloid: T 38.0, HR 102, BP 108/66.

Impression: acute cholangitis secondary to choledocholithiasis. TG18 Grade II.

Plan:
- Confirm blood + urine cultures sent before antibiotics (done).
- Antibiotics: broad-spectrum pip/taz started in ED on the sepsis pathway;
  penicillin allergy flagged at med rec — switched to ciprofloxacin +
  metronidazole per microbiology.
- Urgent ERCP today — gastroenterology referral made.
- NBM. Continue IV fluids. Strict fluid balance, hourly UO.
- Metformin continued on admission list, now held after lactate/AKI review.
  Withhold statin while NBM.
- Repeat LFTs and lactate at 6 hours. VTE assessment. Update next of kin.`,
  },
  {
    kind: "note",
    id: "note-prog-002",
    encounterId: "enc-admission",
    category: "Progress",
    noteType: "Best Poss Rx Hx",
    author: "Bajorek, Sarah",
    credential: "PharmD",
    authorRole: ".PHARMACIST",
    service: "Pharmacy",
    dateOfService: "Today 09:05",
    fileTime: "Today 09:31",
    timestamp: 1781514300,
    status: "signed",
    admission: true,
    body: `BEST POSSIBLE MEDICATION HISTORY

Sources: patient interview, GP summary, community pharmacy record (2 sources).

Regular medications confirmed:
- Metformin 500 mg PO BD (continued on the admission medicines list; recommend
  HOLD during this acute illness — lactic acidosis risk with sepsis / AKI / NBM).
- Atorvastatin 40 mg PO ON (withhold while NBM).
- Amlodipine 5 mg PO OD (review with blood pressure given sepsis).
- Omeprazole 20 mg PO OD (started 05/06/2026 for "dyspepsia").

Allergy: Penicillin — rash (documented; patient confirms).

MED REC / ALLERGY REVIEW: broad-spectrum piperacillin/tazobactam was given in ED
under the time-critical sepsis pathway. At ward medicines reconciliation the
documented penicillin allergy was confirmed (non-severe rash, no anaphylaxis).
Recommend switching to a non-penicillin regimen with microbiology — see their
advice. No anticoagulation on file — VTE prophylaxis to be assessed by the team
(note INR 1.3, platelets 132 pre-ERCP).`,
  },
  {
    kind: "note",
    id: "note-prog-003",
    encounterId: "enc-admission",
    category: "Progress",
    noteType: "Gastroenterology Progress",
    author: "Mensah, Daniel",
    credential: "MD",
    authorId: "d284617",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) Gastroenterology",
    dateOfService: "Today 13:10",
    fileTime: "Today 13:24",
    timestamp: 1781529000,
    status: "cosign",
    body: `GASTROENTEROLOGY PROGRESS NOTE

Reviewed prior to ERCP. Patient consented, NBM since 06:00, IV access x2.
Antibiotics switched to ciprofloxacin + metronidazole (penicillin allergy).
Latest lactate 1.9 (improving), bilirubin 92. INR 1.3 — vitamin K given.

Plan:
- For ERCP this afternoon on the emergency list (TG18 Grade II — drain promptly).
- Continue IV fluids and antibiotics peri-procedure.
- Repeat bloods post-procedure; monitor for post-ERCP pancreatitis and bleeding.

Awaiting consultant cosign.`,
    addendum: `ATTENDING ATTESTATION — Abara, Felix, MD (Gastroenterology):
I reviewed the note above of the gastroenterology resident. I personally saw and
examined the patient, reviewed the laboratory and imaging findings, and discussed
the assessment and plan, with which I agree. Patient is appropriate for urgent
ERCP for biliary decompression. Electronically signed by Abara, Felix, MD.`,
  },
  {
    kind: "note",
    id: "note-cons-001",
    encounterId: "enc-admission",
    category: "Consults",
    noteType: "Consult Note",
    author: "Abara, Felix",
    credential: "MD",
    authorRole: "*PHYSICIAN: FACULTY",
    service: "(A) Gastroenterology",
    dateOfService: "Today 11:15",
    fileTime: "Today 11:40",
    timestamp: 1781522100,
    status: "signed",
    body: `GASTROENTEROLOGY CONSULT — ERCP

Asked to review 64F with acute cholangitis and dilated CBD (10 mm) with an
obstructing distal stone on ultrasound.

Agree with ascending cholangitis secondary to choledocholithiasis (TG18 Grade II).
Atypical epigastric pain but the obstructive LFT picture, fever and imaging are
diagnostic. Sepsis physiology improving with resuscitation and antibiotics.

Plan:
- Accept for urgent ERCP today for biliary decompression and stone extraction.
- Check platelets and clotting; correct coagulopathy pre-procedure (INR 1.3 —
  vitamin K; recheck before sedation).
- Consent obtained including risks of post-ERCP pancreatitis, bleeding, perforation.
- Anaesthetic review requested for sedation given septic state.`,
  },
  {
    kind: "note",
    id: "note-cons-002",
    encounterId: "enc-admission",
    category: "Consults",
    noteType: "Microbiology Consult",
    author: "Roussel, Marie",
    credential: "MD",
    authorRole: "*PHYSICIAN: FACULTY",
    service: "Microbiology",
    dateOfService: "Today 10:30",
    fileTime: "Today 10:52",
    timestamp: 1781519400,
    status: "signed",
    body: `MICROBIOLOGY — ANTIMICROBIAL ADVICE

Re: 64F, acute cholangitis, sepsis. Documented penicillin allergy (rash).
Piperacillin/tazobactam was started in ED on the sepsis pathway; now switch given the documented penicillin allergy.

The rash is non-severe (no anaphylaxis / SJS), so cross-reactivity risk with
non-beta-lactam agents is not a concern. Recommendation for biliary sepsis in
penicillin allergy:

- Ciprofloxacin 400 mg IV BD PLUS metronidazole 500 mg IV TDS (empirical Gram-
  negative + anaerobic cover for a biliary source).
- Ensure blood + urine cultures were taken before the switch (confirmed sent in ED).
- Chase cultures; de-escalate on sensitivities. Review at 48 hours. Most likely
  organisms: E. coli, Klebsiella, Enterococcus.`,
  },
  {
    kind: "note",
    id: "note-cons-003",
    encounterId: "enc-admission",
    category: "Consults",
    noteType: "Pre-Procedure Assessment",
    author: "Ngata, Hemi",
    credential: "MD",
    authorRole: "*PHYSICIAN: FACULTY",
    service: "Anaesthetics",
    dateOfService: "Today 12:40",
    fileTime: "Today 12:58",
    timestamp: 1781527200,
    status: "signed",
    body: `ANAESTHETIC PRE-PROCEDURE ASSESSMENT (for ERCP)

64F, septic but resuscitated. ASA III. Mallampati II, good mouth opening.
NBM since 06:00. Penicillin allergy noted. INR 1.3 (vitamin K given).

Plan:
- Conscious sedation with cardiorespiratory monitoring; senior anaesthetist
  present given septic physiology.
- Ensure IV access and fluids running; have vasopressor available.
- Post-procedure recovery in a monitored bed.`,
  },
  {
    kind: "note",
    id: "note-nurse-001",
    encounterId: "enc-admission",
    category: "Nursing",
    noteType: "Nursing Admission Assessment",
    author: "Mai, Cherry",
    credential: "RN",
    authorRole: ".NURSE: (RN)",
    service: "(A) General Surgery — AMU",
    dateOfService: "Today 07:55",
    fileTime: "Today 08:21",
    timestamp: 1781510100,
    status: "signed",
    admission: true,
    body: `NURSING ADMISSION ASSESSMENT

64F admitted to AMU Bay 3 from ED with biliary sepsis.

Obs on arrival: T 38.4, HR 104, BP 106/64, RR 20, SpO2 96% RA. NEWS2 = 5.
Pain score 7/10, upper-middle abdomen. Analgesia given as charted.

Risk assessments: falls — low; pressure area (Waterlow) — moderate; VTE — to be
completed by medical team. Penicillin allergy band checked and present.
Two peripheral cannulae in situ; urinary catheter sited, hourly output monitored.
Capillary glucose monitoring commenced (diabetic, metformin held). Patient and
family updated — anxious but cooperative.`,
  },
  {
    kind: "note",
    id: "note-nurse-002",
    encounterId: "enc-admission",
    category: "Nursing",
    noteType: "Nursing Shift Note",
    author: "Basilio, Roxanne",
    credential: "RN",
    authorRole: ".NURSE: (RN)",
    service: "(A) General Surgery — AMU",
    dateOfService: "Today 15:30",
    fileTime: "Today 15:46",
    timestamp: 1781537400,
    status: "signed",
    body: `NURSING SHIFT NOTE (Late)

Patient returned from ERCP at 15:05, sedation worn off, GCS 15. Obs stable:
T 37.2, HR 84, BP 118/72. Pain improved (2/10). Remains NBM per gastro until
review. IV fluids and ciprofloxacin/metronidazole continuing.

Monitoring for post-ERCP complications: abdominal pain (?pancreatitis), bleeding,
fever. Urine output adequate. Capillary glucose 9.1 — sliding scale not required.
Family at bedside and updated. Escalation plan in place.`,
  },
  {
    kind: "note",
    id: "note-proc-001",
    encounterId: "enc-admission",
    category: "Procedures",
    noteType: "ERCP Procedure Note",
    author: "Abara, Felix",
    credential: "MD",
    authorRole: "*PHYSICIAN: FACULTY",
    service: "(A) Gastroenterology",
    dateOfService: "Today 14:25",
    fileTime: "Today 14:58",
    timestamp: 1781533500,
    status: "signed",
    body: `ERCP PROCEDURE NOTE

Indication: acute cholangitis with choledocholithiasis (TG18 Grade II).
Sedation: conscious sedation, anaesthetist present. Antibiotics given (cipro/met).

Findings: deep cannulation of the common bile duct achieved. Cholangiogram
showed a dilated CBD (~10 mm) with a single obstructing distal stone. Pus
expressed on sphincterotomy, consistent with cholangitis.

Procedure: biliary sphincterotomy performed; stone extracted with balloon trawl.
Good biliary drainage achieved. No plastic stent required.

Complications: none immediate. Estimated blood loss minimal.

Post-procedure plan: NBM 4 hours then sips. Monitor for post-ERCP pancreatitis
(amylase/lipase if abdominal pain), bleeding and perforation. Continue
antibiotics; surgical team to plan interval laparoscopic cholecystectomy.`,
  },
  {
    kind: "note",
    id: "note-proc-002",
    encounterId: "enc-admission",
    category: "Procedures",
    noteType: "Line Insertion Note",
    author: "Mensah, Daniel",
    credential: "MD",
    authorId: "d284617",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery — AMU",
    dateOfService: "Today 14:10",
    fileTime: "Today 14:19",
    timestamp: 1781532600,
    status: "signed",
    body: `PERIPHERAL CANNULA INSERTION NOTE

Second large-bore cannula (18G) sited in left antecubital fossa under aseptic
technique for peri-procedural fluids and antibiotics. Inserted first attempt,
flushed and patent, no complications. VIP score 0.`,
  },
  {
    kind: "note",
    id: "note-prog-004",
    encounterId: "enc-admission",
    category: "Progress",
    noteType: "Progress Note",
    author: "Mensah, Daniel",
    credential: "MD",
    authorId: "d284617",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery — AMU",
    dateOfService: "Today 16:45",
    fileTime: "—",
    timestamp: 1781541900,
    status: "incomplete",
    body: `POST-ERCP PROGRESS NOTE (DRAFT)

Reviewed post-ERCP. Patient comfortable, observations stable, tolerating sips.

Assessment: acute cholangitis, source controlled following ERCP and
sphincterotomy with stone extraction.

Plan:
- Continue IV antibiotics, review at 48 hours with microbiology / cultures.
- ***repeat bloods in AM — bilirubin / LFT trend, FBC, lactate***
- ***restart metformin only once eating + lactate normal — document decision***
- ***document interval cholecystectomy plan with consultant***
- VTE prophylaxis decision pending (post-sphincterotomy bleeding risk).

[Draft — not yet signed.]`,
  },
  {
    kind: "note",
    id: "note-dc-001",
    encounterId: "enc-admission",
    category: "Discharge",
    noteType: "Discharge Summary",
    author: "Mensah, Daniel",
    credential: "MD",
    authorId: "d284617",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery — AMU",
    dateOfService: "Today 16:50",
    fileTime: "—",
    timestamp: 1781542200,
    status: "incomplete",
    body: `DISCHARGE SUMMARY (DRAFT — IN PROGRESS)

Reason for admission: acute cholangitis secondary to choledocholithiasis
(atypical epigastric presentation; TG18 Grade II).

Hospital course: presented with epigastric pain, rigors and jaundice; sepsis
six commenced; antibiotics corrected from piperacillin/tazobactam to
ciprofloxacin + metronidazole (penicillin allergy); underwent urgent ERCP with
sphincterotomy and stone extraction.

Discharge medications: ***to complete — restart metformin/statin when safe***
Follow-up: ***surgical clinic for interval cholecystectomy — to arrange***
Outstanding results: ***blood culture sensitivities pending***
Patient education: ***safety-net re recurrent biliary pain / jaundice***

[Incomplete — do not finalise until ERCP recovery confirmed and TTOs reviewed.]`,
  },
  {
    kind: "encounterSummary",
    id: "admission-encounter-001",
    encounterId: "enc-admission",
    title: "Admission — ED to Hosp-Admission",
    type: "Hospital Encounter",
    department: "General Surgery",
    author: "Green, Annabel, MD (Attending)",
    signedAt: "Today 07:40",
    body: `ADMISSION  [Current]
Today 07:40 — present       Mount Verdant Hospital
Admitting / Attending: Green, Annabel, MD — General Surgery

PRINCIPAL PROBLEM:
Sepsis due to biliary source — acute cholangitis with choledocholithiasis.

ENCOUNTER NOTES:
- ED Provider Note — Patel, Anita, MD (Emergency Medicine)
- Surgical Post-Take Ward Round — Green, Annabel, MD (General Surgery)

HOSPITAL PROBLEM LIST:
◆ Acute cholangitis (TG18 Grade II) — PRINCIPAL
- Choledocholithiasis (obstructing distal CBD stone)
- Sepsis — screen positive
- Obstructive jaundice
- Type 2 diabetes mellitus (metformin held)
- Hyperlipidaemia
- Essential hypertension

CARE TIMELINE:
05:50  Arrived in ED (self-presented)
06:40  Seen by ED provider; sepsis six commenced
07:40  Admitted — General Surgery, AMU Bay 3

EXPECTED MEDICATION LIST:
- Ciprofloxacin 400 mg IV BD (penicillin allergy — see Microbiology advice)
- Metronidazole 500 mg IV TDS
- Sodium chloride 0.9% IV — resuscitation then maintenance
- Paracetamol 1 g IV/PO QDS PRN
- Metformin 500 mg PO BD — continued on admission list, then HELD after lactate/AKI review
- Atorvastatin 40 mg PO ON — withheld while NBM
- Amlodipine 5 mg PO OD — review with BP

ALLERGIES: Penicillin — rash.
CODE STATUS: For escalation. ISOLATION: None.

All patient data are synthetic. For education and simulation only. Not for clinical use.`,
  },
  {
    kind: "report",
    id: "uss-report-001",
    encounterId: "enc-uss",
    title: "US Abdomen — Biliary",
    type: "Radiology Report",
    department: "Radiology",
    author: "Okonkwo, Ada, MD (Radiology)",
    signedAt: "Today 08:30",
    body: `EXAMINATION: Ultrasound abdomen (biliary), portable, AMU.
CLINICAL DETAILS: Epigastric pain, jaundice, cholestatic LFTs. ?cholangitis.

FINDINGS:
- Gallbladder contains multiple small mobile calculi. Wall not thickened; no
  pericholecystic fluid. Sonographic Murphy's negative.
- Common bile duct dilated at 10 mm (prior US 16/01/2026: 4 mm) with an
  echogenic obstructing calculus at the distal CBD and post-acoustic shadowing.
- Intrahepatic ducts mildly prominent. Liver normal echotexture. No free fluid.
- Pancreas partly obscured by bowel gas; visualised portions unremarkable.

IMPRESSION:
Choledocholithiasis with CBD dilatation and proximal biliary obstruction, in
keeping with the clinical picture of acute cholangitis. Recommend urgent ERCP.`,
  },
  {
    kind: "letter",
    id: "clinic-letter-001",
    encounterId: "enc-clinic-dyspepsia",
    title: "Primary Care Review — Dyspepsia",
    type: "Letter",
    department: "Primary Care",
    author: "Shah, Rajesh, MD",
    signedAt: "05/06/2026",
    body: `Dear colleague,

I reviewed Mrs Hart regarding ~2 weeks of intermittent central epigastric
discomfort after meals. She is systemically well today: afebrile, not jaundiced,
observations normal. Abdomen soft with mild epigastric tenderness only; no
right-sided, radiating or severe pain, and no vomiting.

With no alarm features today, the picture is most consistent with dyspepsia. I
have started a trial of omeprazole 20 mg once daily and arranged review in 4
weeks. Bloods were not indicated at this visit given the absence of red flags.

Safety-netting given clearly and documented: seek urgent / same-day care if she
develops fever, jaundice, dark urine, vomiting, or pain that becomes severe or
persistent.

Kind regards,
Dr R. Shah`,
  },
  {
    kind: "letter",
    id: "diabetes-letter-001",
    encounterId: "enc-diabetes-dx",
    title: "Primary Care — New Type 2 Diabetes",
    type: "Letter",
    department: "Primary Care",
    author: "Shah, Rajesh, MD",
    signedAt: "13/01/2026",
    body: `Dear colleague,

Mrs Hart has newly diagnosed Type 2 diabetes (HbA1c 68 mmol/mol). Total
cholesterol is 6.4; LFTs normal today. Weight 84 kg, BMI 32.

Plan agreed with the patient:
- Start metformin 500 mg BD (titrate as tolerated).
- Continue atorvastatin 40 mg ON.
- Low-calorie dietary programme with the practice nurse; aim for gradual,
  sustained weight loss.

She is motivated and keen to lose weight. Reviewed lifestyle and driving advice.
Routine diabetes follow-up arranged.

Kind regards,
Dr R. Shah`,
  },
  {
    kind: "order",
    id: "refill-statin-001",
    encounterId: "enc-refill-statin",
    title: "Repeat Prescription — Atorvastatin",
    type: "Medication Order",
    department: "Primary Care",
    author: "Shah, Rajesh, MD",
    signedAt: "06/05/2026",
    body: `REPEAT PRESCRIPTION (issued electronically to community pharmacy)

Drug: Atorvastatin 40 mg tablets
Directions: Take ONE tablet at night.
Quantity: 56 tablets (8 weeks).
Indication: Hyperlipidaemia / cardiovascular risk reduction.

Last issue: 11/03/2026. Compliance good per pharmacy record. No reported myalgia.
Annual LFT/lipid review due.`,
  },
  {
    kind: "order",
    id: "refill-amlodipine-001",
    encounterId: "enc-refill-amlodipine",
    title: "Repeat Prescription — Amlodipine",
    type: "Medication Order",
    department: "Primary Care",
    author: "Shah, Rajesh, MD",
    signedAt: "06/05/2026",
    body: `REPEAT PRESCRIPTION (issued electronically to community pharmacy)

Drug: Amlodipine 5 mg tablets
Directions: Take ONE tablet each morning.
Quantity: 28 tablets (4 weeks).
Indication: Essential hypertension.

Last issue: 08/04/2026. Compliance good per pharmacy record. No ankle swelling
reported. BP within target at last review. Routine medication review due.`,
  },
  {
    kind: "order",
    id: "refill-metformin-001",
    encounterId: "enc-refill-metformin",
    title: "Repeat Prescription — Metformin",
    type: "Medication Order",
    department: "Primary Care",
    author: "Shah, Rajesh, MD",
    signedAt: "02/04/2026",
    body: `REPEAT PRESCRIPTION (issued electronically to community pharmacy)

Drug: Metformin 500 mg tablets
Directions: Take ONE tablet twice daily with food.
Quantity: 112 tablets (8 weeks).
Indication: Type 2 diabetes mellitus.

Last issue: 05/02/2026. Tolerating well; initial GI upset settled. Patient reports
ongoing weight loss with diet. HbA1c recheck due at next diabetes review.`,
  },
  {
    kind: "letter",
    id: "telephone-diabetes-001",
    encounterId: "enc-telephone-diabetes",
    title: "Primary Care — Telephone Diabetes Review",
    type: "Letter",
    department: "Primary Care",
    author: "Shah, Rajesh, MD",
    signedAt: "20/03/2026",
    body: `Dear colleague,

Telephone diabetes review with Mrs Hart. She is pleased with her progress: ~6 kg
weight loss since starting metformin and the low-calorie dietary plan in January.
No hypoglycaemic symptoms. Tolerating metformin 500 mg BD well after initial mild
GI upset. No polyuria, polydipsia or visual symptoms.

Plan agreed:
- Continue metformin 500 mg BD and the dietary programme.
- Repeat HbA1c, U&E and lipids before the next face-to-face review.
- Continue atorvastatin and amlodipine; repeats issued.

She remains motivated. Routine review arranged.

Kind regards,
Dr R. Shah`,
  },
  {
    kind: "letter",
    id: "htn-review-001",
    encounterId: "enc-htn-review",
    title: "Primary Care — Hypertension Review",
    type: "Letter",
    department: "Primary Care",
    author: "Shah, Rajesh, MD",
    signedAt: "19/12/2024",
    body: `Dear colleague,

Routine hypertension review. Mrs Hart is well with no cardiovascular symptoms: no
chest pain, breathlessness or palpitations. Home and clinic blood pressure readings
are within target on amlodipine 5 mg OD. No ankle oedema.

Examination: BP 132/80, HR 72 regular. Heart sounds normal, chest clear.

Plan:
- Continue amlodipine 5 mg OD.
- Annual bloods (U&E, lipids, HbA1c) and BP review.
- Lifestyle advice reinforced.

No acute issues. Routine follow-up.

Kind regards,
Dr R. Shah`,
  },
  {
    kind: "report",
    id: "uss-prior-001",
    encounterId: "enc-uss-prior",
    title: "US Abdomen — Outpatient",
    type: "Radiology Report",
    department: "Radiology",
    author: "Okonkwo, Ada, MD (Radiology)",
    signedAt: "16/01/2026",
    body: `EXAMINATION: Ultrasound abdomen, outpatient.
CLINICAL DETAILS: Intermittent epigastric discomfort / dyspepsia. Assess for gallstones.

FINDINGS:
- Gallbladder contains several small mobile calculi. Wall not thickened; no
  pericholecystic fluid. Sonographic Murphy's negative.
- Common bile duct normal calibre at 4 mm. No intrahepatic duct dilatation.
- Liver normal size and echotexture. No focal lesion. Pancreas (visualised
  portions) unremarkable. No free fluid.

IMPRESSION:
Uncomplicated gallbladder calculi with a normal-calibre CBD. No biliary
obstruction. Asymptomatic cholelithiasis — clinical correlation advised.`,
  },
  {
    kind: "report",
    id: "ed-2025-001",
    encounterId: "enc-ed-2025",
    title: "ED Attendance — Summary",
    type: "ED Visit Summary",
    department: "Emergency Department",
    author: "Doyle, Sean, MD",
    signedAt: "02/06/2025",
    body: `EMERGENCY DEPARTMENT ATTENDANCE — SUMMARY

Presenting complaint: epigastric pain after a takeaway meal.

HPI: Several hours of central epigastric discomfort following a fatty meal. No
fever, no jaundice, no vomiting. No prior similar episodes documented.

Examination: afebrile, haemodynamically stable. Abdomen soft, mild epigastric
tenderness, no peritonism. Murphy's sign negative.

Investigations: FBC, U&E and LFTs normal. Lipase normal. ECG normal.

Impression: self-limiting epigastric pain, likely dyspepsia / biliary colic.
Discharged home with simple analgesia and dietary advice. Safety-netted to return
if fever, jaundice, persistent or severe pain. GP follow-up advised.`,
  },
  {
    kind: "lab",
    id: "lab-bloods-admit-001",
    encounterId: "enc-bloods-admit",
    title: "Admission Bloods — FBC, U&E, LFTs, CRP, Lactate",
    status: "Final",
    specimen: "Blood (serum + EDTA), venepuncture",
    collected: "16/06/2026 06:05",
    received: "16/06/2026 06:18",
    reportedAt: "16/06/2026 06:50",
    orderedBy: "Patel, Anita, MD (Emergency Medicine)",
    resultingLab: "LegendCare Clinical Laboratory, Mount Verdant Hospital",
    rows: admissionLabRows,
  },
  {
    kind: "lab",
    id: "lab-bloods-diabetes-001",
    encounterId: "enc-bloods-diabetes",
    title: "Diabetes Screen — HbA1c, Lipids, LFTs, Renal",
    status: "Final",
    specimen: "Blood (serum + EDTA), venepuncture",
    collected: "13/01/2026 09:10",
    received: "13/01/2026 09:25",
    reportedAt: "13/01/2026 09:30",
    orderedBy: "Shah, Rajesh, MD (Primary Care)",
    resultingLab: "LegendCare Clinical Laboratory, Mount Verdant Hospital",
    rows: [
      { test: "HbA1c", value: "68", units: "mmol/mol", range: "20–41", flag: "H" },
      { test: "Total cholesterol", value: "6.4", units: "mmol/L", range: "<5.0", flag: "H" },
      { test: "HDL cholesterol", value: "1.1", units: "mmol/L", range: ">1.0", flag: "" },
      { test: "Bilirubin", value: "11", units: "µmol/L", range: "<21", flag: "" },
      { test: "ALP", value: "78", units: "U/L", range: "30–130", flag: "" },
      { test: "ALT", value: "24", units: "U/L", range: "<40", flag: "" },
      { test: "Albumin", value: "42", units: "g/L", range: "35–50", flag: "" },
      { test: "Creatinine", value: "74", units: "µmol/L", range: "45–90", flag: "" },
      { test: "eGFR", value: "78", units: "mL/min/1.73m²", range: ">60", flag: "" },
    ],
  },
  {
    kind: "micro",
    id: "micro-cultures-001",
    encounterId: "enc-micro-cultures",
    title: "Blood Culture (x2 sets) + Urine Culture",
    status: "Preliminary",
    specimen: "Blood culture x2 sets (aerobic + anaerobic, separate sites); Urine (MSU)",
    collected: "16/06/2026 06:05",
    received: "16/06/2026 06:40",
    reportedAt: "16/06/2026 — 48 hour review",
    organisms: [],
    resultText: `BLOOD CULTURE (x2 sets) — PRELIMINARY
Two sets collected from separate sites before antibiotics (sepsis pathway).
NO GROWTH TO DATE (48 hours). Blood cultures are examined daily; any change will
be documented. Gram stain pending. Final report at 5 days if no growth.

URINE CULTURE (MSU) — PRELIMINARY
Microscopy: no organisms seen; no significant pyuria.
NO GROWTH TO DATE. Awaiting culture.

Likely organisms for a biliary source if positive: E. coli, Klebsiella,
Enterococcus (see Microbiology antimicrobial advice). De-escalate on sensitivities.`,
  },
];

/** Note-kind documents only — feeds the Notes activity and Chart Review > Notes. */
export const caseCholangitis001Notes = caseCholangitis001Documents.filter(
  (doc): doc is Extract<ClinicalDocument, { kind: "note" }> => doc.kind === "note",
);
