# Dynamic Patients Plan 4b: The interactive loop (advance + chronos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on Plan 4a being merged** (needs `CaseBundle.rounds`/`chronos`, cholangitis001 `events.ts`, and the `revealEvents` suppression param).

**Goal:** Turn the reveal engine into a playable loop: signing a fresh ward-round note advances the sim-clock to the next round (stamping the round's encounter on the note so NPC suppression fires), trainee notes stamp the correct sim-date, the server clock is monotonic (forward-only), and a deterministic chronos console lets the trainee pull the microbiology sensitivities forward by asking for them.

**Architecture:** All advance authority is client-driven in v1 (`useCaseWork().advanceSim` already exists, forward-only, last-write-wins PUT). 4b wires callers to it: `finishDraft` calls `advanceSim(nextRoundAt)` after signing a fresh note; a new pure `src/lib/chronos.ts` matcher (reusing the rubric tokenizer) maps a typed phrase to a target reveal and the chronos console calls `advanceSim(targetAt)`. `buildUserNote` and `caseNow` gain the round encounterId and the sim offset so trainee notes land in the right round and carry the right date. The server PUT gains a `MAX(...)` monotonic clamp so a stale tab or closure cannot rewind the clock now that it has callers.

**Tech Stack:** React 19 SPA (`src/`), Cloudflare Worker + Hono (`src/worker/session.ts`), D1, TypeScript strict (`npx tsc -b`), Vitest node pool (`npm test`) + real-D1 workers pool (`npm run test:workers`), ESLint, Vite build.

## Global Constraints

- **`simNow` / `at` are sim-offset SECONDS from the case `anchor`.** Advance is forward-only: `advanceSim(target)` clamps to `Math.max(simNow, Math.floor(target))` client-side, and the server PUT now also clamps `MAX(case_session.simNow, ?)`.
- **Only a fresh, signed ward-round note advances the clock** (spec §7). Addenda, edits/refiles, and pended (incomplete) notes never move sim-time. When no case declares `rounds` (every case but cholangitis001), `nextRoundAt` returns `null` and nothing advances, so behaviour is identical to today.
- **Chronos never fabricates data** (spec §8): it only advances `simNow` to an authored event's `at`, letting the normal reveal materialise pre-authored payloads. The matcher is deterministic (no LLM), reusing the rubric string-matching style.
- **Ownership is the better-auth user id** on the server; the sim clock is scoped by the `case_session.scope` column, unchanged.
- **Migrations:** none in 4b (the clock table already exists). The monotonic clamp is a query change, not a schema change.
- **Prose in docs/commits: no em dashes.** Code is unaffected.
- **Verify targets:** `npx tsc -b`, `npm test`, `npm run test:workers`, `npm run lint`, `npm run build`, plus a browser smoke of the loop.
- **Commit to `main` locally; never push.** Remote D1 / deploy are Ryan-gated and out of scope.

## File Structure

- `src/lib/simTime.ts` — `caseNow(anchor, offset?)` gains a sim offset (Task 1).
- `src/lib/userNotes.ts` — `buildUserNote(...)` gains an `encounterId` param (Task 1).
- `src/lib/rounds.ts` + `src/lib/rounds.test.ts` — NEW: pure `currentRound` / `nextRoundAt` helpers (Task 2).
- `src/lib/rubric.ts` — export `anyTriggerMatches` for reuse (Task 3).
- `src/lib/chronos.ts` + `src/lib/chronos.test.ts` — NEW: deterministic chronos matcher (Task 3).
- `src/worker/session.ts` + `src/worker/session.workers.test.ts` — monotonic PUT clamp (Task 4).
- `src/components/PatientWorkspace.tsx` — round-aware note stamping + advance-on-sign; host the chronos console (Task 5, Task 6).
- `src/components/chronos/ChronosDock.tsx` — NEW: the floating chronos console (Task 6).
- `src/App.css` — chronos dock styles (Task 6).

---

### Task 1: Round-aware note stamping (`caseNow` offset + `buildUserNote` encounterId)

**Files:**
- Modify: `src/lib/simTime.ts` (`caseNow` signature)
- Modify: `src/lib/userNotes.ts` (`buildUserNote` signature)
- Test: `src/lib/userNotes.test.ts` (may not exist; if not, create it) and/or `src/lib/simTime.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `caseNow(anchor: number | undefined, offset = 0): number` — returns `(anchor ?? nowSec) + offset`. Legacy call `caseNow(anchor)` is unchanged (offset 0).
  - `buildUserNote(draft, user, plainBody, status, nowSec, encounterId = "enc-admission"): ClinicalNote` — the note's `encounterId` is now a parameter (default preserves today's behaviour).

- [ ] **Step 1: Write the failing tests**

Check whether `src/lib/userNotes.test.ts` exists (`ls src/lib/userNotes.test.ts`). If it does, append; if not, create it with the imports it needs. Add:

```ts
import { describe, expect, test } from "vitest";
import { buildUserNote } from "./userNotes";
import { caseNow } from "./simTime";
import type { NoteDraft, UserProfile } from "../types";

const draft: NoteDraft = { id: "d1", noteType: "Progress Note", service: "(A) General Surgery", body: "" };
const user: UserProfile = { forename: "Sam", surname: "Lee", hcpId: "d912345", grade: "st3" };

describe("caseNow offset", () => {
  test("adds a sim offset to the anchor", () => {
    expect(caseNow(1000, 3600)).toBe(4600);
  });
  test("defaults to offset 0 (back-compat)", () => {
    expect(caseNow(1000)).toBe(1000);
  });
});

describe("buildUserNote encounterId", () => {
  test("defaults to enc-admission", () => {
    const note = buildUserNote(draft, user, "body", "signed", 1000);
    expect(note.encounterId).toBe("enc-admission");
  });
  test("uses the provided round encounterId", () => {
    const note = buildUserNote(draft, user, "body", "signed", 1000, "enc-ward-round-d2");
    expect(note.encounterId).toBe("enc-ward-round-d2");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- userNotes`
Expected: FAIL (`caseNow` ignores the second arg; `buildUserNote` hardcodes `enc-admission`).

- [ ] **Step 3: Add the `caseNow` offset**

In `src/lib/simTime.ts`, replace `caseNow`:

```ts
/**
 * The case's current sim-time in epoch seconds: the case anchor plus a sim
 * offset (`simNow`, seconds since the anchor). Falls back to the real wall
 * clock for legacy cases with no anchor (offset ignored there); like every
 * display in the app that instant is rendered in UTC (this module's invariant).
 */
export function caseNow(anchor: number | undefined, offset = 0): number {
  return anchor === undefined ? Math.floor(Date.now() / 1000) : anchor + offset;
}
```

- [ ] **Step 4: Add the `encounterId` param to `buildUserNote`**

In `src/lib/userNotes.ts`, change the `buildUserNote` signature and body:

```ts
export function buildUserNote(
  draft: NoteDraft,
  user: UserProfile,
  plainBody: string,
  status: NoteStatus,
  nowSec: number,
  encounterId = "enc-admission",
): ClinicalNote {
  const stamp = formatNoteStamp(nowSec);
  return {
    kind: "note",
    id: "", // the server assigns the real id when the note is POSTed
    encounterId,
    category: CATEGORY_BY_TYPE[draft.noteType] ?? "Progress",
    // ...everything else unchanged...
```

(Only the signature line and the `encounterId: "enc-admission"` line change; leave the rest of the returned object exactly as-is.)

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- userNotes`
Expected: PASS. Then `npm test` to confirm nothing else regressed (the existing `caseNow(anchor)` and `buildUserNote(...)` call sites still compile because both new params have defaults).

- [ ] **Step 6: Commit**

```bash
git add src/lib/simTime.ts src/lib/userNotes.ts src/lib/userNotes.test.ts
git commit -m "feat(engine): caseNow sim offset + buildUserNote round encounterId param"
```

---

### Task 2: Pure round helpers (`currentRound`, `nextRoundAt`)

**Files:**
- Create: `src/lib/rounds.ts`
- Test: `src/lib/rounds.test.ts`

**Interfaces:**
- Consumes: `RoundSpec` (from Plan 4a).
- Produces:
  - `currentRound(rounds: RoundSpec[], simNow: number): RoundSpec | null` — the latest round whose `at <= simNow` (null if none, e.g. before round 0 or an empty schedule).
  - `nextRoundAt(rounds: RoundSpec[], simNow: number): number | null` — the smallest round `at` strictly greater than `simNow` (null if none).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/rounds.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { RoundSpec } from "../types";
import { currentRound, nextRoundAt } from "./rounds";

const rounds: RoundSpec[] = [
  { at: 0, encounterId: "enc-admission", label: "Day 1" },
  { at: 54000, encounterId: "enc-d2", label: "Day 2", npcNoteId: "npc-d2" },
  { at: 140400, encounterId: "enc-d3", label: "Day 3", npcNoteId: "npc-d3" },
];

describe("currentRound", () => {
  test("returns the round at exactly simNow", () => {
    expect(currentRound(rounds, 54000)?.encounterId).toBe("enc-d2");
  });
  test("returns the latest round at or before simNow", () => {
    expect(currentRound(rounds, 60000)?.encounterId).toBe("enc-d2");
  });
  test("returns round 0 at simNow 0", () => {
    expect(currentRound(rounds, 0)?.encounterId).toBe("enc-admission");
  });
  test("returns null for an empty schedule", () => {
    expect(currentRound([], 100)).toBeNull();
  });
});

describe("nextRoundAt", () => {
  test("returns the next round strictly after simNow", () => {
    expect(nextRoundAt(rounds, 0)).toBe(54000);
    expect(nextRoundAt(rounds, 54000)).toBe(140400);
  });
  test("returns null at or past the last round", () => {
    expect(nextRoundAt(rounds, 140400)).toBeNull();
    expect(nextRoundAt(rounds, 200000)).toBeNull();
  });
  test("returns null for an empty schedule", () => {
    expect(nextRoundAt([], 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- rounds`
Expected: FAIL ("Cannot find module './rounds'").

- [ ] **Step 3: Write the helpers**

Create `src/lib/rounds.ts`:

```ts
import type { RoundSpec } from "../types";

/**
 * Round-schedule helpers for the action-keyed sim-clock (Plan 4, spec §7). Pure;
 * no React, no server. `rounds` is the case's authored schedule (ascending `at`);
 * these tolerate any order and an empty schedule (a static case), returning null.
 */

/** The latest round whose sim-time has arrived (`at <= simNow`), or null. */
export function currentRound(rounds: RoundSpec[], simNow: number): RoundSpec | null {
  let found: RoundSpec | null = null;
  for (const round of rounds) {
    if (round.at <= simNow && (found === null || round.at > found.at)) found = round;
  }
  return found;
}

/** The smallest round `at` strictly greater than `simNow`, or null if none remains. */
export function nextRoundAt(rounds: RoundSpec[], simNow: number): number | null {
  let next: number | null = null;
  for (const round of rounds) {
    if (round.at > simNow && (next === null || round.at < next)) next = round.at;
  }
  return next;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- rounds`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rounds.ts src/lib/rounds.test.ts
git commit -m "feat(engine): add pure currentRound + nextRoundAt round-schedule helpers"
```

---

### Task 3: Deterministic chronos matcher (`chronos.ts`)

**Files:**
- Modify: `src/lib/rubric.ts` (export a reusable `anyTriggerMatches`)
- Create: `src/lib/chronos.ts`
- Test: `src/lib/chronos.test.ts`

**Interfaces:**
- Consumes: `ChronosIntent`, `RubricTrigger` (types); the rubric tokenizer.
- Produces:
  - `anyTriggerMatches(text: string, triggers: RubricTrigger[]): boolean` (exported from `rubric.ts`) — true if the text satisfies ANY trigger (AND within a trigger's groups), reusing the exact tokenize / fuzzy-match logic.
  - `matchChronos(text: string, intents: ChronosIntent[]): { targetAt: number; reply: string } | null` — the first intent whose triggers match, else null.

- [ ] **Step 1: Export `anyTriggerMatches` from `rubric.ts`**

In `src/lib/rubric.ts`, add this exported function immediately after `itemMatches` (around line 64), reusing the existing internal `tokenize` and `triggerMatches`:

```ts
/**
 * True if the text satisfies ANY of the given triggers (rubric matching rules:
 * AND across a trigger's groups, OR of synonyms within a group, fuzzy on 5+
 * letter tokens). Exported so the chronos matcher reuses one string engine.
 */
export function anyTriggerMatches(text: string, triggers: RubricTrigger[]): boolean {
  const noteTokens = tokenize(text);
  return triggers.some((trigger) => triggerMatches(noteTokens, trigger));
}
```

- [ ] **Step 2: Write the failing chronos tests**

Create `src/lib/chronos.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { ChronosIntent } from "../types";
import { matchChronos } from "./chronos";

const intents: ChronosIntent[] = [
  {
    triggers: [
      [["culture", "cultures", "sensitivity", "sensitivities", "micro"]],
      [["organism", "coli"]],
      [["antibiotic", "antibiotics", "abx"], ["which", "narrow", "de-escalate", "change"]],
    ],
    targetAt: 208800,
    reply: "Cultures back: E. coli, sensitivities attached.",
  },
];

describe("matchChronos", () => {
  test("matches a single-word culture query", () => {
    expect(matchChronos("any word on the cultures?", intents)?.targetAt).toBe(208800);
  });
  test("matches the organism synonym", () => {
    expect(matchChronos("has the organism been identified", intents)?.targetAt).toBe(208800);
  });
  test("matches the two-group antibiotic intent", () => {
    expect(matchChronos("which antibiotic should we narrow to", intents)?.targetAt).toBe(208800);
  });
  test("does not match an unrelated query", () => {
    expect(matchChronos("can I have a coffee", intents)).toBeNull();
  });
  test("requires both groups of the antibiotic trigger", () => {
    // "antibiotics" alone (no which/narrow/de-escalate/change) must not match via that trigger.
    expect(matchChronos("continue the antibiotics", intents)).toBeNull();
  });
  test("returns the reply on a match", () => {
    expect(matchChronos("cultures?", intents)?.reply).toContain("E. coli");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- chronos`
Expected: FAIL ("Cannot find module './chronos'").

- [ ] **Step 4: Write the matcher**

Create `src/lib/chronos.ts`:

```ts
import type { ChronosIntent } from "../types";
import { anyTriggerMatches } from "./rubric";

/**
 * Deterministic chronos matcher (spec §8): map a trainee's typed phrase to a
 * pre-authored reveal the case declares, reusing the rubric string engine. No
 * LLM. Returns the first matching intent's target sim-time + reply, or null.
 * Never fabricates data: `targetAt` only names an authored event's `at`, which
 * the reveal rail materialises when the clock reaches it.
 */
export type ChronosMatch = { targetAt: number; reply: string };

export function matchChronos(text: string, intents: ChronosIntent[]): ChronosMatch | null {
  for (const intent of intents) {
    if (anyTriggerMatches(text, intent.triggers)) {
      return { targetAt: intent.targetAt, reply: intent.reply };
    }
  }
  return null;
}
```

- [ ] **Step 5: Run to verify pass + regression**

Run: `npm test -- chronos` then `npm test -- rubric`
Expected: both PASS (chronos matcher works; the rubric export did not change existing scoring).

- [ ] **Step 6: Commit**

```bash
git add src/lib/rubric.ts src/lib/chronos.ts src/lib/chronos.test.ts
git commit -m "feat(engine): add deterministic chronos matcher reusing the rubric string engine"
```

---

### Task 4: Server-side monotonic `simNow` clamp

**Files:**
- Modify: `src/worker/session.ts` (the PUT `DO UPDATE`)
- Test: `src/worker/session.workers.test.ts` (add a rewind-guard test)

**Interfaces:**
- Consumes: the `case_session` table + PUT route (Plan 3).
- Produces: `PUT /api/cases/:caseId/session` now stores `MAX(existing, incoming)` for `simNow`, so a stale client cannot rewind the clock. It still returns the STORED value (which may be higher than the requested one).

- [ ] **Step 1: Write the failing rewind test**

Append to `src/worker/session.workers.test.ts` (helpers `anonCookie`/`callWorker` already exist in the file):

```ts
describe("PUT /api/cases/:caseId/session monotonic clamp", () => {
  test("a lower simNow never rewinds the stored clock", async () => {
    const cookie = await anonCookie();
    const put = (simNow: number) =>
      callWorker("/api/cases/cholangitis001/session", {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ simNow }),
      });
    expect(await (await put(9000)).json()).toEqual({ simNow: 9000 });
    // A stale tab tries to rewind to 3600: the server holds at 9000 and echoes it.
    expect(await (await put(3600)).json()).toEqual({ simNow: 9000 });

    const res = await callWorker("/api/cases/cholangitis001/session", { headers: { cookie } });
    expect(await res.json()).toEqual({ simNow: 9000 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:workers`
Expected: FAIL (today's last-write-wins PUT stores and returns 3600).

- [ ] **Step 3: Add the monotonic clamp**

In `src/worker/session.ts`, replace the PUT handler's body. The `DO UPDATE` now clamps to the maximum, and the handler re-reads the stored value to return it (so the client learns the clock did not rewind):

```ts
session.put("/cases/:caseId/session", async (c) => {
  const raw = (await c.req.json().catch(() => null)) as { simNow?: unknown } | null;
  if (!raw || typeof raw.simNow !== "number" || !Number.isFinite(raw.simNow) || raw.simNow < 0)
    return c.json({ error: "bad request" }, 400);
  const simNow = Math.floor(raw.simNow);
  const scope = c.get("userId");
  const caseId = c.req.param("caseId");
  // Forward-only: never let a stale client rewind the clock. The client
  // advanceSim already clamps forward; this makes it robust to two tabs.
  await c.env.DB.prepare(
    `INSERT INTO case_session (scope, caseId, simNow, updatedAt) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (scope, caseId) DO UPDATE SET
       simNow = MAX(case_session.simNow, ?3),
       updatedAt = ?4`,
  )
    .bind(scope, caseId, simNow, Date.now())
    .run();
  const row = await c.env.DB.prepare(
    `SELECT simNow FROM case_session WHERE scope = ?1 AND caseId = ?2`,
  )
    .bind(scope, caseId)
    .first<{ simNow: number }>();
  return c.json({ simNow: row?.simNow ?? simNow });
});
```

- [ ] **Step 4: Run to verify pass + no regression**

Run: `npm run test:workers`
Expected: PASS. The existing `PUT ... last-write-wins` test (`put(3600)` then `put(7200)` -> 7200) still passes because those are forward moves; the new rewind test proves the clamp; the 400-validation and cross-user tests are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/worker/session.ts src/worker/session.workers.test.ts
git commit -m "fix(engine): clamp PUT /session to MAX so a stale client cannot rewind the sim clock"
```

---

### Task 5: Advance-on-sign + round-aware stamping in `PatientWorkspace`

**Files:**
- Modify: `src/components/PatientWorkspace.tsx`

**Interfaces:**
- Consumes: `currentRound`/`nextRoundAt` (Task 2), `caseNow` offset + `buildUserNote` encounterId (Task 1), `useCaseWork().advanceSim`/`simNow` (Plan 3).
- Produces: signing a FRESH note stamps it at the current round's sim-time + encounter and then advances the clock to the next round; edits/addenda/pends do not advance.

- [ ] **Step 1: Add the imports**

In `src/components/PatientWorkspace.tsx`, add next to the existing `revealEvents` import:

```ts
import { currentRound, nextRoundAt } from "../lib/rounds";
```

- [ ] **Step 2: Derive the current round inside the component**

After the `coveredEncounterIds`/`revealed` memos (from Plan 4a, ~L79), add:

```tsx
  // The round the trainee is currently sitting at (drives note stamping +
  // advance-on-sign). Null for a static case, which keeps every path inert.
  const activeRound = useMemo(
    () => currentRound(activeCase.rounds ?? [], work.simNow),
    [activeCase.rounds, work.simNow],
  );
```

- [ ] **Step 3: Stamp the round encounter + sim offset when building/refiling a note**

In `finishDraft`, the `caseNow(activeCase.anchor)` calls currently ignore sim-time and the round. Update the three note-building calls to pass the sim offset and (for a fresh create) the round encounterId:

Replace the addendum branch's build:

```tsx
      if (draft.mode === "addendum" && draft.targetNoteId) {
        await work.addAddendum(
          draft.targetNoteId,
          buildAddendumBlock(user, text, caseNow(activeCase.anchor, work.simNow)),
        );
        onPatch((prev) => ({ editors: prev.editors.filter((d) => d.id !== id) }));
        return;
      }
```

Replace the refile/create block:

```tsx
      const target =
        draft.mode === "edit" && draft.targetNoteId
          ? userNotes.find((n) => n.id === draft.targetNoteId)
          : undefined;
      if (target) {
        await work.refileNote(
          refileUserNote(target, draft, text, status, caseNow(activeCase.anchor, work.simNow)),
        );
      } else {
        await work.createNote(
          buildUserNote(
            draft,
            user,
            text,
            status,
            caseNow(activeCase.anchor, work.simNow),
            activeRound?.encounterId ?? "enc-admission",
          ),
        );
      }
```

- [ ] **Step 4: Advance the clock after signing a fresh note**

Still in `finishDraft`, in the `if (status === "signed")` block, after the `onPatch(... wrapupOpen: true ...)` call, advance to the next round ONLY for a fresh created note (not an edit/refile, which reuses `target`). Add:

```tsx
        onPatch((prev) => ({
          editors: prev.editors.filter((d) => d.id !== id),
          wrapupOpen: true,
        }));
        // Signing a fresh round note advances the ward clock to the next round
        // (spec §7). Edits/refiles and pends never advance. No-op when the case
        // has no rounds or none remain (nextRoundAt returns null).
        if (!target) {
          const nextAt = nextRoundAt(activeCase.rounds ?? [], work.simNow);
          if (nextAt !== null) {
            try {
              await work.advanceSim(nextAt);
            } catch {
              setSaveError("Note signed, but the ward clock didn't advance. Reopen the chart to retry.");
            }
          }
        }
```

Important ordering: `work.saveAttempt(text, true)` (the feedback attempt) runs BEFORE this advance, so the attempt is captured against the sign-time chart (spec §10; v1 scoring is text-only so the frozen text already fixes fairness, but keeping the attempt-before-advance order is the correct sequence for when chart-aware scoring lands).

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 6: Browser smoke the advance loop**

Run: `npm run dev`, then at `http://localhost:5173` (chrome-devtools-axi):
1. Sign in, open cholangitis001. Confirm `GET /api/cases/cholangitis001/session` returns `simNow` 0 (reset it via the console PUT if a prior run left it advanced).
2. Write a Post-Take Ward Round note (New Note, type "Post-Take Ward Round", a few lines) and Sign it.
3. Confirm: the Performance dock opens with the rubric score (unchanged behaviour), AND a follow-up `PUT /api/cases/cholangitis001/session` set `simNow` to 54000 (round 1). Reload; confirm the gram-stain microbiology row is now present (it reveals at 46800 < 54000) and the day-2 vitals point is on the Summary trend.
4. Write and Sign a day-2 progress note. Confirm `simNow` advances to 140400 (round 2) and NO duplicate day-2 NPC note appears (the trainee's note covers `enc-ward-round-d2`).
5. Confirm the trainee's day-2 note is DATED 17/06 (sim offset working), not 16/06.

- [ ] **Step 7: Commit**

```bash
git add src/components/PatientWorkspace.tsx
git commit -m "feat(loop): sign a round note to advance the clock + stamp the round encounter/date"
```

---

### Task 6: Chronos console (floating dock)

**Files:**
- Create: `src/components/chronos/ChronosDock.tsx`
- Modify: `src/components/PatientWorkspace.tsx` (host the dock; hide it for static cases)
- Modify: `src/App.css` (dock styles)

**Interfaces:**
- Consumes: `matchChronos` (Task 3), `useCaseWork().advanceSim`, `CaseBundle.chronos`.
- Produces: a bottom-right floating "Chronos" launcher + panel. The trainee types a request; on a deterministic match the panel appends the authored reply and calls `advanceSim(targetAt)`; on no match it appends a fixed "no channel for that" line. Rendered only when the case declares `chronos`.

- [ ] **Step 1: Write the ChronosDock component**

Create `src/components/chronos/ChronosDock.tsx`:

```tsx
import { useState } from "react";
import { Clock, Send, X } from "lucide-react";
import { matchChronos } from "../../lib/chronos";
import type { ChronosIntent } from "../../types";

type Turn = { from: "you" | "chronos"; text: string };

const NO_MATCH =
  "No channel for that yet. Try asking about the cultures, the organism, or which antibiotic to narrow to.";

/**
 * Chronos console (spec §8): a deterministic time-skip channel. The trainee
 * asks for a pending result; a matching authored intent advances the sim-clock
 * to that result's reveal and returns a templated reply. Floating bottom-right
 * so it does not fight the bottom-left Performance dock. Rendered only when the
 * case declares chronos intents.
 */
export function ChronosDock({
  intents,
  onAdvance,
}: {
  intents: ChronosIntent[];
  onAdvance: (targetAt: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    { from: "chronos", text: "Chronos: I can pull a pending result forward. What are you chasing?" },
  ]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const match = matchChronos(text, intents);
    setTurns((prev) => [
      ...prev,
      { from: "you", text },
      { from: "chronos", text: match ? match.reply : NO_MATCH },
    ]);
    setDraft("");
    if (match) onAdvance(match.targetAt);
  }

  return (
    <div className="chronos-dock">
      {open && (
        <div className="chronos-panel" role="dialog" aria-label="Chronos time-skip channel">
          <div className="chronos-head">
            <span>
              <Clock size={14} /> Chronos
            </span>
            <button aria-label="Close Chronos" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="chronos-log">
            {turns.map((turn, i) => (
              <div key={i} className={`chronos-turn ${turn.from}`}>
                {turn.text}
              </div>
            ))}
          </div>
          <div className="chronos-input">
            <input
              value={draft}
              placeholder="e.g. any word on the cultures?"
              aria-label="Ask Chronos"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button aria-label="Send" onClick={send}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
      <button
        className={open ? "chronos-launcher active" : "chronos-launcher"}
        onClick={() => setOpen((v) => !v)}
        aria-pressed={open}
        title="Chronos time-skip channel"
      >
        <Clock size={15} />
        Chronos
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Host the dock in `PatientWorkspace`**

In `src/components/PatientWorkspace.tsx`, add the import:

```ts
import { ChronosDock } from "./chronos/ChronosDock";
```

Then render it next to `WrapUpDock` (inside the returned `CaseContext.Provider`, after the `<WrapUpDock ... />` block), only when the case declares chronos intents:

```tsx
      {activeCase.chronos && activeCase.chronos.length > 0 && (
        <ChronosDock
          intents={activeCase.chronos}
          onAdvance={(targetAt) => {
            setSaveError(null);
            work.advanceSim(targetAt).catch(() => setSaveError("Chronos couldn't advance the clock."));
          }}
        />
      )}
```

- [ ] **Step 3: Add the dock styles**

Append to `src/App.css` (mirror the WrapUp dock's visual language; bottom-right):

```css
/* Chronos time-skip console (floating, bottom-right). */
.chronos-dock {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.chronos-launcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border, #c9d2dc);
  border-radius: 999px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.chronos-launcher.active {
  background: #eef4ff;
  border-color: #7aa5ff;
}
.chronos-panel {
  width: 340px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border, #c9d2dc);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.chronos-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border, #e2e8f0);
  font-weight: 600;
  font-size: 13px;
}
.chronos-head span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chronos-head button {
  border: none;
  background: none;
  cursor: pointer;
  color: #64748b;
}
.chronos-log {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
}
.chronos-turn {
  padding: 8px 10px;
  border-radius: 8px;
  max-width: 92%;
}
.chronos-turn.you {
  align-self: flex-end;
  background: #eef4ff;
}
.chronos-turn.chronos {
  align-self: flex-start;
  background: #f1f5f9;
}
.chronos-input {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--border, #e2e8f0);
}
.chronos-input input {
  flex: 1;
  padding: 7px 9px;
  border: 1px solid var(--border, #c9d2dc);
  border-radius: 6px;
  font-size: 13px;
}
.chronos-input button {
  border: 1px solid #7aa5ff;
  background: #eef4ff;
  border-radius: 6px;
  padding: 0 10px;
  cursor: pointer;
  color: #1d4ed8;
}
```

(If `src/App.css` already defines `--border` or a design token for panel chrome, prefer the existing token names; the fallbacks above only apply if the variable is unset.)

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Browser smoke the chronos loop**

Run: `npm run dev`, at `http://localhost:5173` (chrome-devtools-axi):
1. Sign in, open cholangitis001, reset `simNow` to 0.
2. Open the Chronos dock (bottom-right pill). Type "any word on the cultures?" and send.
3. Confirm: Chronos replies with the E. coli / susceptibilities line, and a `PUT /api/cases/cholangitis001/session` sets `simNow` to 208800. Reload.
4. Confirm the chart now shows the FINAL susceptibilities micro report (E. coli with the S/I/R table), the E. coli identification row, AND both NPC round notes (day 2 by Sowande, day 3 by Whitlock) since the trainee skipped those rounds.
5. Type "can I have a coffee" and confirm Chronos returns the no-match line and does NOT advance the clock.

- [ ] **Step 6: Commit**

```bash
git add src/components/chronos/ChronosDock.tsx src/components/PatientWorkspace.tsx src/App.css
git commit -m "feat(loop): add the deterministic Chronos time-skip console"
```

---

### Task 7: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the complete suite**

Run each and confirm green:
- `npx tsc -b`
- `npm test` (node pool: rounds + chronos + userNotes + reveal + applyEvents + rubric + leak guard + walker)
- `npm run test:workers` (real-D1: session monotonic clamp + all prior worker tests)
- `npm run lint`
- `npm run build`

Expected: all PASS. Record new test counts (node pool gains rounds + chronos + userNotes suites; workers pool gains the monotonic-clamp test).

- [ ] **Step 2: Commit any incidental fixups**

If a lint/type fix was needed, commit it:

```bash
git add -A
git commit -m "chore(loop): full-suite green after 4b"
```

---

## Self-Review (completed against DYNAMIC_PATIENTS_SPEC.md §7, §8)

**Spec coverage (4b scope = advance + chronos):**
- §7 sign a round's designated note advances to the next scheduled round; ad-hoc/addenda/reopened refiles do not -> Task 5 (advance only on a fresh created signed note). `buildUserNote` stamps sim-time (not wall-clock) -> Task 1 (`caseNow` offset). Round encounterId stamped so suppression fires -> Tasks 1 + 5.
- §8 chronos: deterministic intent matching reusing the rubric style; on a match advances `simNow` to the target reveal's `at` and returns a templated reply naming the datum; never fabricates a result -> Task 3 (matcher) + Task 6 (console). Timestamp semantics: the revealed result is stamped at its true sim-time and `simNow` moves to it (the reveal rail already stamps authored display strings; chronos only moves the clock).
- Deferred engine note folded in: server-side monotonic `simNow` clamp now that `advanceSim` has callers -> Task 4.

**Placeholder scan:** every code step contains complete, compilable code; every command has an expected result. No TBD/TODO. Clean.

**Type consistency:** `currentRound`/`nextRoundAt` signatures match between Task 2 (definition) and Task 5 (call sites). `matchChronos(text, intents)` and its `{ targetAt, reply }` return match between Task 3 (definition), the tests, and Task 6 (`ChronosDock`). `caseNow(anchor, offset?)` and `buildUserNote(..., encounterId?)` match between Task 1 (definitions) and Task 5 (call sites). `ChronosDock` props (`intents`, `onAdvance`) match between Task 6's component and its `PatientWorkspace` host. The PUT clamp returns `{ simNow }` unchanged, so `apiPutSession`/`advanceSim` typing is untouched.

**Interaction note:** advance-on-sign uses `work.simNow` captured at render; because signing is a single user action and the PUT is forward-only (client clamp + server MAX from Task 4), a double-fire cannot rewind. The advance runs after `saveAttempt`, preserving sign-time attempt capture.
