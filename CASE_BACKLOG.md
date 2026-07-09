# Legend case backlog

Case seeds for `CASE_AUTHORING.md`. Each seed is a condition plus the reasoning failure it
punishes (the spine) plus the safety catch that becomes a `critical` rubric item. Tick and
delete a seed once its case exists.

**Difficulty gradient (the main design rule).** Most intern/FY cases should be routine: a
stable ward patient where the task is to type up a clean, complete, structured progress
note. The skill tested is safe documentation, and the catch is a mundane omission (VTE
prophylaxis not charted, an antibiotic with no stop date, a result nobody chased, a drip
that should be stopped). Save the spiky anchoring traps, the can't-miss diagnoses, and the
ownership/ceiling calls for reg and PGY3+ cases with a higher `minGrade`. This matches the
engine: the patient list sorts easiest-first, and signing a case above your grade scores
-1000. Even a vanilla case still needs one safety catch (contract minimum): a note with
nothing to catch is typing practice, not a case.

**Inventing new cases.** Watch real practice and lift the failure. Examples worth turning
into cases: an ENT patient discharged on the wrong antibiotic and recalled to hospital
(author the discharge note with the error left in and have the trainee spot it); or a
reflexive "amoxicillin + gentamicin + metronidazole for two weeks for everything" that
ignores the gram stain and the culture. Those are idea generators, not committed entries.

FY cases are day-2 progress notes; the problem is already in the chart. Build a couple
first and validate the pipeline (`tsc -b`, `npm test`, leaky-trigger check); the rubric is
the hard part. `cholangitis001` (anchoring) is the reference case and is not listed.

---

## Tier A: intern / routine progress notes (`minGrade: fy`, vanilla) — start here, highest volume

Stable patient, the task is clean documentation, the catch is one mundane omission.

- [ ] **`postopday2001`**: 60F, day 2 post lap chole, apyrexial, eating, pain controlled.
  Spine: routine post-op note; nothing dramatic. Catch: VTE prophylaxis not charted. General Surgery.
- [ ] **`capreview001`**: 65M CAP, day 3, afebrile and improving.
  Spine: progress note on a recovering patient. Catch: IV antibiotic has no stop/review date and no IV-to-oral switch considered. Respiratory / Medicine.
- [ ] **`ivfluids001`**: 72M admitted with D&V, now eating and drinking, still on maintenance IV.
  Spine: routine note plus fluid review. Catch: IV fluids not stopped (deprescribe), U&Es not rechecked. Medicine.
- [ ] **`catheter001`**: 78F, urinary catheter in since admission 4 days ago, no ongoing indication.
  Spine: routine note. Catch: catheter not reviewed or removed (CAUTI risk). Care of the Elderly / Medicine.
- [ ] **`opioidlaxative001`**: 55M on regular opioid analgesia post-op, no bowel movement for 3 days.
  Spine: routine note. Catch: no laxative co-prescribed, constipation not addressed. Surgery.
- [ ] **`glycaemic001`**: 68M T2DM inpatient, capillary glucoses running 12 to 15, no plan documented.
  Spine: routine note. Catch: hyperglycaemia trend not acted on, no adjustment or plan. Medicine / Endocrinology.
- [ ] **`cellulitisreview001`**: 50F cellulitis, day 2 IV antibiotics, margin improving.
  Spine: document the response. Catch: margin not marked or measured to track progress, no IV-to-oral switch criteria. Dermatology / Medicine.
- [ ] **`medreconcile001`**: 80F admitted, home meds not fully reconciled; a chronic regular (e.g. levothyroxine) omitted from the drug chart.
  Spine: routine note plus med reconciliation. Catch: chronic medication omitted, not restarted. Medicine / Care of the Elderly.

## Tier B: FY to reg, progress note with a recognizable, escalatable twist (`minGrade: fy`, some `st3`)

The problem is on the chart and a junior can catch and escalate it.

- [ ] **`acs001`**: 72M, day 2 post-op, "indigestion" and clammy.
  Spine: anchoring on dyspepsia, missing atypical/silent MI in a diabetic. Catch: troponin pending and unchased, no aspirin, no serial ECG. Cardiology. Anchor: KCP wk2/wk15, STEP.
- [ ] **`copdo2001`**: 68F COPD exacerbation, day 2, drowsy, sats 97% on 4L.
  Spine: over-oxygenation causing CO2 narcosis in type 2 respiratory failure; the high sats are the trap. Catch: no 88 to 92% target set, ABG not repeated. Respiratory. Anchor: KCP wk3/wk14, STEP.
- [ ] **`akinephro001`**: 80M day 3 post-op, creatinine rising.
  Spine: nephrotoxics (gentamicin, ACE inhibitor, NSAID) still charted through an AKI. Catch: nephrotoxics not held, contrast scan planned. Renal / General Surgery. Anchor: FY prescribing, STEP.
- [ ] **`neutrosepsis001`**: 34F, day 10 post-chemo, temp 38.2, "just a temperature."
  Spine: neutropenic sepsis not recognized as a time-critical emergency. Catch: antibiotics not given within 1 hour, cultures not sent. Haematology / Oncology.
- [ ] **`dkapotassium001`**: 19M T1DM, DKA on fixed-rate insulin, K+ now 3.0.
  Spine: potassium falls as insulin drives it intracellularly; replace before it crashes. Catch: insulin continued without K+ replacement, gas not repeated. Endocrinology. Anchor: KCP wk13, STEP.
- [ ] **`septicarthritis001`**: 55M hot swollen knee, known gout, given steroids.
  Spine: anchoring on a gout flare, missing a septic joint. Catch: joint not aspirated before starting steroids/immunosuppression. Orthopaedics / Rheumatology. Anchor: KCP wk6, STEP.
- [ ] **`caudaequina001`**: 44F back pain with new urinary hesitancy.
  Spine: mechanical back pain anchoring, missing red flags (saddle anaesthesia, retention). Catch: no PR exam or bladder scan, urgent MRI not requested. Neurosurgery / EM. Anchor: KCP wk8/wk20.
- [ ] **`capallergy001`**: 70M CAP, CURB-65 under-scored, charted amoxicillin, penicillin-allergic.
  Spine: allergy-versus-prescription mismatch plus severity under-scoring. Catch: documented penicillin allergy ignored, sepsis-6 not started. Respiratory / Medicine. Anchor: KCP wk19.
- [ ] **`peanchor001`**: post-op day 4, "anxiety" and pleuritic pain with tachycardia.
  Spine: anchoring on anxiety/musculoskeletal, missing PE; VTE prophylaxis had been omitted. Catch: prophylaxis missed, Wells not calculated. Respiratory / Medicine. Anchor: KCP wk3/wk18.
- [ ] **`asthmagas001`**: young asthmatic, tiring, pCO2 "normalizing."
  Spine: a normal or rising CO2 in acute severe asthma is life-threatening, not reassurance. Catch: not escalated to ITU. Respiratory. Anchor: KCP wk14, STEP.
- [ ] **`hyperkalaemia001`**: AKI patient, K+ 6.8, peaked T waves.
  Spine: ECG changes demand immediate calcium gluconate; do not wait for a repeat potassium. Catch: no cardiac membrane protection, ECG not repeated. Renal / EM. Anchor: STEP.
- [ ] **`afanticoag001`**: new AF on the ward, high CHA2DS2-VASc, not anticoagulated.
  Spine: rate control gets managed while the stroke-prevention decision is silently skipped. Catch: anticoagulation not addressed or documented. Cardiology. Anchor: KCP wk16/wk18.
- [ ] **`appendicitis001`**: elderly (or pregnant, retrocaecal) atypical presentation, anchored as gastroenteritis/UTI.
  Spine: atypical appendicitis under a plausible benign label. Catch: no serial examination, discharged prematurely. General Surgery.
- [ ] **`delirium001`**: elderly post-op confusion, labelled "sundowning."
  Spine: delirium is a symptom, not a diagnosis; the cause (sepsis, retention, drugs, hypoxia) is on the chart. Catch: no cause screen. Care of the Elderly.

## Tier C: reg / PGY3+ (`minGrade: st3` or `consultant`, high-risk judgment and can't-miss)

- [ ] **`mscc001`**: known breast/prostate cancer, new thoracic back pain and leg weakness.
  Spine: dismissing back pain in a cancer patient, missing cord compression. Catch: whole-spine MRI and dexamethasone not started, no flat bed rest. Oncology. Anchor: KCP wk20.
- [ ] **`strokemimic001`**: thrombolysis decision with a possible mimic (hypoglycaemia) or bleed, patient anticoagulated.
  Spine: do not thrombolyse a mimic or a haemorrhage; glucose and CT gate the decision. Catch: glucose not checked, CT/anticoag status not confirmed pre-lysis. Stroke / Medicine. Anchor: KCP wk4.
- [ ] **`ugibvarices001`**: cirrhotic, melaena, under-resuscitated, on a DOAC.
  Spine: variceal bleed severity plus an anticoagulant not stopped or reversed. Catch: Blatchford not scored, anticoag not held, no terlipressin/antibiotics. Gastroenterology / Surgery. Anchor: STEP.
- [ ] **`hyponatraemia001`**: post-op, confused, Na 118 from hypotonic IV fluids, correcting fast.
  Spine: iatrogenic cause plus the second trap of over-rapid correction (osmotic demyelination). Catch: fluids not reviewed, correction rate not capped. Medicine. Anchor: STEP.
  **IN PROGRESS (2026-07-09):** a partial folder sits on disk at `src/data/patients/hyponatraemia001/` (bloods.ts + patient.json only, deliberately left uncommitted and NOT in the registry). Next case-generation run: resume here first. Still needed: summary.ts, documents.ts, encounters.ts, rubric.ts + rubric.test.ts, registry entry, acceptance checklist. If the folder is gone, start it fresh.
- [ ] **`aorticdissection001`**: an apparent STEMI that is actually a dissection.
  Spine: antiplatelets or thrombolysis here is catastrophic; cross-arm BP and mediastinum are the tells. Catch: cross-arm BP not checked, CT aorta not done before anticoagulating. Cardiology / Vascular. Anchor: KCP wk15, STEP.
- [ ] **`sah001`**: thunderclap headache dismissed as migraine, patient anticoagulated.
  Spine: instant-onset "worst ever" headache is SAH until excluded. Catch: no CT, no LP for xanthochromia. Neurology. Anchor: STEP.
- [ ] **`gca001`**: headache, jaw claudication, transient visual loss.
  Spine: delaying steroids to wait for biopsy risks permanent blindness. Catch: steroids not started same day, ESR/CRP not sent. Rheumatology / Ophthalmology.
- [ ] **`hfcopd001`**: breathless patient with both LVF and COPD, one masking the other.
  Spine: treating the COPD (nebs) while missing the failing ventricle, or vice versa. Catch: BNP/echo not considered, fluid status not assessed. Cardiology / Respiratory. Anchor: KCP wk3.
- [ ] **`ceilingofcare001`**: frail multimorbid patient deteriorating, escalation/DNACPR/ceiling decision with family.
  Spine: ownership and end-of-life judgment rather than another investigation. Catch: no ceiling documented, futile escalation or missed palliation. Care of the Elderly / Medicine.
- [ ] **`postercp001`**: post-ERCP pancreatitis (or an anastomotic leak) in a patient whose procedure you did.
  Spine: recognizing and owning a complication of your own intervention rather than under-calling it. Catch: severity not scored, senior not informed, deterioration not acted on. Surgery / Gastroenterology.

---

## Deliberately excluded (and why)

- Pure Year 1 basic science (glycolysis, Nernst equation, embryology mechanisms): no patient or chart to reason over.
- Screening/epidemiology knowledge (breast screening, incidence vs prevalence): tests recall, not chart interpretation.
- `cholangitis001`: already the reference implementation.
