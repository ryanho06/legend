import type { CaseBundle, CaseEvent, ClinicalNote } from "../types";
import { appendAddendum } from "./userNotes";

/**
 * Fold overlay events onto a static CaseBundle, returning a NEW bundle. The
 * single seam through which runtime content joins a case: the trainee's own
 * notes/addenda now, sim-reveal results/encounters/vitals in the engine plan.
 *
 * Pure and immutable: never mutates `bundle` (getCase returns a shared registry
 * singleton reused across open tabs). `applyEvents(bundle, [])` returns the SAME
 * reference (static cases are untouched). `documents` is the source of truth;
 * `notes` is recomputed as its kind:"note" subset, so the two never drift.
 * Events apply in array order; the caller orders them (a note.create must
 * precede a note.addendum that targets it).
 */
export function applyEvents(bundle: CaseBundle, events: CaseEvent[]): CaseBundle {
  if (events.length === 0) return bundle;
  let documents = bundle.documents;
  let encounters = bundle.encounters;
  let summary = bundle.summary;
  let flags = bundle.flags;
  for (const event of events) {
    switch (event.kind) {
      case "note.create":
        documents = [...documents, event.note];
        break;
      case "note.addendum":
        documents = documents.map((doc) =>
          doc.kind === "note" && doc.id === event.noteId
            ? { ...doc, addendum: appendAddendum(doc.addendum, event.block) }
            : doc,
        );
        break;
      case "result.release":
        documents = [...documents, event.document];
        break;
      case "encounter.append":
        // Prepend at index 0 with `group` omitted so it lands in the implicit
        // current recency bucket (the table only emits a header when group is set).
        encounters = [event.encounter, ...encounters];
        break;
      case "vitals.append":
        summary = { ...summary, vitalsTrend: [...summary.vitalsTrend, event.point] };
        break;
      case "flag.set":
        flags = { ...flags, [event.key]: event.value };
        break;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }
  const notes = documents.filter((doc): doc is ClinicalNote => doc.kind === "note");
  return { ...bundle, documents, notes, encounters, summary, flags };
}

/**
 * Adapt a case's fetched server work into overlay events: one note.create per
 * note, then one note.addendum per addended note id (folded addenda are already
 * one string per note id). Creates precede addenda so a user note exists before
 * its addendum applies.
 */
export function workToEvents(
  notes: ClinicalNote[],
  addenda: Record<string, string>,
): CaseEvent[] {
  return [
    ...notes.map((note): CaseEvent => ({ kind: "note.create", note })),
    ...Object.entries(addenda).map(
      ([noteId, block]): CaseEvent => ({ kind: "note.addendum", noteId, block }),
    ),
  ];
}
