# Legend

Junior doctors learn to read a messy chart and write a safe note by doing it on real patients, under supervision. There is no low-stakes place to practise that judgement and fail without consequence. **Legend is that sandbox:** a synthetic, Epic-style **EHR training simulator** that puts you in front of fictional patients and grades the note you write.

It recreates the parts of an electronic health record you actually have to navigate (a patient list, a summary view, a full encounter history with clickable lab and microbiology "receipts", and a clinical notes workspace) and wraps them around deliberately *atypical* teaching cases, so you have to reason rather than pattern-match.

> **New to clinical work?** The skill on trial is *safe documentation*: reading scattered evidence in a chart, then writing a note that captures the important findings and, crucially, does not miss a dangerous one. A clinician is judged as much on what they *do not* omit as on what they include, and Legend scores exactly that.

> All patient data are synthetic and fabricated for teaching. Legend is for education and simulation only, **not** clinical decision-making.

> **Status: active work in progress.** 15 cases across 4 specialties are playable; the app is under active development and deliberately rough in places.

## Live demo

**https://legend.ryanho06.workers.dev**

No account, no backend. Everything you write stays in your own browser (localStorage), so there is nothing to register and nothing to leak. Signing out clears it.

## How to use it, step by step

1. **Sign in.** Enter any first and last name, then pick your **Hierarchy** (FY1-2, ST3+, or Consultant, with US equivalents shown). Your grade matters: each case is pitched at a level, and signing a note on a case above your grade is flagged as overreach.
2. **Pick a patient.** You land on **Patient Lists**. "All Patients" (the default) shows every case; the specialty lists below it narrow to one team. The **Hierarchy** column shows each case's task and the grade it expects, and the Hierarchy filter lets you show only cases at your level. Click a row to open that patient's chart.
3. **Review the chart.** Start with **Summary** (banner, vitals trend, problems, meds, labs, microbiology). Then work **Chart Review**: an encounter timeline where each row opens its underlying document (imaging, lab and microbiology receipts, prior notes). Filters (inpatient / outpatient / ED / admissions) narrow the timeline.
4. **Read the existing notes.** The **Notes** activity is a mailbox-style browser; open notes to cross-reference them in multi-tab previews. Watch for what earlier clinicians did and did not document.
5. **Draft your note.** Click **New Note**. Use **Insert SmartText** to drop an Epic-style template (H&P, Progress, Post-Take Ward Round) that auto-fills demographics, plus vitals and labs for progress notes; Tab cycles through the `***` wildcards for you to fill. The **sticky note** is a scratchpad for your reasoning.
6. **Sign or Pend.**
   - **Sign** publishes the note to the chart attributed to you and opens the **Performance** dock, which scores it.
   - **Pend** files it as incomplete. You can still submit a pended or open draft for practice feedback from the Performance dock; only a *signed* note can trigger the overreach penalty.
7. **Read the feedback.** The Performance dock scores your note against the case rubric: required findings, unsafe omissions, section structure, and a conciseness band. The **model note is revealed after scoring**, not before, so it teaches rather than gets paraphrased. If you signed above your grade, you get an "acting above your competence" result instead: escalate, do not improvise.
8. **Revise and move on.** Notes you own can be **edited** (reopen an incomplete note) or **addended** (a stamped block on a signed note). Switch patients via the chart tabs, or the hamburger to return to the list. The user bubble (top right) signs you out and clears everything.

> Each case hides a specific trap. The cholangitis case, for example, punishes anchoring: read the allergy banner before you write the plan.

## Run it locally

```bash
npm install
npm run dev      # Vite dev server (default http://localhost:5173)
npm run build    # type-check + production build
npm run lint     # eslint
npm test         # vitest (pure scoring / reflow libs)
```

The live demo is served as Cloudflare Workers static assets: `npm run build` then `npx wrangler deploy` (config in `wrangler.jsonc`).

## Screenshots

> Each caption ends with a plain-language note (in italics) on what a non-clinical reader should notice.

**Patient Lists**: the ward list of every case, grouped by specialty with an "All Patients" view and a Hierarchy filter. Each row shows the task and the seniority it expects.

![Legend, Patient Lists with hierarchy](docs/patient-list.png)

*The front door: pick a patient to open their chart. The Hierarchy column tags each case with the grade (junior / registrar / consultant) it is pitched at, so you can practise at your own level.*

**Summary view**: patient banner, vitals trend, active problems, labs, meds, microbiology.

![Legend, Summary view](docs/summary.png)

*The one screen a doctor skims first. The story usually hides in the trend chart and the lab table: a good clinician reads the direction of travel, not just the latest number.*

**Chart Review**: Epic-style encounter timeline with recency buckets, filters, and clickable structured documents.

![Legend, Chart Review](docs/chart-review.png)

*The patient's timeline. Every row is a document (a scan, a lab result, an earlier note) you click to open, and the task is to assemble the story from scattered evidence.*

**Student working view**, mid-task: reviewing existing notes, drafting a new progress note in the editor (right), with the sticky-note reasoning scratchpad open.

![Legend, student working view](docs/student-view.png)

*Existing notes on the left, your draft on the right, and a sticky note for working out your reasoning, like scratch paper.*

**Note feedback**: signing a note opens the Performance dock, which scores it against the case rubric. Here it credits the penicillin-allergy catch but flags an unsafe omission (metformin never documented as held).

![Legend, Performance dock note feedback](docs/performance.png)

*The app graded the note. Green is credit for something important the student caught; red is a safety miss they left out. The model ("right answer") note only unlocks after grading, so it teaches instead of being copied.*

**Overreach guard**: sign a case above your grade and the score is replaced by a safety block, telling you to escalate to a senior rather than improvise a decision beyond your competence.

![Legend, overreach safety block](docs/overreach.png)

*No clinical knowledge needed for this one: a junior tried to sign off a senior-level decision, and the system stopped them, the same escalation rule a real hospital enforces.*

## Features

- **Patient Lists.** An Epic-style patient list grouped by specialty, with an "All Patients" view and a Hierarchy filter. Open several charts as tabs and switch between them.
- **Seniority and case tasks.** Sign in at a grade (FY1-2 / ST3+ / Consultant). Each case declares a task and the minimum grade it expects; the list surfaces this, and signing above your grade is flagged as overreach rather than scored.
- **Summary view.** Patient banner, vitals chart and table, and an at-a-glance overview of problems, meds, labs, and microbiology.
- **Chart Review.** An encounters table with filters (inpatient / outpatient / ED / admissions); every row opens a viewable document, including structured **lab** and **microbiology** reports rendered as receipts.
- **Notes.** A clinical-notes browser and editor with text search, multi-tab preview, SmartText templates, and letter-page rendering. Sign to publish a note attributed to you, Pend to file it incomplete, and edit or addend notes you own.
- **Note feedback (the Performance dock).** Signing scores the note against a per-case rubric: required findings, unsafe omissions (one case hides a penicillin-allergy prescribing catch), section structure, and a conciseness band. The axes operationalise a subset of PDQI-9, the validated nine-dimension note-quality instrument (Stetson et al., 2012). The model note is revealed after scoring, not before. Pended and draft notes can be submitted for practice feedback without the overreach penalty.
- **15 worked cases across 4 specialties** (General Surgery, Emergency Medicine, General Medicine, Geriatrics), each an atypical presentation built to reward reasoning over pattern-matching.
- **Synthetic-only by design.** Simulation disclaimers are built into the report banners, not bolted on.

## Roadmap

- **LLM judge.** The rubric schema is judge-agnostic: deterministic matching ships first, and a Claude-based judge can later score the paraphrase-heavy items without a rewrite.
- **More cases and specialties.** A case is a data-only bundle (chart data, rubric, model note), so the library grows without touching the app.

## Tech stack

React 19 + TypeScript, built with Vite. Charts via Recharts, icons via lucide-react, resizable panes via react-resizable-panels. Unit tests via Vitest (the pure scoring and reflow libs). No backend: case data is typed and static, and the trainee's identity and notes live in browser localStorage, so there is nothing to provision and no data to leak.

## Status

Active prototype. 15 cases across 4 specialties, a single stylesheet, and case content stored as typed `.ts` bundles per case (the renderers are data-driven, so a JSON or markdown case loader can be added later without touching them). Built solo with Claude Code.
