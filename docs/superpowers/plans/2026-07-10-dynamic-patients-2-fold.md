# Dynamic Patients, Plan 2: applyEvents Fold Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three coupled hand-merge expressions in `PatientWorkspace` with a single pure `applyEvents(bundle, events)` fold, and route the trainee's server work (notes + addenda) through it, with zero change to what the user sees. This establishes the one overlay seam the engine (Plan 3) hangs sim-reveal events onto.

**Architecture:** Add a pure `src/lib/applyEvents.ts` that folds a list of `CaseEvent`s onto a static `CaseBundle`, returning a new bundle whose `documents` is patched and whose `notes` is recomputed as the `kind:"note"` subset. Adapt the fetched work into events (`workToEvents`), fold once in `PatientWorkspace`, source `allDocuments`/`allNotes` from the folded bundle, and re-provide the folded bundle through a nested `CaseContext.Provider`. This plan is client-only: no schema, no server, no new event source (events are adapted from the existing `useCaseWork` result).

**Tech Stack:** TypeScript, React 19, Vitest (node pool for `src/lib`), `tsc -b`. No new dependencies.

## Global Constraints

- `applyEvents` is **pure and React-free** (unit-tested in the node pool) and **immutable**: it must never mutate the input `bundle` (`getCase` returns a shared registry singleton reused across open tabs). `applyEvents(bundle, [])` must return the **same reference** (`===`).
- `documents` is the source of truth; `notes` is **recomputed** as `documents.filter(kind === "note")`. Never patch the two arrays independently.
- **Behaviour-preserving:** the folded `documents`/`notes` must deep-equal what the current hand-merge produces. A regression test pins this against the exact old formula.
- Events are applied in **array order**; the adapter emits every `note.create` before any `note.addendum`, so a user note exists before its addendum applies.
- The `CaseEvent` union carries only the two note kinds in this plan; the engine plan (Plan 3) extends it with sim-reveal kinds (`result.release`, `encounter.append`, `vitals.append`, `flag.set`).
- No server/D1/schema change in this plan.
- Commit messages use no em dashes (use commas, parentheses, or colons).
- Verify loop: `npx tsc -b` and `npm test` must both be green before each commit.

---

### Task 1: `CaseEvent` type, `applyEvents` fold, and `workToEvents` adapter

**Files:**
- Modify: `src/types.ts` (add the `CaseEvent` type; place it just after the `CaseBundle` type, around line 413)
- Create: `src/lib/applyEvents.ts`
- Test: `src/lib/applyEvents.test.ts`

**Interfaces:**
- Consumes: `CaseBundle`, `ClinicalNote` from `src/types.ts`; `appendAddendum` from `src/lib/userNotes.ts`.
- Produces:
  - `CaseEvent` (discriminated union): `{ kind: "note.create"; note: ClinicalNote }` | `{ kind: "note.addendum"; noteId: string; block: string }`.
  - `applyEvents(bundle: CaseBundle, events: CaseEvent[]): CaseBundle` (pure, immutable, identity on `[]`).
  - `workToEvents(notes: ClinicalNote[], addenda: Record<string, string>): CaseEvent[]`.

- [ ] **Step 1: Add the `CaseEvent` type**

In `src/types.ts`, immediately AFTER the closing `};` of the `CaseBundle` type (around line 413), add:

```ts
/**
 * A single overlay event folded onto a CaseBundle by applyEvents. These kinds
 * cover the trainee's own work (notes + addenda); the engine plan adds
 * sim-reveal kinds (result / encounter / vitals). The fold patches `documents`
 * and recomputes `notes` from it.
 */
export type CaseEvent =
  | { kind: "note.create"; note: ClinicalNote }
  | { kind: "note.addendum"; noteId: string; block: string };
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/applyEvents.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { ClinicalNote } from "../types";
import { getCase } from "../data/patients/index";
import { appendAddendum } from "./userNotes";
import { applyEvents, workToEvents } from "./applyEvents";

const bundle = getCase("cholangitis001");

function userNote(id: string, addendum?: string): ClinicalNote {
  return {
    kind: "note",
    id,
    encounterId: "enc-admission",
    category: "Progress",
    noteType: "Progress Note",
    author: "Ho, Ryan",
    credential: "MD",
    authorRole: "*PHYSICIAN: RESIDENT",
    service: "(A) General Surgery",
    dateOfService: "16/06/26 1700",
    fileTime: "16/06/26 1700",
    timestamp: 1781629200,
    status: "signed",
    admission: true,
    body: "user note body",
    addendum,
  };
}

describe("applyEvents identity + immutability", () => {
  test("returns the same reference for no events", () => {
    expect(applyEvents(bundle, [])).toBe(bundle);
  });

  test("never mutates the input bundle", () => {
    const beforeLen = bundle.documents.length;
    const live = applyEvents(bundle, [{ kind: "note.create", note: userNote("u1") }]);
    expect(bundle.documents.length).toBe(beforeLen);
    expect(live.documents).not.toBe(bundle.documents);
  });
});

describe("applyEvents note.create", () => {
  test("appends the note to documents and recomputes notes", () => {
    const note = userNote("u1");
    const live = applyEvents(bundle, [{ kind: "note.create", note }]);
    expect(live.documents.at(-1)).toEqual(note);
    expect(live.notes.at(-1)).toEqual(note);
    expect(live.notes).toEqual(live.documents.filter((d) => d.kind === "note"));
  });
});

describe("applyEvents note.addendum", () => {
  test("appends an addendum block to a static note by id", () => {
    const target = bundle.notes[0];
    const live = applyEvents(bundle, [
      { kind: "note.addendum", noteId: target.id, block: "ADDX" },
    ]);
    const patched = live.documents.find((d) => d.id === target.id) as ClinicalNote;
    expect(patched.addendum).toBe(appendAddendum(target.addendum, "ADDX"));
  });

  test("targets a created user note that carried no addendum", () => {
    const note = userNote("u1");
    const live = applyEvents(bundle, [
      { kind: "note.create", note },
      { kind: "note.addendum", noteId: "u1", block: "ADDX" },
    ]);
    const patched = live.notes.find((n) => n.id === "u1") as ClinicalNote;
    expect(patched.addendum).toBe("ADDX");
  });

  test("ignores an addendum whose target id is absent", () => {
    const live = applyEvents(bundle, [
      { kind: "note.addendum", noteId: "nope", block: "X" },
    ]);
    expect(live.documents.map((d) => d.id)).toEqual(bundle.documents.map((d) => d.id));
  });
});

describe("workToEvents", () => {
  test("emits every note.create before any note.addendum", () => {
    const events = workToEvents([userNote("a"), userNote("b")], { a: "AX" });
    expect(events.map((e) => e.kind)).toEqual(["note.create", "note.create", "note.addendum"]);
  });
});

describe("behaviour preservation vs the old hand-merge", () => {
  test("folded documents and notes deep-equal the old formula", () => {
    const notes = [userNote("u1"), userNote("u2", "static addendum")];
    const addenda: Record<string, string> = {
      [bundle.notes[0].id]: "server addendum on a static note",
      u1: "server addendum on a user note",
    };

    // The exact expressions PatientWorkspace used before this refactor.
    const withAddenda = <T extends ClinicalNote>(note: T): T =>
      addenda[note.id]
        ? { ...note, addendum: appendAddendum(note.addendum, addenda[note.id]) }
        : note;
    const oldDocuments = [
      ...bundle.documents.map((doc) => (doc.kind === "note" ? withAddenda(doc) : doc)),
      ...notes.map(withAddenda),
    ];
    const oldNotes = [...bundle.notes.map(withAddenda), ...notes.map(withAddenda)];

    const live = applyEvents(bundle, workToEvents(notes, addenda));
    expect(live.documents).toEqual(oldDocuments);
    expect(live.notes).toEqual(oldNotes);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- applyEvents`
Expected: FAIL, cannot find module `./applyEvents`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/applyEvents.ts`:

```ts
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
    }
  }
  const notes = documents.filter((doc): doc is ClinicalNote => doc.kind === "note");
  return { ...bundle, documents, notes };
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- applyEvents`
Expected: PASS (all describe blocks, including behaviour preservation).

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/lib/applyEvents.ts src/lib/applyEvents.test.ts
git commit -m "feat(events): add CaseEvent, pure applyEvents fold, and workToEvents adapter"
```

---

### Task 2: Fold the trainee work into PatientWorkspace via a nested Provider

**Files:**
- Modify: `src/components/PatientWorkspace.tsx` (imports L1, L20, L24-31; the merge block L73-85; the return wrapper L267 + L391)

**Interfaces:**
- Consumes: `applyEvents`, `workToEvents` from `src/lib/applyEvents.ts` (Task 1); `CaseContext` from `src/context/CaseContext.ts`; `useMemo` from React.
- Produces: no new exports. `allDocuments` / `allNotes` now come from the folded `liveCase`; children see `liveCase` via a nested `CaseContext.Provider`.

**Behaviour-preservation note for the reviewer:** a grep confirmed that the ONLY reader of `bundle.documents` / `bundle.notes` is `PatientWorkspace` itself (`src/components/PatientWorkspace.tsx:82,85`). No other `useCase()` consumer (`SummaryModule`, `PatientSidebar`, `VitalsTable`, `VitalsChart`, `WrapUpModule`, `StickyNotePopup`) reads `documents` or `notes`. So re-providing `liveCase` (which differs from `activeCase` only in `documents`/`notes` for note-only events) is inert for every other consumer: the user sees exactly what they saw before.

- [ ] **Step 1: Add the imports**

In `src/components/PatientWorkspace.tsx`:

Change line 1 from:

```ts
import { useRef, useState } from "react";
```

to:

```ts
import { useMemo, useRef, useState } from "react";
```

Change line 20 from:

```ts
import { useCase } from "../context/CaseContext";
```

to:

```ts
import { CaseContext, useCase } from "../context/CaseContext";
```

Remove `appendAddendum,` from the `../lib/userNotes` import (lines 24-29): it is only used by the `withAddenda` helper being deleted in Step 2. The block should become:

```ts
import {
  buildAddendumBlock,
  buildUserNote,
  refileUserNote,
} from "../lib/userNotes";
```

Add, immediately after that userNotes import block:

```ts
import { applyEvents, workToEvents } from "../lib/applyEvents";
```

- [ ] **Step 2: Replace the hand-merge with the fold**

Replace this block (lines 73-85):

```ts
  // User-authored notes join the case content in every view; runtime addenda
  // overlay onto any note (static or user) by id, after any static addendum.
  const withAddenda = <T extends ClinicalNote>(note: T): T =>
    addenda[note.id]
      ? { ...note, addendum: appendAddendum(note.addendum, addenda[note.id]) }
      : note;
  const mergedUserNotes = userNotes.map(withAddenda);
  const allDocuments = [
    ...activeCase.documents.map((doc) => (doc.kind === "note" ? withAddenda(doc) : doc)),
    ...mergedUserNotes,
  ];
  const allNotes = [...activeCase.notes.map(withAddenda), ...mergedUserNotes];
```

with:

```ts
  // The trainee's server work (notes + folded addenda) joins the static case
  // content through the single applyEvents fold. documents/notes come from the
  // folded bundle, which is also re-provided via context below so every
  // useCase() consumer sees the same evolved chart.
  const events = useMemo(() => workToEvents(userNotes, addenda), [userNotes, addenda]);
  const liveCase = useMemo(() => applyEvents(activeCase, events), [activeCase, events]);
  const allDocuments = liveCase.documents;
  const allNotes = liveCase.notes;
```

- [ ] **Step 3: Wrap the returned tree in a nested Provider**

The component returns a fragment (`return (` at line 267, opening `<>`, closing `</>` at line 391). Change the opening `<>` to `<CaseContext.Provider value={liveCase}>` and the closing `</>` to `</CaseContext.Provider>`. Concretely:

Line 268 changes from:

```tsx
    <>
```

to:

```tsx
    <CaseContext.Provider value={liveCase}>
```

and line 391 changes from:

```tsx
    </>
```

to:

```tsx
    </CaseContext.Provider>
```

- [ ] **Step 4: Remove any import orphaned by the refactor**

Run: `npx tsc -b`
The deleted `withAddenda` helper was the last user of the `ClinicalNote` type import (line 31) and of `appendAddendum` (removed in Step 1). If `tsc` reports `ClinicalNote` as unused in `PatientWorkspace.tsx`, remove it from the `../types` import on line 31, leaving `import type { CaseUiState, Note, NoteStatus, UserProfile } from "../types";`. Re-run `npx tsc -b` until clean. Do not remove `Note`, `NoteStatus`, `CaseUiState`, or `UserProfile` (still used).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (all suites; the `applyEvents` behaviour-preservation test is the guard that this refactor changed nothing observable).

- [ ] **Step 6: Manually verify nothing changed (deferred to feature endgame)**

The controller runs this at endgame, not the implementer: `npm run dev`, open cholangitis001, confirm the Notes list, Chart Review, addenda display, Delete/Addendum gating, and Sign flow behave exactly as before. Note in your report that you did NOT run it.

- [ ] **Step 7: Commit**

```bash
git add src/components/PatientWorkspace.tsx
git commit -m "refactor(events): fold trainee work via applyEvents and a nested CaseContext.Provider"
```

---

## Self-Review

- **Spec coverage:** Implements `DYNAMIC_PATIENTS_SPEC.md` section 5.3 (the pure `applyEvents` fold; `notes` recomputed from `documents`; identity on `[]`; immutability; the nested `CaseContext.Provider` inside `PatientWorkspace`, not `App.tsx`; collapsing the `allDocuments`/`allNotes`/`withAddenda` prop-drill). The event-source-composition point (trainee work stays in `user_note`, adapted to events client-side) is realized by `workToEvents` over the `useCaseWork` result. Server `case_event`/`case_session`, reveal-on-read, the sim clock, and non-note event kinds are Plan 3, explicitly out of scope here.
- **Placeholder scan:** No TBD / TODO / vague steps; every code step is complete.
- **Type consistency:** `CaseEvent` (Task 1) is consumed by `applyEvents`/`workToEvents` (Task 1) and produced by `workToEvents` for `applyEvents` in `PatientWorkspace` (Task 2). `applyEvents(bundle, events): CaseBundle` and `workToEvents(notes, addenda): CaseEvent[]` signatures match across both tasks. `liveCase` is a `CaseBundle`, valid as `CaseContext.Provider value`.

---

## Notes carried forward to Plan 3 (server engine)

- `applyEvents` currently applies events in array order and the `CaseEvent` union has only note kinds. Plan 3 adds `result.release` / `encounter.append` / `vitals.append` / `flag.set`, a `seq` ordering key, and merges server-revealed events with the adapted work events (sorted by `seq`) before folding.
- The nested Provider now routes every `useCase()` consumer through `liveCase`, so Plan 3's vitals/summary/encounter events reach `SummaryModule`, `VitalsTable`, `VitalsChart`, and the sidebar with no further wiring.
- Equal-timestamp tie-break (carried from Plan 1's final review): before Plan 3 relies on sim-time ordering in the Notes list, check the note-list sort comparator's behaviour when two notes share a `timestamp`.
