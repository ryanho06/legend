# SmartText Templates + Sticky Note Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Epic-style SmartText templates (HP, PROGRESS) inserted from the note editor's "Insert SmartText" field with tabbable `***` wildcard chips, plus sticky-note layout persistence and cleanup.

**Architecture:** Pure template/matcher logic lives in `src/lib/smarttext.ts` (React-free, vitest-tested, per project convention). `NoteEditor.tsx` wires the existing dead toolbar input to a suggestion dropdown, splices template HTML at the saved caret, cycles wildcard chips on Tab, and gates Sign on zero remaining chips. `StickyNotePopup.tsx` persists `{x,y,w,h}` under one global localStorage key.

**Tech Stack:** React 19 + TypeScript + Vite, vitest for `src/lib`, single global stylesheet `src/App.css`.

**Spec:** `docs/superpowers/specs/2026-07-07-smarttext-sticky-design.md`

## Global Constraints

- All styling goes in `src/App.css` (no CSS modules). New rules are appended AFTER existing rules so equal-specificity overrides win.
- `src/lib/` stays pure and React-free; only `src/lib` gets unit tests (there is no React testing setup, so component work is verified by `npx tsc -b` + manual checks in the dev server).
- Dates shown to users are absolute DD/MM/YYYY, never "Today"/relative.
- localStorage keys must start with `legend` so `signOut()` sweeps them (`src/lib/session.ts`); no registration needed.
- `usePersistentState` and any localStorage-backed state must never see its key change mid-life (safe here: all new keys are constants).
- Verify loop: `npx tsc -b` (type-check), `npm test` (vitest), `npm run lint`.
- Commit after each task. Do not push.

---

### Task 1: Sticky note — remove Star/Pop out, bigger default, persist layout

**Files:**
- Modify: `src/components/StickyNotePopup.tsx` (full rewrite below)
- Modify: `src/App.css:1192-1204` (`.sticky-popup` block)

**Interfaces:**
- Consumes: `useCase()` from `src/context/CaseContext`, `usePersistentState` from `src/hooks/usePersistentState` (both unchanged).
- Produces: nothing other tasks rely on. New localStorage key `legend.sticky.layout` holding JSON `{x, y, w, h}`.

**Context for the implementer:** The popup is rendered inside `PatientWorkspace`, which remounts per case. Layout is intentionally GLOBAL (one key, shared across patients): the sticky sits in the same screen spot on every chart; only its text is per-MRN (`legend.sticky.<mrn>`, unchanged). `usePersistentState` is string-only, so the layout uses plain localStorage reads/writes instead: read once on mount, write on drag-end and on resize. The popup keeps CSS `resize: both`; a `ResizeObserver` captures user resizes.

- [ ] **Step 1: Rewrite `src/components/StickyNotePopup.tsx`**

Replace the whole file with:

```tsx
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X } from "lucide-react";
import { useCase } from "../context/CaseContext";
import { usePersistentState } from "../hooks/usePersistentState";

const LAYOUT_KEY = "legend.sticky.layout";
const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 240;

type StickyLayout = { x: number; y: number; w: number; h: number };

/** Keep the popup fully reachable inside the current viewport. */
function clampToViewport(layout: StickyLayout): StickyLayout {
  const w = Math.min(layout.w, window.innerWidth);
  const h = Math.min(layout.h, window.innerHeight);
  return {
    w,
    h,
    x: Math.min(Math.max(0, layout.x), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(0, layout.y), Math.max(0, window.innerHeight - h)),
  };
}

function loadLayout(): StickyLayout {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StickyLayout;
      if ([parsed.x, parsed.y, parsed.w, parsed.h].every(Number.isFinite)) {
        return clampToViewport(parsed);
      }
    }
  } catch {
    // Corrupt stored JSON — fall through to the default placement.
  }
  return clampToViewport({
    x: window.innerWidth - DEFAULT_WIDTH - 60,
    y: 96,
    w: DEFAULT_WIDTH,
    h: DEFAULT_HEIGHT,
  });
}

function saveLayout(layout: StickyLayout) {
  window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function StickyNotePopup({ onClose }: { onClose: () => void }) {
  const { patient } = useCase();
  const [text, setText] = usePersistentState(
    `legend.sticky.${patient.mrn}`,
    patient.stickyNote,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(loadLayout);
  // Mirror for event handlers that must read the latest layout without
  // re-subscribing (drag-end save, ResizeObserver).
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!dragOffset.current) return;
    setLayout((prev) => ({
      ...prev,
      x: event.clientX - dragOffset.current!.dx,
      y: event.clientY - dragOffset.current!.dy,
    }));
  }, []);

  const stopDragging = useCallback(() => {
    if (dragOffset.current) saveLayout(layoutRef.current);
    dragOffset.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [onPointerMove]);

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Don't start a drag when the close button is pressed.
    if ((event.target as HTMLElement).closest("button")) return;
    dragOffset.current = {
      dx: event.clientX - layoutRef.current.x,
      dy: event.clientY - layoutRef.current.y,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
  };

  useEffect(() => stopDragging, [stopDragging]);

  // Capture CSS `resize: both` drags and persist the new size.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === layoutRef.current.w && h === layoutRef.current.h) return;
      const next = { ...layoutRef.current, w, h };
      layoutRef.current = next;
      setLayout(next);
      saveLayout(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="sticky-popup"
      style={{ left: layout.x, top: layout.y, width: layout.w, height: layout.h }}
    >
      <div className="sticky-title" onPointerDown={startDragging}>
        <span>My Sticky Note</span>
        <div className="sticky-actions">
          <button title="Close" onClick={onClose}>
            <X size={13} />
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write a private note for yourself..."
      />
    </div>
  );
}
```

Changes vs the old file: `Star` import and icon gone, "Pop out" button gone, position state replaced by a persisted `{x,y,w,h}` layout, `ResizeObserver` added, inline `width`/`height` now driven by state.

- [ ] **Step 2: Update `.sticky-popup` CSS**

In `src/App.css`, the block at line ~1192 currently sets a fixed default size. Inline styles now drive size, so remove the fixed `width`/`height` lines and keep the constraints:

```css
.sticky-popup {
  position: fixed;
  z-index: 50;
  min-width: 180px;
  min-height: 110px;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: hidden;
```

(Only the `width: 240px;` and `height: 150px;` lines are deleted; everything else in the block stays.)

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc -b` then `npm run lint`
Expected: both exit 0, no output errors. (Lint would catch the now-unused `Star` import if Step 1 missed it.)

- [ ] **Step 4: Manual verify in the dev server**

Run: `npm run dev`, sign in, open a chart, open the sticky note.
Check: no star icon, no "Pop out" button; default size noticeably larger (~340x240); drag it somewhere, resize it, reload the page — position and size persist; open a different patient — same position/size, different text.

- [ ] **Step 5: Commit**

```bash
git add src/components/StickyNotePopup.tsx src/App.css
git commit -m "Sticky note: persist layout, larger default, drop star and pop-out"
```

---

### Task 2: SmartText library (`src/lib/smarttext.ts`) — TDD

**Files:**
- Create: `src/lib/smarttext.ts`
- Test: `src/lib/smarttext.test.ts`

**Interfaces:**
- Consumes: `CasePatient` from `src/types.ts` (fields used: `displayName`, `age`, `sex`, `allergies`, `primaryCare {forename, surname, credential}`).
- Produces (Task 3 relies on these exact names):
  - `type SmartPhrase = { id: string; label: string; description: string; build(patient: CasePatient, admissionDate: string): string }`
  - `SMART_PHRASES: SmartPhrase[]` (ids `"HP"` and `"PROGRESS"`)
  - `matchPhrases(query: string): SmartPhrase[]`
  - Wildcards in built HTML are exactly `<span class="st-wildcard" contenteditable="false">***</span>`.

**Context for the implementer:** The note editor is contentEditable and round-trips `innerHTML`, so `build` returns editor-ready HTML: one `<div>` per line, blank lines as `<div><br></div>`, bold section headers as `<b>`. All patient-derived strings must be HTML-escaped. `HP` follows `references/EMR/epic_smarttext_.FLOORHP8.png`: header, admission date + PCP line, `CC:`, HPI stem ("Bennett, Sandra is a 57yr old female with ***"), then PMH / PSH / Allergies (autofilled) / Medications / Physical Exam / Labs / Assessment / Plan. Everything not in `patient.json` is a wildcard: HP has exactly 9 (CC, HPI, PMH, PSH, Medications, Exam, Labs, Assessment, Plan); PROGRESS has 4 (S/O/A/P).

- [ ] **Step 1: Write the failing test `src/lib/smarttext.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { matchPhrases, SMART_PHRASES } from "./smarttext";
import type { CasePatient } from "../types";

const patient: CasePatient = {
  surname: "Bennett",
  forename: "Sandra",
  displayName: "Bennett, Sandra",
  initials: "SB",
  pronouns: "she/her",
  sex: "Female",
  age: 57,
  dob: "22/09/1968",
  mrn: "LEG-000003",
  location: "AMU Bay 7",
  specialty: "General Medicine",
  attending: {
    forename: "Folake",
    surname: "Adeyemi",
    credential: "MD",
    specialty: "General Medicine",
  },
  primaryCare: {
    forename: "Eleanor",
    surname: "Byrne",
    credential: "MD",
    specialty: "General Practice",
  },
  // Angle brackets on purpose: proves patient data is HTML-escaped.
  allergies: "Aspirin <angioedema & bronchospasm>",
  isolation: "None",
  code: "For escalation",
  acuity: "",
  presentingComplaint: "",
  phone: "",
  infection: "",
  bmi: "31.4",
  stickyNote: "",
};

function wildcardCount(html: string): number {
  return (html.match(/st-wildcard/g) ?? []).length;
}

describe("matchPhrases", () => {
  test("matches ids case-insensitively", () => {
    expect(matchPhrases("hp").map((p) => p.id)).toContain("HP");
    expect(matchPhrases("HP").map((p) => p.id)).toContain("HP");
  });

  test("ignores a leading dot, so trainees can type Epic-style .hp", () => {
    expect(matchPhrases(".hp").map((p) => p.id)).toContain("HP");
  });

  test("matches by substring of id or label", () => {
    expect(matchPhrases("prog").map((p) => p.id)).toEqual(["PROGRESS"]);
    expect(matchPhrases("admission").map((p) => p.id)).toEqual(["HP"]);
  });

  test("empty or whitespace query matches nothing", () => {
    expect(matchPhrases("")).toEqual([]);
    expect(matchPhrases("   ")).toEqual([]);
  });

  test("no-match query returns empty", () => {
    expect(matchPhrases("zzz")).toEqual([]);
  });
});

describe("HP template", () => {
  const hp = SMART_PHRASES.find((p) => p.id === "HP")!;
  const html = hp.build(patient, "01/07/2026");

  test("autofills the demographics stem", () => {
    expect(html).toContain("Bennett, Sandra is a 57yr old female with ");
  });

  test("autofills admission date and PCP", () => {
    expect(html).toContain("Admission Date: 01/07/2026");
    expect(html).toContain("Byrne, Eleanor, MD");
  });

  test("autofills allergies, HTML-escaped", () => {
    expect(html).toContain("Aspirin &lt;angioedema &amp; bronchospasm&gt;");
    expect(html).not.toContain("<angioedema");
  });

  test("has exactly 9 wildcard chips, all non-editable", () => {
    expect(wildcardCount(html)).toBe(9);
    expect(
      (html.match(/<span class="st-wildcard" contenteditable="false">\*\*\*<\/span>/g) ?? [])
        .length,
    ).toBe(9);
  });

  test("has the chart-review section headers", () => {
    for (const header of [
      "HISTORY OF PRESENT ILLNESS:",
      "PAST MEDICAL HISTORY:",
      "PAST SURGICAL HISTORY:",
      "ALLERGIES:",
      "MEDICATIONS:",
      "PHYSICAL EXAM:",
      "LABS:",
      "ASSESSMENT:",
      "PLAN:",
    ]) {
      expect(html).toContain(header);
    }
  });
});

describe("PROGRESS template", () => {
  const progress = SMART_PHRASES.find((p) => p.id === "PROGRESS")!;
  const html = progress.build(patient, "01/07/2026");

  test("has the SOAP skeleton with 4 wildcards", () => {
    expect(wildcardCount(html)).toBe(4);
    for (const header of ["Subjective:", "Objective:", "Assessment:", "Plan:"]) {
      expect(html).toContain(header);
    }
  });

  test("stems with the patient name and admission date", () => {
    expect(html).toContain("Bennett, Sandra");
    expect(html).toContain("01/07/2026");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/smarttext.test.ts`
Expected: FAIL — cannot resolve `./smarttext`.

- [ ] **Step 3: Implement `src/lib/smarttext.ts`**

```ts
import type { CasePatient } from "../types";

/**
 * SmartText phrases: Epic-style note templates inserted from the editor's
 * "Insert SmartText" field. `build` returns editor-ready HTML (one <div> per
 * line) with demographics autofilled from the case and `***` wildcard chips
 * for everything the trainee must complete from chart review.
 */
export type SmartPhrase = {
  /** SmartText name shown bold in the picker, e.g. "HP". */
  id: string;
  label: string;
  description: string;
  build: (patient: CasePatient, admissionDate: string) => string;
};

/** Inline chip for an unfilled field; NoteEditor Tab-cycles and replaces these. */
const WILDCARD = '<span class="st-wildcard" contenteditable="false">***</span>';

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function line(html: string): string {
  return `<div>${html}</div>`;
}

const BLANK = "<div><br></div>";

function heading(text: string): string {
  return line(`<b>${text}</b>`);
}

/** A bold header followed by a single wildcard line. */
function section(title: string): string {
  return heading(title) + line(WILDCARD);
}

/** "Byrne, Eleanor, MD" — the reference image's PCP format (no uppercasing). */
function careTeamName(member: CasePatient["primaryCare"]): string {
  return `${member.surname}, ${member.forename}, ${member.credential}`;
}

export const SMART_PHRASES: SmartPhrase[] = [
  {
    id: "HP",
    label: "Admission H&P",
    description: "History & physical shell with demographics filled in",
    build: (patient, admissionDate) =>
      [
        heading("ADMISSION H&amp;P"),
        line(
          `Admission Date: ${escapeHtml(admissionDate)} - PCP: ${escapeHtml(
            careTeamName(patient.primaryCare),
          )}`,
        ),
        BLANK,
        line(`CC: ${WILDCARD}`),
        BLANK,
        heading("HISTORY OF PRESENT ILLNESS:"),
        line(
          `${escapeHtml(patient.displayName)} is a ${patient.age}yr old ` +
            `${escapeHtml(patient.sex.toLowerCase())} with ${WILDCARD}`,
        ),
        BLANK,
        section("PAST MEDICAL HISTORY:"),
        BLANK,
        section("PAST SURGICAL HISTORY:"),
        BLANK,
        heading("ALLERGIES:"),
        line(escapeHtml(patient.allergies)),
        BLANK,
        section("MEDICATIONS:"),
        BLANK,
        section("PHYSICAL EXAM:"),
        BLANK,
        section("LABS:"),
        BLANK,
        section("ASSESSMENT:"),
        BLANK,
        section("PLAN:"),
      ].join(""),
  },
  {
    id: "PROGRESS",
    label: "Progress Note (SOAP)",
    description: "Ward-round SOAP skeleton",
    build: (patient, admissionDate) =>
      [
        heading("PROGRESS NOTE"),
        line(
          `${escapeHtml(patient.displayName)} - admitted ${escapeHtml(admissionDate)}`,
        ),
        BLANK,
        section("Subjective:"),
        BLANK,
        section("Objective:"),
        BLANK,
        section("Assessment:"),
        BLANK,
        section("Plan:"),
      ].join(""),
  },
];

/**
 * Case-insensitive substring match on phrase id and label. A leading dot is
 * ignored so Epic-trained fingers typing ".hp" still resolve. Empty query
 * matches nothing (the dropdown only opens once the trainee types).
 */
export function matchPhrases(query: string): SmartPhrase[] {
  const q = query.trim().replace(/^\.+/, "").toLowerCase();
  if (!q) return [];
  return SMART_PHRASES.filter(
    (phrase) =>
      phrase.id.toLowerCase().includes(q) || phrase.label.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/smarttext.test.ts`
Expected: PASS, all tests green. Then run the whole suite: `npm test` — everything else still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/smarttext.ts src/lib/smarttext.test.ts
git commit -m "SmartText lib: HP and PROGRESS templates with wildcard chips, fuzzy matcher"
```

---

### Task 3: Editor integration — suggestion dropdown, chip Tab-cycling, Sign gate

**Files:**
- Modify: `src/components/notes/NoteEditor.tsx`
- Modify: `src/App.css` (replace `.note-editor-smarttext` block at ~1124, append new rules)

**Interfaces:**
- Consumes: `SMART_PHRASES` is NOT imported directly; only `matchPhrases(query)` and `type SmartPhrase` from `src/lib/smarttext` (Task 2). Also `useCase()` from `src/context/CaseContext` — `NoteEditor` always renders inside `PatientWorkspace`'s `CaseContext.Provider`, so this is safe. Uses `patient` and `encounters` (admission date = `encounters.find((e) => e.admission)?.date ?? ""`).
- Produces: nothing downstream. Behavior contract: signed notes can never contain `.st-wildcard` spans (Sign disabled while any remain), so `lib/rubric.ts` and `lib/noteText.ts` are untouched.

**Context for the implementer:** `NoteEditor.tsx` (read it fully first) is a contentEditable editor that seeds `innerHTML` once on mount and pushes `innerHTML` out via `pushChange()`. It already maintains `savedRange` (the last real caret/selection) so toolbar controls that steal focus can still act on the editor — the SmartText input reuses exactly that mechanism. There is a dead `<input className="note-editor-smarttext" placeholder="Insert SmartText" />` at line ~227 to replace.

- [ ] **Step 1: Wire state and helpers into `NoteEditor.tsx`**

Add imports at the top:

```tsx
import { useCase } from "../../context/CaseContext";
import { matchPhrases, type SmartPhrase } from "../../lib/smarttext";
```

Inside the component, after the existing `useState` declarations (`words` etc.), add:

```tsx
const { patient, encounters } = useCase();
const [stQuery, setStQuery] = useState("");
const [stIndex, setStIndex] = useState(0);
const [wildcards, setWildcards] = useState(0);
const stMatches = matchPhrases(stQuery);
```

Extend `pushChange` to track remaining chips (add one line before the closing brace):

```tsx
function pushChange() {
  const el = editorRef.current;
  if (!el) return;
  onChange(el.innerHTML);
  setWords(countWords(el.textContent ?? ""));
  setWildcards(el.querySelectorAll(".st-wildcard").length);
}
```

Extend the mount-seeding effect the same way (a pended draft reopened with chips must re-disable Sign):

```tsx
useEffect(() => {
  const el = editorRef.current;
  if (!el) return;
  el.innerHTML = value;
  setWords(countWords(el.textContent ?? ""));
  setWildcards(el.querySelectorAll(".st-wildcard").length);
  // Seed once on mount; the value prop is intentionally not a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 2: Add chip selection, chip search, and insertion functions**

Add these three functions inside the component (near `applyFontSize`):

```tsx
// Select a whole wildcard chip so the next keystroke replaces it outright.
function selectChip(chip: Element) {
  const el = editorRef.current;
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNode(chip);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  savedRange.current = range.cloneRange();
  (chip as HTMLElement).scrollIntoView({ block: "nearest" });
}

/** The next/previous wildcard chip from the caret, wrapping around. */
function findChip(forward: boolean): Element | null {
  const el = editorRef.current;
  if (!el) return null;
  const chips = Array.from(el.querySelectorAll(".st-wildcard"));
  if (chips.length === 0) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
    return forward ? chips[0] : chips[chips.length - 1];
  }
  const caret = sel.getRangeAt(0);
  const isAfterCaret = (chip: Element) => {
    const range = document.createRange();
    range.selectNode(chip);
    return range.compareBoundaryPoints(Range.START_TO_START, caret) > 0;
  };
  if (forward) return chips.find(isAfterCaret) ?? chips[0];
  // Backward: last chip before the caret, excluding a currently selected chip.
  const before = chips.filter(
    (chip) => !isAfterCaret(chip) && !caret.intersectsNode(chip),
  );
  return before[before.length - 1] ?? chips[chips.length - 1];
}

// Splice the template at the last saved caret (end of note if none), then
// jump to its first wildcard so the trainee starts filling immediately.
function insertPhrase(phrase: SmartPhrase) {
  const el = editorRef.current;
  if (!el) return;
  const admissionDate = encounters.find((e) => e.admission)?.date ?? "";
  const html = phrase.build(patient, admissionDate);
  let range = savedRange.current;
  if (!range || !el.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();
  const fragment = document.createRange().createContextualFragment(html);
  const firstChip = fragment.querySelector(".st-wildcard");
  range.insertNode(fragment);
  setStQuery("");
  setStIndex(0);
  if (firstChip) {
    selectChip(firstChip);
  } else {
    el.focus();
  }
  pushChange();
}
```

- [ ] **Step 3: Tab-cycle chips and click-to-select in the editor**

In `handleKeyDown`, add Tab handling BEFORE the existing Ctrl/Cmd block:

```tsx
function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key === "Tab") {
    const chip = findChip(!event.shiftKey);
    if (chip) {
      event.preventDefault();
      selectChip(chip);
      return;
    }
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    // ... existing bold/italic/underline block unchanged ...
  }
}
```

(With no chips in the note, Tab falls through to default behavior — the spec requires this.)

On the editor `<div>` (the one with `className="note-editor-textarea"`), add a click handler so clicking a chip selects it wholesale:

```tsx
onClick={(event) => {
  const chip = (event.target as HTMLElement).closest(".st-wildcard");
  if (chip) selectChip(chip);
}}
```

- [ ] **Step 4: Replace the dead SmartText input with the live picker**

Replace `<input className="note-editor-smarttext" placeholder="Insert SmartText" />` with:

```tsx
<div className="note-editor-smarttext-wrap">
  <input
    className="note-editor-smarttext"
    placeholder="Insert SmartText"
    aria-label="Insert SmartText"
    value={stQuery}
    onChange={(event) => {
      setStQuery(event.target.value);
      setStIndex(0);
    }}
    onKeyDown={(event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setStIndex((i) => Math.min(i + 1, stMatches.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setStIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter" && stMatches[stIndex]) {
        event.preventDefault();
        insertPhrase(stMatches[stIndex]);
      } else if (event.key === "Escape") {
        setStQuery("");
        setStIndex(0);
      }
    }}
  />
  {stMatches.length > 0 && (
    <ul className="st-suggest" role="listbox">
      {stMatches.map((phrase, index) => (
        <li key={phrase.id}>
          <button
            role="option"
            aria-selected={index === stIndex}
            className={index === stIndex ? "active" : undefined}
            // Keep the editor's saved caret; don't move focus on click.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertPhrase(phrase)}
          >
            <b>{phrase.id}</b>
            <span>{phrase.label}</span>
          </button>
        </li>
      ))}
    </ul>
  )}
</div>
```

- [ ] **Step 5: Gate Sign on remaining wildcards**

Replace the Sign button at the bottom of the component:

```tsx
<button
  className="green-button"
  onClick={onSign}
  disabled={words === 0 || wildcards > 0}
  title={wildcards > 0 ? "Complete all *** fields before signing" : undefined}
>
  <CheckCircle2 size={13} />
  Sign
</button>
```

(Pend stays exactly as is — pending with wildcards outstanding is allowed, matching Epic.)

- [ ] **Step 6: CSS — picker dropdown and wildcard chips**

In `src/App.css`, replace the `.note-editor-smarttext` block (line ~1124) with (the wrap takes over the input's flex role):

```css
.note-editor-smarttext-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
}

.note-editor-smarttext {
  width: 100%;
  height: 20px;
  border: 1px solid #95a17f;
  padding: 0 6px;
}

.st-suggest {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
  z-index: 40;
  margin: 0;
  padding: 0;
  list-style: none;
  background: #fff;
  border: 1px solid #899873;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
}

/* Beat the generic .note-editor-format button pill styling. */
.st-suggest button {
  display: flex;
  gap: 8px;
  width: 100%;
  height: auto;
  border: none;
  background: none;
  padding: 4px 8px;
  cursor: pointer;
  text-align: left;
}

.st-suggest button.active,
.st-suggest button:hover {
  background: #cfe3f5;
}

/* Unfilled template field: the pink boxed *** chip from the Epic reference. */
.st-wildcard {
  display: inline-block;
  background: #f6c8e5;
  border: 1px solid #c98ab2;
  border-radius: 2px;
  padding: 0 3px;
  margin: 0 1px;
  font-weight: bold;
  line-height: 1.2;
  cursor: pointer;
}
```

Append the `.st-suggest` / `.st-wildcard` rules AFTER the existing `.note-editor-format button` rule (line ~485) in file order — they are equal specificity and must win. (Anywhere at/after line ~1124 satisfies this.)

- [ ] **Step 7: Type-check, test, lint**

Run: `npx tsc -b && npm test && npm run lint`
Expected: all pass.

- [ ] **Step 8: Manual verify in the dev server**

Run: `npm run dev`, sign in, open a chart, open a new note draft. Check each:

1. Type `hp` in the Insert SmartText field: dropdown shows **HP** Admission H&P; `.hp` and `HP` also match. Escape clears it.
2. Enter inserts the template at the caret; the first `***` chip is selected (pink, highlighted); demographics/allergies/PCP/admission date are correct for the patient (DD/MM/YYYY).
3. Typing replaces the selected chip wholesale; Tab jumps to the next chip; Shift+Tab goes back; cycling wraps.
4. Clicking a chip selects it; a selected chip can be deleted with Backspace.
5. Sign is disabled with hover title "Complete all *** fields before signing" while any chip remains; Pend still works. Resolve every chip: Sign enables; sign and confirm the Performance dock scores the note normally.
6. Pend a draft with chips remaining, reopen it: chips still render and Sign is still disabled.
7. Insert `PROGRESS` into an empty note: SOAP skeleton with 4 chips.
8. Known-risk watch (spec "Known risk"): caret behavior around the non-editable chips — arrow keys move past chips without getting stuck, and typing with a chip selected replaces it in Chrome. If chips misbehave, STOP and flag it (the spec's fallback is editable spans selected on Tab) rather than patching ad hoc.

- [ ] **Step 9: Commit**

```bash
git add src/components/notes/NoteEditor.tsx src/App.css
git commit -m "Note editor: SmartText picker, tabbable wildcard chips, Sign gate"
```
