# Edit & Addendum for Self-Authored Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doctor-ID-based note ownership; Edit reopens your pended notes in the editor; Addendum appends stamped blocks to your signed notes (including static persona notes like cholangitis001's Mensah notes).

**Architecture:** Identity = `d######` doctor IDs (`UserProfile.hcpId`, `ClinicalNote.authorId`, per-case `playerHcpId` persona binding). Ownership and note-building logic is pure in `src/lib/userNotes.ts`; chip-aware plain-text-to-editor-HTML conversion in `src/lib/smarttext.ts`; addenda live in a per-case localStorage overlay merged at display time in `PatientWorkspace`; NotePreview's dead Addendum button becomes Edit/Addendum following the existing onDelete callback pattern.

**Tech Stack:** React 19 + TypeScript + Vite, vitest for `src/lib`, single stylesheet `src/App.css`.

**Spec:** `docs/superpowers/specs/2026-07-07-edit-addendum-design.md`

## Global Constraints

- All styling in `src/App.css`, new rules appended after existing ones.
- `src/lib/` stays pure and React-free; only `src/lib` gets unit tests. Component work is verified by `npx tsc -b` + `npm run lint` (browser verification happens centrally after all tasks).
- localStorage keys start with `legend` (auto-swept by `signOut()`); constant keys only.
- Doctor ID format: `d` + 6 digits. Runtime-generated users get `d9#####`; authored case staff use `d0#####`-`d8#####`.
- Addendum stamp format: `DD/MM/YYYY HH:MM` (full year — differs from `formatStamp`'s `DD/MM HH:MM`, which stays unchanged for note filing stamps).
- **`src/data/patients/index.ts` is user-modified and uncommitted (in-progress case work). You may EDIT it where a task says so, but NEVER `git add`/commit it — the edit rides along with the user's future case-work commit.** Same for all `src/data/patients/<new-case>/` folders: never stage them.
- Verify loop: `npx tsc -b`, `npm test`, `npm run lint`. Commit after each task; never push.

---

### Task 1: Identity + pure logic (types, lib, sign-in) — TDD for lib

**Files:**
- Modify: `src/types.ts` (UserProfile ~line 201, ClinicalNote ~line 102, NoteDraft ~line 207, CaseBundle ~line 372)
- Modify: `src/lib/session.ts`
- Modify: `src/lib/userNotes.ts`
- Modify: `src/lib/smarttext.ts`
- Modify: `src/components/SignInPage.tsx`
- Modify: `src/App.tsx` (parseUser, ~line 15)
- Test: `src/lib/userNotes.test.ts` (append new describes), `src/lib/smarttext.test.ts` (append)

**Interfaces:**
- Consumes: existing `formatStamp`, `buildUserNote`, `WILDCARD`/`escapeHtml` internals of smarttext.
- Produces (later tasks rely on exact names):
  - `UserProfile = { forename: string; surname: string; hcpId: string }`
  - `ClinicalNote.authorId?: string`, `NoteDraft.mode?: "edit" | "addendum"`, `NoteDraft.targetNoteId?: string`, `CaseBundle.playerHcpId?: string`
  - `addendaKey(caseId: string): string` in session.ts
  - In userNotes.ts: `generateHcpId(): string`, `isOwnNote(note: ClinicalNote, userHcpId: string, playerHcpId?: string): boolean`, `buildAddendumBlock(user: UserProfile, text: string, now: Date): string`, `appendAddendum(existing: string | undefined, block: string): string`, `refileUserNote(original: ClinicalNote, draft: NoteDraft, plainBody: string, status: NoteStatus, now: Date): ClinicalNote`
  - In smarttext.ts: `plainTextToEditorHtml(text: string): string`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/userNotes.test.ts` (reuse that file's existing fixtures/imports where present; add missing imports):

```ts
import {
  appendAddendum,
  buildAddendumBlock,
  buildUserNote,
  generateHcpId,
  isOwnNote,
  refileUserNote,
} from "./userNotes";
import type { ClinicalNote, NoteDraft, UserProfile } from "../types";

const testUser: UserProfile = { forename: "Jordan", surname: "Lee", hcpId: "d912345" };

const baseNote: ClinicalNote = {
  kind: "note",
  id: "note-prog-003",
  encounterId: "enc-admission",
  category: "Progress",
  noteType: "Gastroenterology Progress",
  author: "Mensah, Daniel",
  credential: "MD",
  authorRole: "*PHYSICIAN: RESIDENT",
  service: "(A) Gastroenterology",
  dateOfService: "Today 13:10",
  fileTime: "Today 13:24",
  timestamp: 1781529000,
  status: "cosign",
  body: "PROGRESS NOTE BODY",
};

describe("generateHcpId", () => {
  test("is a d9-prefixed six-digit doctor id", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateHcpId()).toMatch(/^d9\d{5}$/);
    }
  });
});

describe("isOwnNote", () => {
  test("matches the login's doctor id", () => {
    expect(isOwnNote({ ...baseNote, authorId: "d912345" }, "d912345")).toBe(true);
  });

  test("matches the case's player persona id", () => {
    expect(isOwnNote({ ...baseNote, authorId: "d284617" }, "d912345", "d284617")).toBe(true);
  });

  test("rejects other authors and notes without an authorId", () => {
    expect(isOwnNote({ ...baseNote, authorId: "d000001" }, "d912345", "d284617")).toBe(false);
    expect(isOwnNote(baseNote, "d912345", "d284617")).toBe(false);
  });

  test("user-note- prefix is a backstop for pre-ID stored notes", () => {
    expect(isOwnNote({ ...baseNote, id: "user-note-1-draft-1" }, "d912345")).toBe(true);
  });
});

describe("buildAddendumBlock / appendAddendum", () => {
  const now = new Date(2026, 6, 7, 9, 5); // 07/07/2026 09:05

  test("stamps author and full date", () => {
    expect(buildAddendumBlock(testUser, "Seen again post ERCP.", now)).toBe(
      "ADDENDUM — Lee, Jordan, MS — 07/07/2026 09:05:\nSeen again post ERCP.",
    );
  });

  test("appendAddendum stacks blocks with a blank line", () => {
    const first = buildAddendumBlock(testUser, "One.", now);
    const second = buildAddendumBlock(testUser, "Two.", now);
    expect(appendAddendum(undefined, first)).toBe(first);
    expect(appendAddendum(first, second)).toBe(`${first}\n\n${second}`);
  });
});

describe("refileUserNote", () => {
  const draft: NoteDraft = {
    id: "draft-9",
    noteType: "H&P",
    service: "(A) Gastroenterology",
    body: "<div>ignored, plainBody wins</div>",
    mode: "edit",
    targetNoteId: "user-note-5-draft-2",
  };
  const original: ClinicalNote = {
    ...baseNote,
    id: "user-note-5-draft-2",
    author: "Lee, Jordan",
    credential: "MS",
    authorRole: "*MEDICAL STUDENT",
    authorId: "d912345",
    status: "incomplete",
    fileTime: "—",
  };
  const now = new Date(2026, 6, 7, 10, 30);

  test("keeps identity, replaces content and stamps", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "signed", now);
    expect(refiled.id).toBe(original.id);
    expect(refiled.author).toBe("Lee, Jordan");
    expect(refiled.authorId).toBe("d912345");
    expect(refiled.body).toBe("NEW BODY");
    expect(refiled.status).toBe("signed");
    expect(refiled.noteType).toBe("H&P");
    expect(refiled.category).toBe("H&P");
    expect(refiled.timestamp).toBe(Math.floor(now.getTime() / 1000));
    expect(refiled.dateOfService).toBe("07/07 10:30");
    expect(refiled.fileTime).toBe("07/07 10:30");
  });

  test("pending again leaves fileTime em-dashed", () => {
    const refiled = refileUserNote(original, draft, "NEW BODY", "incomplete", now);
    expect(refiled.fileTime).toBe("—");
  });
});

describe("buildUserNote authorId", () => {
  test("stamps the login's doctor id", () => {
    const draft: NoteDraft = { id: "draft-1", noteType: "Progress Note", service: "(A) GS", body: "" };
    const note = buildUserNote(draft, testUser, "text", "signed", new Date(2026, 6, 7));
    expect(note.authorId).toBe("d912345");
  });
});
```

Append to `src/lib/smarttext.test.ts`:

```ts
import { plainTextToEditorHtml } from "./smarttext";

describe("plainTextToEditorHtml", () => {
  test("wraps lines in divs and blank lines as <div><br></div>", () => {
    expect(plainTextToEditorHtml("One\n\nTwo")).toBe(
      "<div>One</div><div><br></div><div>Two</div>",
    );
  });

  test("escapes HTML in the stored text", () => {
    expect(plainTextToEditorHtml("a <b> & c")).toBe("<div>a &lt;b&gt; &amp; c</div>");
  });

  test("reconstitutes *** into wildcard chips so the Sign gate survives", () => {
    const html = plainTextToEditorHtml("CC: ***");
    expect(html).toBe(
      '<div>CC: <span class="st-wildcard" contenteditable="false">***</span></div>',
    );
  });

  test("multiple wildcards on one line each become chips", () => {
    expect(
      (plainTextToEditorHtml("*** and ***").match(/st-wildcard/g) ?? []).length,
    ).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/userNotes.test.ts src/lib/smarttext.test.ts`
Expected: FAIL — `generateHcpId` etc. not exported, `plainTextToEditorHtml` not exported, `hcpId` missing on UserProfile (type error).

- [ ] **Step 3: Implement the type changes in `src/types.ts`**

Note: `hcpId` becomes REQUIRED on `UserProfile`. If the existing `src/lib/userNotes.test.ts` already has a `UserProfile` fixture, add `hcpId: "d912345"` to it (and to any other UserProfile literal the compiler flags), or `npx tsc -b` will fail.

`UserProfile` (~line 201):

```ts
export type UserProfile = {
  forename: string;
  surname: string;
  /** Synthetic doctor ID, e.g. "d912345". d9##### = runtime-generated logins;
   * authored case staff use d0#####-d8##### so they can never collide. */
  hcpId: string;
};
```

`ClinicalNote` — add after `status` (~line 97):

```ts
  /** Doctor ID of the author; ownership compares this to the login/persona. */
  authorId?: string;
```

`NoteDraft` (~line 207):

```ts
export type NoteDraft = {
  id: string;
  noteType: string;
  service: string;
  body: string;
  /** "edit" reopens an incomplete user note; "addendum" appends to a signed one. */
  mode?: "edit" | "addendum";
  /** The stored note an edit/addendum draft targets. */
  targetNoteId?: string;
};
```

`CaseBundle` — add after `handoff` (~line 378):

```ts
  /** Doctor ID of the simulated persona the trainee plays in this case, if any. */
  playerHcpId?: string;
```

- [ ] **Step 4: Implement lib changes**

`src/lib/session.ts` — add after `userNotesKey`:

```ts
export const addendaKey = (caseId: string) => `legend-addenda-${caseId}`;
```

`src/lib/userNotes.ts` — add `authorId: user.hcpId,` to the object returned by `buildUserNote` (after `author`), then append:

```ts
/** Random runtime doctor ID; the d9 range is reserved for generated logins. */
export function generateHcpId(): string {
  return `d9${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
}

/**
 * A note is yours if its authorId matches your login or the persona this case
 * assigns you. The user-note- prefix is a backstop for notes stored before
 * doctor IDs existed.
 */
export function isOwnNote(
  note: ClinicalNote,
  userHcpId: string,
  playerHcpId?: string,
): boolean {
  if (note.id.startsWith("user-note-")) return true;
  if (!note.authorId) return false;
  return note.authorId === userHcpId || note.authorId === playerHcpId;
}

/** Stamped addendum block, matching the static attestation style in case data. */
export function buildAddendumBlock(user: UserProfile, text: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `ADDENDUM — ${user.surname.trim()}, ${user.forename.trim()}, MS — ${stamp}:\n${text}`;
}

export function appendAddendum(existing: string | undefined, block: string): string {
  return existing ? `${existing}\n\n${block}` : block;
}

/** Re-file an edited incomplete user note in place: same identity, new content. */
export function refileUserNote(
  original: ClinicalNote,
  draft: NoteDraft,
  plainBody: string,
  status: NoteStatus,
  now: Date,
): ClinicalNote {
  const stamp = formatStamp(now);
  return {
    ...original,
    noteType: draft.noteType,
    category: CATEGORY_BY_TYPE[draft.noteType] ?? original.category,
    body: plainBody,
    status,
    timestamp: Math.floor(now.getTime() / 1000),
    dateOfService: stamp,
    fileTime: status === "signed" ? stamp : "—",
  };
}
```

`src/lib/smarttext.ts` — append (it uses the file's private `escapeHtml` and `WILDCARD`):

```ts
/**
 * Editor HTML from stored plain text: escaped lines in <div>s, blank lines as
 * <div><br></div>, and literal *** reconstituted into wildcard chips so the
 * Sign gate survives a pend -> edit round trip.
 */
export function plainTextToEditorHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return BLANK;
      return `<div>${escapeHtml(line).replace(/\*\*\*/g, WILDCARD)}</div>`;
    })
    .join("");
}
```

- [ ] **Step 5: Identity plumbing (the two UserProfile construction/parse sites)**

`src/components/SignInPage.tsx` — import `generateHcpId` from `../lib/userNotes`; in `submit`:

```tsx
onComplete({
  forename: forename.trim(),
  surname: surname.trim(),
  hcpId: generateHcpId(),
});
```

`src/App.tsx` — `parseUser` also requires the ID, so pre-ID stored profiles simply re-gate to sign-in (demo-acceptable; their stored notes stay owned via the prefix backstop):

```ts
function parseUser(raw: string): UserProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    return typeof parsed.forename === "string" &&
      typeof parsed.surname === "string" &&
      typeof parsed.hcpId === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/userNotes.test.ts src/lib/smarttext.test.ts`
Expected: PASS. Then the full loop: `npx tsc -b && npm test && npm run lint` — all clean.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/lib/session.ts src/lib/userNotes.ts src/lib/smarttext.ts src/lib/userNotes.test.ts src/lib/smarttext.test.ts src/components/SignInPage.tsx src/App.tsx
git commit -m "Doctor IDs: hcpId on login, authorId on notes, ownership + addendum + refile helpers"
```

---

### Task 2: Case data + authoring docs

**Files:**
- Modify: `src/data/patients/cholangitis001/documents.ts` (4 notes)
- Modify: `src/data/patients/index.ts` (cholangitis001 entry) — **EDIT ONLY, DO NOT COMMIT** (user-modified file, see Global Constraints)
- Modify: `CASE_AUTHORING.md`

**Interfaces:**
- Consumes: `ClinicalNote.authorId` and `CaseBundle.playerHcpId` from Task 1.
- Produces: cholangitis001 has a playable persona (`d284617`, Mensah, Daniel) whose four notes carry `authorId`.

- [ ] **Step 1: Stamp Mensah's notes**

In `src/data/patients/cholangitis001/documents.ts`, exactly four documents have `author: "Mensah, Daniel"` (ids `note-prog-003`, `note-proc-002`, `note-prog-004`, `note-dc-001` — all `kind: "note"`). Add to each, on the line after `credential: "MD",`:

```ts
    authorId: "d284617",
```

- [ ] **Step 2: Bind the persona in the registry**

In `src/data/patients/index.ts`, find the `id: "cholangitis001"` entry and add one line after its `handoff`:

```ts
    playerHcpId: "d284617",
```

Do NOT stage or commit this file.

- [ ] **Step 3: Document the contract**

In `CASE_AUTHORING.md`, add a short subsection to the documents/authoring section (match the file's existing tone and heading level):

```markdown
### Doctor IDs and the player persona

Staff can carry a synthetic doctor ID (`d` + 6 digits, ranges d0-d8; d9 is
reserved for runtime-generated logins). Give a note an `authorId` to make it
attributable to a person. To let the trainee play a specific clinician in a
case (their notes become addendable as "yours"), set that clinician's ID as
`playerHcpId` on the case's registry entry in `src/data/patients/index.ts`.
Notes without an `authorId` are ownable by nobody. Example: cholangitis001
sets `playerHcpId: "d284617"` (Mensah, Daniel) and stamps his four notes.
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm test && npm run lint`
Expected: all clean (data-only change; the type system validates the new fields).

- [ ] **Step 5: Commit (excluding index.ts)**

```bash
git add src/data/patients/cholangitis001/documents.ts CASE_AUTHORING.md
git commit -m "cholangitis001: Mensah gets doctor ID d284617; document the persona contract"
git status --short src/data/patients/index.ts   # must still show M — verify it was NOT committed
```

---

### Task 3: UI wiring — Edit/Addendum buttons, editor modes, overlay merge

**Files:**
- Modify: `src/components/chart/NotePreview.tsx`
- Modify: `src/components/chart/NotesBrowser.tsx` (~lines 63-71 props, ~line 266 NotePreview usage)
- Modify: `src/components/chart/ChartReview.tsx` (~lines 37-47 props, ~line 131 NotesBrowser usage)
- Modify: `src/components/PatientWorkspace.tsx`
- Modify: `src/components/notes/NoteEditor.tsx`, `src/components/notes/NoteEditorPanel.tsx`
- Modify: `src/components/wrapup/WrapUpModule.tsx` (~line 44)
- Modify: `src/App.css` (append one rule)

**Interfaces:**
- Consumes (exact, from Task 1): `isOwnNote(note, userHcpId, playerHcpId?)`, `buildAddendumBlock(user, text, now)`, `appendAddendum(existing, block)`, `refileUserNote(original, draft, plainBody, status, now)` from `../lib/userNotes`; `plainTextToEditorHtml(text)` from `../lib/smarttext`; `addendaKey(caseId)` from `../lib/session`; `NoteDraft.mode`/`targetNoteId`; `CaseBundle.playerHcpId`; `user.hcpId`.
- Produces: end-user behavior only.

- [ ] **Step 1: PatientWorkspace — addenda overlay + open/finish logic**

Add module-level next to `parseUserNotes`:

```tsx
function parseAddenda(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
```

Extend imports:

```tsx
import { addendaKey, userNotesKey } from "../lib/session";
import {
  appendAddendum,
  buildAddendumBlock,
  buildUserNote,
  isOwnNote,
  refileUserNote,
} from "../lib/userNotes";
import { plainTextToEditorHtml } from "../lib/smarttext";
import type { CaseUiState, ClinicalNote, Note, NoteStatus, UserProfile } from "../types";
```

Inside the component, after the `storedUserNotes` state:

```tsx
const [storedAddenda, setStoredAddenda] = usePersistentState(
  addendaKey(activeCase.id),
  "{}",
);
const addenda = parseAddenda(storedAddenda);
```

Replace the merge block (`allDocuments`/`allNotes`, ~lines 78-80):

```tsx
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

Add the ownership closure and the two open functions (near `openNewNote`, which stays unchanged):

```tsx
const ownNote = (note: Note) => isOwnNote(note, user.hcpId, activeCase.playerHcpId);

// Reopen an incomplete user note as an editor draft; Sign/Pend re-files it in
// place. Focuses the existing tab if one is already open for this note.
function openEditDraft(note: Note) {
  const existing = editors.find((d) => d.mode === "edit" && d.targetNoteId === note.id);
  if (existing) {
    onPatch({ activeEditorId: existing.id });
    rightRef.current?.expand();
    return;
  }
  draftSeq += 1;
  const draft = {
    id: `draft-${draftSeq}`,
    noteType: note.noteType,
    service: note.service,
    body: plainTextToEditorHtml(note.body),
    mode: "edit" as const,
    targetNoteId: note.id,
  };
  onPatch({ editors: [...editors, draft], activeEditorId: draft.id });
  rightRef.current?.expand();
}

// Open an empty addendum draft targeting a signed note you own.
function openAddendumDraft(note: Note) {
  const existing = editors.find(
    (d) => d.mode === "addendum" && d.targetNoteId === note.id,
  );
  if (existing) {
    onPatch({ activeEditorId: existing.id });
    rightRef.current?.expand();
    return;
  }
  draftSeq += 1;
  const draft = {
    id: `draft-${draftSeq}`,
    noteType: "Addendum",
    service: note.service,
    body: "",
    mode: "addendum" as const,
    targetNoteId: note.id,
  };
  onPatch({ editors: [...editors, draft], activeEditorId: draft.id });
  rightRef.current?.expand();
}
```

Replace `finishDraft` entirely:

```tsx
// Sign publishes the draft (or appends its addendum); Pend files it as an
// incomplete note. Edit drafts re-file their target in place; a deleted
// target degrades to filing as a new note. All paths remove the draft tab.
function finishDraft(id: string, status: NoteStatus) {
  const draft = editors.find((d) => d.id === id);
  if (!draft) return;
  const text = htmlToPlainText(draft.body);
  if (wordCount(text) === 0) return;
  const remaining = editors.filter((d) => d.id !== id);

  if (draft.mode === "addendum" && draft.targetNoteId) {
    const block = buildAddendumBlock(user, text, new Date());
    setStoredAddenda(
      JSON.stringify({
        ...addenda,
        [draft.targetNoteId]: appendAddendum(addenda[draft.targetNoteId], block),
      }),
    );
    onPatch({ editors: remaining });
    return;
  }

  const target =
    draft.mode === "edit" && draft.targetNoteId
      ? userNotes.find((n) => n.id === draft.targetNoteId)
      : undefined;
  const note = target
    ? refileUserNote(target, draft, text, status, new Date())
    : buildUserNote(draft, user, text, status, new Date());
  const nextNotes = target
    ? userNotes.map((n) => (n.id === target.id ? note : n))
    : [...userNotes, note];
  setStoredUserNotes(JSON.stringify(nextNotes));
  if (status === "signed") {
    saveWrapupAttempt(activeCase.id, text);
    onPatch({ editors: remaining, wrapupOpen: true });
  } else {
    onPatch({ editors: remaining });
  }
}
```

Thread the new props into both module usages (ChartReview ~line 182 and NotesBrowser ~line 198):

```tsx
onEditNote={openEditDraft}
onAddendumNote={openAddendumDraft}
ownNote={ownNote}
```

Pass the active draft's mode through NoteEditorPanel (no change here — see Step 4).

- [ ] **Step 2: NotesBrowser + ChartReview prop threading**

`NotesBrowser` props (~lines 63-71) gain:

```tsx
onEditNote: (note: Note) => void;
onAddendumNote: (note: Note) => void;
ownNote: (note: Note) => boolean;
```

At the `NotePreview` usage (~line 266), add after `onDelete`:

```tsx
onEdit={
  activeNote &&
  activeNote.status === "incomplete" &&
  activeNote.id.startsWith("user-note-")
    ? () => onEditNote(activeNote)
    : undefined
}
onAddendum={
  activeNote && activeNote.status !== "incomplete" && ownNote(activeNote)
    ? () => onAddendumNote(activeNote)
    : undefined
}
```

`ChartReview` (~lines 37-47): add the same three props to its signature and pass them through to its `NotesBrowser` usage (~line 131), exactly as `onDeleteNote` flows today.

- [ ] **Step 3: NotePreview — Edit/Addendum buttons**

Props gain `onEdit?: () => void; onAddendum?: () => void;`. Import `PenLine` from lucide-react. Replace the dead Addendum button (~lines 62-65):

```tsx
{note.status === "incomplete" && onEdit ? (
  <button onClick={onEdit}>
    <PenLine size={13} />
    Edit
  </button>
) : (
  <button
    disabled={!onAddendum}
    title={
      onAddendum
        ? "Append an addendum to this note"
        : "Only your own notes can be addended"
    }
    onClick={onAddendum}
  >
    <FilePlus2 size={13} />
    Addendum
  </button>
)}
```

Also update the component doc comment to mention the two new callbacks.

- [ ] **Step 4: NoteEditor addendum mode + NoteEditorPanel passthrough**

`NoteEditorPanel`: pass `mode={active.mode}` to `<NoteEditor>`.

`NoteEditor` props gain `mode?: "edit" | "addendum"`. Two changes inside:

Replace the note-type `<select>` block so addendum drafts show a fixed label (the type is meaningless for an addendum):

```tsx
{mode === "addendum" ? (
  <span className="note-editor-fixed-type">Addendum</span>
) : (
  <select
    value={noteType}
    aria-label="Note type"
    onChange={(event) => onChangeNoteType(event.target.value)}
  >
    {NOTE_TYPES.map((type) => (
      <option key={type}>{type}</option>
    ))}
  </select>
)}
```

Hide Pend for addendum drafts (addenda are signed directly, as in Epic) — wrap the existing Pend button:

```tsx
{mode !== "addendum" && (
  <button onClick={onPend} disabled={words === 0}>
    Pend
  </button>
)}
```

Everything else (SmartText, wildcard Sign gate, formatting) applies unchanged in both modes.

- [ ] **Step 5: WrapUpModule — addenda are not score candidates**

At ~line 44, change the editors spread to filter addendum drafts:

```tsx
...editors
  .filter((draft) => draft.mode !== "addendum")
  .map((draft) => {
```

(Keep the existing map body; only the filter is new.)

- [ ] **Step 6: CSS**

Append to `src/App.css` (near the note-editor rules):

```css
.note-editor-fixed-type {
  height: 20px;
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border: 1px solid #899873;
  background: #eef1de;
  font-weight: bold;
}
```

- [ ] **Step 7: Verify**

Run: `npx tsc -b && npm test && npm run lint`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/chart/NotePreview.tsx src/components/chart/NotesBrowser.tsx src/components/chart/ChartReview.tsx src/components/PatientWorkspace.tsx src/components/notes/NoteEditor.tsx src/components/notes/NoteEditorPanel.tsx src/components/wrapup/WrapUpModule.tsx src/App.css
git commit -m "Edit and Addendum: reopen pended notes, stamped addenda on owned notes"
```

---

### Post-plan verification (controller, not a task)

Browser checklist: sign in fresh (old profile re-gates); pend a SmartText note with unresolved chips, click Edit in its preview — chips return, Sign stays gated, resolve and Sign — scored once, stored note replaced not duplicated; Addendum on `note-prog-003` — signs into a stamped block under the attending attestation, second addendum stacks; Addendum disabled on an attending's note; addendum draft shows fixed type label and no Pend; reload — addenda persist; sign out — addenda swept.
