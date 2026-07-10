# Dynamic Patients Plan 3: Server Engine (Model B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dynamic-patients engine (Model B): a server-persisted per-case sim clock, an extended `applyEvents` fold with sim-reveal event kinds, a pure client reveal filter, and the client wiring that composes authored reveals with trainee work — all inert until Plan 4 authors a case's `events.ts`.

**Architecture:** ONE new D1 table `case_session` stores only the clock (`simNow`, a sim-offset in seconds from the case `anchor`). A new session router (clone of `work.ts`) reads/writes it. The client fetches `simNow`, filters a case's authored `events.ts` to `at <= simNow` via a pure `revealEvents` filter, and folds the result (plus adapted trainee work) through the existing `applyEvents` seam, which grows four sim-reveal kinds. No cron, no Durable Object, no server-side event log (Model B defers `case_event` to LLM/multiplayer).

**Tech Stack:** Cloudflare Worker + Hono (`src/worker/`), D1 + `migrations/`, better-auth session gating, React 19 SPA (`src/`), Vitest (node pool `npm test`; real-D1 `vitest-pool-workers` `npm run test:workers`), TypeScript strict (`npx tsc -b`).

## Global Constraints

- **Column name is `scope`, not `userId`** on `case_session` (DYNAMIC_PATIENTS_SPEC.md §5.1, fork D). Value = the better-auth `user.id` in v1; the name is carried now so the multiplayer move (`scope = sessionId`) is a value change, not a migration. FK: `"scope" ... references "user"("id") on delete cascade`.
- **`simNow` / `at` are sim-offset seconds from the case `anchor`** (a Unix epoch-seconds field on `CaseBundle`, already present, cholangitis001 only). They are NOT wall-clock and NOT absolute epochs. The engine compares them as plain integers; it never reads a document's own `timestamp`.
- **`applyEvents` must stay pure + immutable.** `getCase()` returns a shared registry singleton reused across tabs; the fold must never mutate `bundle`. `applyEvents(bundle, [])` MUST return the SAME reference. `documents` is the source of truth; `notes` is always recomputed as its `kind:"note"` subset so the two never drift.
- **Ownership is always the better-auth `user.id`** (`c.set("userId", session.user.id)` in the session middleware), stored in the `scope` column. Never the display-only `hcpId`.
- **DDL house style** (see `migrations/0002`,`0003`): double-quoted lowercase identifiers, `text`/`integer` affinities, composite PK `primary key ("scope", "caseId")` (mirror `wrapup_attempt`), header comment `-- Migration number: 0004 <TAB> 2026-07-10` with a literal tab.
- **Migrations:** `--local` apply is fine for dev/test (`npx wrangler d1 migrations apply legend-db --local`); the worker test pool auto-applies from `migrations/`. `--remote` (prod) is OUT OF SCOPE for this plan and always Ryan-gated (a separate ship gate).
- **This plan ships NO case content.** cholangitis001 gets no `events.ts` here; the engine is wired and inert. Plan 4 authors content and lights it up.
- **Verify targets:** `npx tsc -b` (fast loop), `npm test` (node pool, pure lib), `npm run test:workers` (real-D1), `npm run lint`, `npm run build`. Client changes additionally verify by browser smoke (chart renders identically; a `/session` GET creates a row).
- **Prose in docs/commits: no em dashes** (use commas, parentheses, colons). Code is unaffected.

---

### Task 1: Migration 0004 — `case_session` table + FK-cascade test

**Files:**
- Create: `migrations/0004_case_session.sql`
- Test: `src/worker/session.workers.test.ts` (new; schema-cascade block only in this task)

**Interfaces:**
- Produces: the `case_session` table with columns `scope TEXT`, `caseId TEXT`, `simNow INTEGER`, `updatedAt INTEGER`, PK `(scope, caseId)`, FK `scope -> user(id) ON DELETE CASCADE`. Consumed by Tasks 2, 3 and the client.

- [ ] **Step 1: Write the migration**

Create `migrations/0004_case_session.sql`. The first line's gap between `0004` and the date is a LITERAL TAB (match `0002`/`0003` exactly), and every identifier is double-quoted:

```sql
-- Migration number: 0004 	 2026-07-10

create table "case_session" ("scope" text not null references "user" ("id") on delete cascade, "caseId" text not null, "simNow" integer not null, "updatedAt" integer not null, primary key ("scope", "caseId"));
```

(No secondary index: the composite PK `(scope, caseId)` already covers every lookup, exactly like `wrapup_attempt`.)

- [ ] **Step 2: Apply the migration to the local D1 replica**

Run: `npx wrangler d1 migrations apply legend-db --local`
Expected: output lists `0004_case_session.sql` as applied (0002/0003 already applied show as no-ops). Do NOT pass `--remote`.

- [ ] **Step 3: Write the failing schema-cascade test**

Create `src/worker/session.workers.test.ts` with this content (clones the `anonCookie`/`callWorker` helpers from `work.workers.test.ts` so later tasks reuse them, and the FK-cascade pattern from that file's `user_work schema` block). Import only what this task uses; Task 3 adds the `rekey`/`purge` imports when its tests need them (a project with `noUnusedLocals` would otherwise reject the file):

```ts
import { applySetCookies } from "better-auth/cookies";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { createAuth } from "./auth";
import worker from "./index";

async function anonCookie(): Promise<string> {
  const auth = createAuth(env as unknown as Env, "http://localhost");
  const signIn = await auth.api.signInAnonymous({ returnHeaders: true });
  const h = new Headers();
  applySetCookies(h, signIn.headers.getSetCookie());
  const cookie = h.get("cookie");
  if (!cookie) throw new Error("no session cookie");
  return cookie;
}

async function callWorker(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    new Request(`http://localhost${path}`, init) as Parameters<typeof worker.fetch>[0],
    env as unknown as Env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res as unknown as Response;
}

describe("case_session schema", () => {
  test("deleting a user cascades to their case_session rows", async () => {
    const auth = createAuth(env as unknown as Env, "http://localhost");
    const userId = (await auth.api.signInAnonymous())!.user.id;

    await env.DB.prepare(
      `INSERT INTO case_session (scope, caseId, simNow, updatedAt) VALUES (?1, 'cholangitis001', 3600, 1)`,
    ).bind(userId).run();

    await env.DB.prepare(`DELETE FROM user WHERE id = ?1`).bind(userId).run();

    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM case_session WHERE scope = ?1`,
    ).bind(userId).first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes (the table now exists via auto-applied migrations)**

Run: `npm run test:workers`
Expected: the `case_session schema` test PASSES (the workers pool reads `migrations/` including 0004). If it fails with "no such table: case_session", the migration filename or SQL is malformed. `purgeStaleAnonUsers`/`rekeyUserWork` imports are unused for now; TypeScript in the workers pool tolerates unused imports at test runtime, but if `npm run lint` later flags them, they get their first use in Task 3.

- [ ] **Step 5: Commit**

```bash
git add migrations/0004_case_session.sql src/worker/session.workers.test.ts
git commit -m "feat(engine): add case_session table (migration 0004) with FK-cascade test"
```

---

### Task 2: Session router — `GET`/`PUT /api/cases/:caseId/session`

**Files:**
- Create: `src/worker/session.ts`
- Modify: `src/worker/index.ts` (mount the router)
- Test: `src/worker/session.workers.test.ts` (add route tests)

**Interfaces:**
- Consumes: the `case_session` table (Task 1), the better-auth session (via `createAuth`), the ambient global `Env` type.
- Produces: `export const session` (a `Hono<SessionEnv>`), mounted at `/` under the `/api` basePath. `GET /api/cases/:caseId/session` lazily creates the row and returns `{ simNow: number }`. `PUT /api/cases/:caseId/session` accepts `{ simNow: number }` (finite, >= 0), upserts last-write-wins, returns `{ simNow }`. 401 without a session; 400 on bad body.

- [ ] **Step 1: Write the session router**

Create `src/worker/session.ts` (clones the session middleware from `work.ts` verbatim, renamed):

```ts
import { Hono } from "hono";
import { createAuth } from "./auth";

/**
 * Session-gated per-case sim clock (Model B). Stores only the clock
 * (`case_session.simNow`, a sim-offset in seconds from the case anchor); the
 * client reveals its own authored events by this cursor. Scope is the
 * better-auth user id today (fork D: the column is named `scope` so multiplayer
 * becomes a value change, not a migration).
 */
type SessionEnv = { Bindings: Env; Variables: { userId: string } };

export const session = new Hono<SessionEnv>();

session.use("*", async (c, next) => {
  const auth = createAuth(c.env, new URL(c.req.url).origin);
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", s.user.id);
  await next();
});

session.get("/cases/:caseId/session", async (c) => {
  const scope = c.get("userId");
  const caseId = c.req.param("caseId");
  const row = await c.env.DB.prepare(
    `SELECT simNow FROM case_session WHERE scope = ?1 AND caseId = ?2`,
  )
    .bind(scope, caseId)
    .first<{ simNow: number }>();
  if (row) return c.json({ simNow: row.simNow });
  // Lazily create the clock at simNow = 0 on first read (idempotent).
  await c.env.DB.prepare(
    `INSERT INTO case_session (scope, caseId, simNow, updatedAt) VALUES (?1, ?2, 0, ?3)
     ON CONFLICT (scope, caseId) DO NOTHING`,
  )
    .bind(scope, caseId, Date.now())
    .run();
  return c.json({ simNow: 0 });
});

session.put("/cases/:caseId/session", async (c) => {
  const raw = (await c.req.json().catch(() => null)) as { simNow?: unknown } | null;
  if (!raw || typeof raw.simNow !== "number" || !Number.isFinite(raw.simNow) || raw.simNow < 0)
    return c.json({ error: "bad request" }, 400);
  const simNow = Math.floor(raw.simNow);
  await c.env.DB.prepare(
    `INSERT INTO case_session (scope, caseId, simNow, updatedAt) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (scope, caseId) DO UPDATE SET simNow = ?3, updatedAt = ?4`,
  )
    .bind(c.get("userId"), c.req.param("caseId"), simNow, Date.now())
    .run();
  return c.json({ simNow });
});
```

- [ ] **Step 2: Mount the router in the worker entry**

Modify `src/worker/index.ts`. Add the import alongside the others (after the `profile` import, line ~3):

```ts
import { session } from "./session";
```

And mount it next to the other sub-routers (immediately after `app.route("/", profile);`, line ~26):

```ts
app.route("/", session);
```

- [ ] **Step 3: Run the type-check to verify it compiles**

Run: `npx tsc -b`
Expected: PASS (no errors). This confirms the router + mount typecheck against the ambient `Env`.

- [ ] **Step 4: Write the failing route tests**

Append to `src/worker/session.workers.test.ts` (the `anonCookie`/`callWorker` helpers from Task 1 are already in the file):

```ts
describe("GET /api/cases/:caseId/session", () => {
  test("401 without a session", async () => {
    const res = await callWorker("/api/cases/cholangitis001/session");
    expect(res.status).toBe(401);
  });

  test("lazily creates the clock at simNow 0 for a fresh user", async () => {
    const cookie = await anonCookie();
    const res = await callWorker("/api/cases/cholangitis001/session", { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ simNow: 0 });
  });
});

describe("PUT /api/cases/:caseId/session", () => {
  test("sets simNow and reads back, last-write-wins", async () => {
    const cookie = await anonCookie();
    const put = (simNow: number) =>
      callWorker("/api/cases/cholangitis001/session", {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ simNow }),
      });
    expect((await put(3600)).status).toBe(200);
    expect(await (await put(7200)).json()).toEqual({ simNow: 7200 });

    const res = await callWorker("/api/cases/cholangitis001/session", { headers: { cookie } });
    expect(await res.json()).toEqual({ simNow: 7200 });
  });

  test("400 on a non-numeric or negative simNow", async () => {
    const cookie = await anonCookie();
    const bad = (body: unknown) =>
      callWorker("/api/cases/cholangitis001/session", {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await bad({ simNow: "nope" })).status).toBe(400);
    expect((await bad({ simNow: -1 })).status).toBe(400);
    expect((await bad({})).status).toBe(400);
  });

  test("one user's clock is invisible to another", async () => {
    const cookieA = await anonCookie();
    const cookieB = await anonCookie();
    await callWorker("/api/cases/cholangitis001/session", {
      method: "PUT",
      headers: { cookie: cookieA, "content-type": "application/json" },
      body: JSON.stringify({ simNow: 9000 }),
    });
    const res = await callWorker("/api/cases/cholangitis001/session", { headers: { cookie: cookieB } });
    expect(await res.json()).toEqual({ simNow: 0 });
  });
});
```

- [ ] **Step 5: Run the route tests to verify they pass**

Run: `npm run test:workers`
Expected: all `case_session schema` + `GET/PUT .../session` tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worker/session.ts src/worker/index.ts src/worker/session.workers.test.ts
git commit -m "feat(engine): add session router (GET/PUT /api/cases/:caseId/session), server sim clock"
```

---

### Task 3: rekey + purge coverage for `case_session`

**Files:**
- Modify: `src/worker/rekey.ts` (add one `UPDATE OR REPLACE` line to the `db.batch`)
- Test: `src/worker/session.workers.test.ts` (add rekey + purge tests)

**Interfaces:**
- Consumes: `rekeyUserWork(db, fromUserId, toUserId)` and `purgeStaleAnonUsers(db, cutoff)` (already imported in the test file, Task 1).
- Produces: a guest's `case_session` row follows them on Google-link (guest-wins on `(scope, caseId)` collision), and is FK-cascade-purged when the anon user is deleted.

- [ ] **Step 1: Add the rekey line**

Modify `src/worker/rekey.ts`. Inside the existing `db.batch([...])`, add a `case_session` statement immediately after the `wrapup_attempt` line (it uses `UPDATE OR REPLACE` for the same reason: `(scope, caseId)` is a composite PK that can collide if the target account already has a clock for that case, so the guest's live clock wins):

```ts
    db
      .prepare(`UPDATE OR REPLACE case_session SET scope = ?2 WHERE scope = ?1`)
      .bind(fromUserId, toUserId),
```

The full `db.batch` after the edit reads:

```ts
  await db.batch([
    db.prepare(`UPDATE user_note SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
    db.prepare(`UPDATE note_addendum SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
    db
      .prepare(`UPDATE OR REPLACE wrapup_attempt SET userId = ?2 WHERE userId = ?1`)
      .bind(fromUserId, toUserId),
    db
      .prepare(`UPDATE OR REPLACE case_session SET scope = ?2 WHERE scope = ?1`)
      .bind(fromUserId, toUserId),
    db.prepare(`UPDATE user_alias SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
  ]);
```

Note: `case_session`'s user-id column is `scope`, so its statement uses `SET scope = ... WHERE scope = ...`, unlike the `userId`-columned tables around it.

- [ ] **Step 2: Write the failing rekey + purge tests**

First add the two imports these tests use to the top of `src/worker/session.workers.test.ts` (after the `import worker from "./index";` line):

```ts
import { purgeStaleAnonUsers } from "./purge";
import { rekeyUserWork } from "./rekey";
```

Then append the tests:

```ts
describe("case_session follows the account", () => {
  test("rekey moves the clock to the linked account, guest clock winning conflicts", async () => {
    const auth = createAuth(env as unknown as Env, "http://localhost");
    const anon = (await auth.api.signInAnonymous())!.user.id;
    const google = (await auth.api.signInAnonymous())!.user.id; // stand-in linked account

    const seed = (scope: string, simNow: number) =>
      env.DB.prepare(
        `INSERT INTO case_session (scope, caseId, simNow, updatedAt) VALUES (?1, 'cholangitis001', ?2, 1)`,
      )
        .bind(scope, simNow)
        .run();
    await seed(anon, 5000); // guest's live clock
    await seed(google, 1000); // pre-existing clock on the linked account (collides)

    await rekeyUserWork(env.DB, anon, google);

    const rows = await env.DB.prepare(
      `SELECT simNow FROM case_session WHERE scope = ?1`,
    )
      .bind(google)
      .all<{ simNow: number }>();
    expect(rows.results.map((r) => r.simNow)).toEqual([5000]); // guest clock won, one row
    const gone = await env.DB.prepare(`SELECT COUNT(*) AS n FROM case_session WHERE scope = ?1`)
      .bind(anon)
      .first<{ n: number }>();
    expect(gone?.n).toBe(0);
  });

  test("purge removes an idle anon user's clock via FK cascade", async () => {
    const auth = createAuth(env as unknown as Env, "http://localhost");
    const stale = (await auth.api.signInAnonymous())!.user.id;
    await env.DB.prepare(`UPDATE session SET expiresAt = '2020-01-01T00:00:00.000Z' WHERE userId = ?1`)
      .bind(stale)
      .run();
    await env.DB.prepare(
      `INSERT INTO case_session (scope, caseId, simNow, updatedAt) VALUES (?1, 'cholangitis001', 4200, 1)`,
    )
      .bind(stale)
      .run();

    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await purgeStaleAnonUsers(env.DB, cutoff);

    expect(await env.DB.prepare(`SELECT id FROM user WHERE id = ?1`).bind(stale).first()).toBeNull();
    expect(
      await env.DB.prepare(`SELECT scope FROM case_session WHERE scope = ?1`).bind(stale).first(),
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `npm run test:workers`
Expected: the two new tests PASS (and all Task 1/2 tests still pass). The rekey test proves guest-wins on collision; the purge test proves FK cascade. The previously-unused `rekeyUserWork`/`purgeStaleAnonUsers` imports are now used.

- [ ] **Step 4: Commit**

```bash
git add src/worker/rekey.ts src/worker/session.workers.test.ts
git commit -m "feat(engine): re-key case_session on account link + prove FK-cascade purge"
```

---

### Task 4: Extend `CaseEvent`, add `AuthoredEvent`, grow the `applyEvents` fold

**Files:**
- Modify: `src/types.ts` (extend `CaseEvent`; add `AuthoredEvent`; add `events?`/`flags?` to `CaseBundle`)
- Modify: `src/lib/applyEvents.ts` (handle the four new kinds)
- Test: `src/lib/applyEvents.test.ts` (add per-kind + immutability tests)

**Interfaces:**
- Consumes: `ClinicalLab`, `ClinicalMicro`, `Encounter`, `VitalsPoint` (existing `src/types.ts`).
- Produces:
  - `CaseEvent` union extended with `{ kind: "result.release"; document: ClinicalLab | ClinicalMicro }`, `{ kind: "encounter.append"; encounter: Encounter }`, `{ kind: "vitals.append"; point: VitalsPoint }`, `{ kind: "flag.set"; key: string; value: boolean | number }`.
  - `AuthoredEvent = { at: number; seq: number; dedupeKey?: string; event: CaseEvent }`.
  - `CaseBundle.events?: AuthoredEvent[]` (authoring surface) and `CaseBundle.flags?: Record<string, boolean | number>` (runtime, written only by the fold).
  - `applyEvents` now also folds `result.release` (append doc), `encounter.append` (prepend at index 0), `vitals.append` (append to `summary.vitalsTrend`), `flag.set` (into `bundle.flags`), returning `{ ...bundle, documents, notes, encounters, summary, flags }`.

- [ ] **Step 1: Extend the `CaseEvent` union and add the new types in `src/types.ts`**

Replace the existing `CaseEvent` block (currently ends the union at `note.addendum`) with the extended union, and add `AuthoredEvent` right after it:

```ts
/**
 * A single overlay event folded onto a CaseBundle by applyEvents. Trainee work
 * (note.create / note.addendum) and authored sim-reveals (result / encounter /
 * vitals / flag) are ONE uniform stream; the fold patches the relevant bundle
 * field and recomputes `notes` from `documents`.
 */
export type CaseEvent =
  | { kind: "note.create"; note: ClinicalNote }
  | { kind: "note.addendum"; noteId: string; block: string }
  | { kind: "result.release"; document: ClinicalLab | ClinicalMicro }
  | { kind: "encounter.append"; encounter: Encounter }
  | { kind: "vitals.append"; point: VitalsPoint }
  | { kind: "flag.set"; key: string; value: boolean | number };

/**
 * One pre-authored sim-event in a case's events.ts (Model B reveal rail). The
 * engine reveals it (folds `event`) once the sim-clock reaches `at`. Ordering
 * across authored events is carried by `seq`, never derived from display strings.
 */
export type AuthoredEvent = {
  /** Sim-offset in seconds from the case anchor; revealed when at <= simNow. */
  at: number;
  /** Total fold order across authored events; author keeps monotonic with `at`. */
  seq: number;
  /** Optional handle for later suppression/dedupe (unused in v1). */
  dedupeKey?: string;
  /** The overlay event folded when this reveals. */
  event: CaseEvent;
};
```

- [ ] **Step 2: Add `events?` and `flags?` to `CaseBundle` in `src/types.ts`**

In the `CaseBundle` type, add these two optional fields (place `events` after `bloods`, and `flags` after it):

```ts
  /** Pre-authored sim-events revealed by the sim-clock (Model B). Absent = static. */
  events?: AuthoredEvent[];
  /** Runtime-only branching flags written by applyEvents (flag.set). Authored cases never set this. */
  flags?: Record<string, boolean | number>;
```

- [ ] **Step 3: Run the type-check to see `applyEvents` fail exhaustiveness**

Run: `npx tsc -b`
Expected: FAIL in `src/lib/applyEvents.ts` at the `_exhaustive: never` default case — the four new `CaseEvent` kinds are not handled. This is the compiler forcing the fold to cover them.

- [ ] **Step 4: Extend the `applyEvents` fold**

Replace the body of `applyEvents` in `src/lib/applyEvents.ts` with the version below (adds `encounters`/`summary`/`flags` locals and the four cases; keeps the identity guard and the `documents`-drives-`notes` recompute):

```ts
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
```

No import change is needed in `src/lib/applyEvents.ts`: the existing `import type { CaseBundle, CaseEvent, ClinicalNote } from "../types";` still suffices, because the new event payloads are typed inside the `CaseEvent` union in `types.ts` and the fold references only `event.document`/`event.encounter`/`event.point`/`event.key`/`event.value` (all reached through `CaseEvent`), never the payload types by name.

- [ ] **Step 5: Run the type-check to verify it compiles**

Run: `npx tsc -b`
Expected: PASS. The exhaustive switch now covers all six kinds.

- [ ] **Step 6: Write the failing per-kind fold tests**

Append to `src/lib/applyEvents.test.ts` (the file already imports `getCase`, builds `const bundle = getCase("cholangitis001")`, and has a `userNote` fixture). First extend the file's existing type import to bring in the payload types the fixtures need:

```ts
import type { ClinicalNote, ClinicalLab, Encounter, VitalsPoint } from "../types";
```

Then add fixtures + tests:

```ts
describe("applyEvents sim-reveal kinds", () => {
  const lab: ClinicalLab = {
    kind: "lab",
    id: "reveal-lab-1",
    encounterId: "enc-admission",
    title: "Repeat LFTs",
    status: "Final",
    specimen: "Blood",
    collected: "17/06/2026 06:00",
    reportedAt: "17/06/2026 07:00",
    rows: [],
  };
  const encounter: Encounter = {
    id: "reveal-enc-1",
    type: "Ward Round",
    date: "17/06/2026",
    time: "08:00",
    class: "inpatient",
    specialty: "General Surgery",
    deptAbbrev: "GSAMU",
    provider: "Team, FY2",
    description: "Day 2 review",
    status: "Open",
    location: "AMU",
  };
  const point: VitalsPoint = {
    t: "16:00",
    sys: 118,
    dia: 72,
    hr: 88,
    resp: 16,
    spo2: 98,
    tempC: 37.0,
  };

  test("result.release appends the document, notes unchanged", () => {
    const live = applyEvents(bundle, [{ kind: "result.release", document: lab }]);
    expect(live.documents.at(-1)).toEqual(lab);
    expect(live.notes).toEqual(bundle.notes);
    expect(live.documents).not.toBe(bundle.documents);
  });

  test("encounter.append prepends at index 0", () => {
    const live = applyEvents(bundle, [{ kind: "encounter.append", encounter }]);
    expect(live.encounters[0]).toEqual(encounter);
    expect(live.encounters.length).toBe(bundle.encounters.length + 1);
    expect(live.encounters).not.toBe(bundle.encounters);
  });

  test("vitals.append appends a point to summary.vitalsTrend", () => {
    const live = applyEvents(bundle, [{ kind: "vitals.append", point }]);
    expect(live.summary.vitalsTrend.at(-1)).toEqual(point);
    expect(live.summary).not.toBe(bundle.summary);
    expect(bundle.summary.vitalsTrend.at(-1)).not.toEqual(point); // input untouched
  });

  test("flag.set writes into a runtime flags map without touching the input", () => {
    const live = applyEvents(bundle, [{ kind: "flag.set", key: "ercpDone", value: true }]);
    expect(live.flags).toEqual({ ercpDone: true });
    expect(bundle.flags).toBeUndefined();
  });

  test("multiple kinds fold together, input bundle never mutates", () => {
    const beforeDocs = bundle.documents.length;
    const beforeEnc = bundle.encounters.length;
    const live = applyEvents(bundle, [
      { kind: "result.release", document: lab },
      { kind: "encounter.append", encounter },
      { kind: "vitals.append", point },
      { kind: "flag.set", key: "n", value: 2 },
    ]);
    expect(live.documents.length).toBe(beforeDocs + 1);
    expect(live.encounters.length).toBe(beforeEnc + 1);
    expect(bundle.documents.length).toBe(beforeDocs);
    expect(bundle.encounters.length).toBe(beforeEnc);
  });
});
```

- [ ] **Step 7: Run the fold tests to verify they pass (and nothing regressed)**

Run: `npm test`
Expected: PASS, including the pre-existing `applyEvents identity + immutability`, `note.create`, `note.addendum`, `workToEvents`, and hand-merge-equivalence tests (the `flags: undefined` on note-only folds is ignored by `toEqual`).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/lib/applyEvents.ts src/lib/applyEvents.test.ts
git commit -m "feat(engine): add sim-reveal CaseEvent kinds + AuthoredEvent, extend applyEvents fold"
```

---

### Task 5: Pure client reveal filter (`src/lib/reveal.ts`)

**Files:**
- Create: `src/lib/reveal.ts`
- Test: `src/lib/reveal.test.ts` (new)

**Interfaces:**
- Consumes: `AuthoredEvent`, `CaseEvent` (Task 4).
- Produces: `revealEvents(authored: AuthoredEvent[], simNow: number): CaseEvent[]` — the authored events whose `at <= simNow`, sorted by `seq`, mapped to their `event`. Pure: no wall-clock, no server, no mutation.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reveal.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { AuthoredEvent } from "../types";
import { revealEvents } from "./reveal";

function authored(at: number, seq: number, id: string): AuthoredEvent {
  return { at, seq, event: { kind: "flag.set", key: id, value: true } };
}

describe("revealEvents", () => {
  test("empty authored list yields no events", () => {
    expect(revealEvents([], 10_000)).toEqual([]);
  });

  test("reveals only events whose at <= simNow", () => {
    const list = [authored(3600, 1, "a"), authored(7200, 2, "b"), authored(10_800, 3, "c")];
    const out = revealEvents(list, 7200);
    expect(out.map((e) => (e.kind === "flag.set" ? e.key : ""))).toEqual(["a", "b"]);
  });

  test("at 0 reveals only events scheduled at or before 0", () => {
    const list = [authored(0, 1, "now"), authored(1, 2, "later")];
    expect(revealEvents(list, 0).map((e) => (e.kind === "flag.set" ? e.key : ""))).toEqual(["now"]);
  });

  test("orders revealed events by seq regardless of input order", () => {
    const list = [authored(100, 3, "third"), authored(100, 1, "first"), authored(100, 2, "second")];
    expect(revealEvents(list, 100).map((e) => (e.kind === "flag.set" ? e.key : ""))).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  test("does not mutate the input array", () => {
    const list = [authored(100, 2, "b"), authored(100, 1, "a")];
    const snapshot = list.map((e) => e.seq);
    revealEvents(list, 100);
    expect(list.map((e) => e.seq)).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- reveal`
Expected: FAIL with "Cannot find module './reveal'" (or `revealEvents is not a function`).

- [ ] **Step 3: Write the reveal filter**

Create `src/lib/reveal.ts`:

```ts
import type { AuthoredEvent, CaseEvent } from "../types";

/**
 * The client reveal rail (Model B): given a case's authored sim-events and the
 * current sim-clock, return the CaseEvents whose reveal time has arrived, in
 * deterministic fold order (by seq). Pure: no wall-clock, no server, no
 * mutation of the input. `revealEvents([], n)` is `[]`, so a static case (no
 * events.ts) folds to nothing and renders exactly as today.
 */
export function revealEvents(authored: AuthoredEvent[], simNow: number): CaseEvent[] {
  return authored
    .filter((entry) => entry.at <= simNow)
    .sort((a, b) => a.seq - b.seq)
    .map((entry) => entry.event);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- reveal`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reveal.ts src/lib/reveal.test.ts
git commit -m "feat(engine): add pure revealEvents filter (authored events by simNow)"
```

---

### Task 6: Client wiring — `api.ts` session helpers, `useCaseWork` clock, `PatientWorkspace` reveal composition

**Files:**
- Modify: `src/lib/api.ts` (add `CaseSession` type + `fetchCaseSession` + `apiPutSession`)
- Modify: `src/hooks/useCaseWork.ts` (fetch `simNow`, expose `simNow` + `advanceSim`)
- Modify: `src/components/PatientWorkspace.tsx` (compose `revealEvents(activeCase.events, simNow)` into the fold)
- Verify: `npx tsc -b`, `npm run build`, `npm run lint`, browser smoke

**Interfaces:**
- Consumes: `revealEvents` (Task 5), the `/api/cases/:caseId/session` route (Task 2), `CaseBundle.events` (Task 4).
- Produces: `CaseWorkState` gains `simNow: number` and `advanceSim(target: number): Promise<void>` (forward-only clamp, last-write-wins PUT). `PatientWorkspace` folds `[...revealed, ...trainee work]` so authored reveals sort before trainee notes. Inert this plan (no case sets `events`), so behavior is identical to today.

- [ ] **Step 1: Add the session helpers to `src/lib/api.ts`**

Append after the existing work helpers (before or after the `Alias`/`Persona` block, house style is `export const name = (...) => request<T>(...)`):

```ts
export type CaseSession = { simNow: number };

export const fetchCaseSession = (caseId: string) => request<CaseSession>(`/cases/${caseId}/session`);

export const apiPutSession = (caseId: string, simNow: number) =>
  request<CaseSession>(`/cases/${caseId}/session`, {
    method: "PUT",
    body: JSON.stringify({ simNow }),
  });
```

- [ ] **Step 2: Wire the clock into `useCaseWork`**

Modify `src/hooks/useCaseWork.ts`:

(a) Extend the imports from `../lib/api` to include the two new helpers:

```ts
import {
  ApiError,
  apiAddAddendum,
  apiCreateNote,
  apiDeleteAttempt,
  apiDeleteNote,
  apiPutAttempt,
  apiPutSession,
  apiRefileNote,
  fetchCaseSession,
  fetchCaseWork,
  type AddendumRow,
  type StoredAttempt,
} from "../lib/api";
```

(b) Add `simNow` + `advanceSim` to the `CaseWorkState` type:

```ts
export type CaseWorkState = {
  loaded: boolean;
  loadError: string | null;
  notes: ClinicalNote[];
  addenda: Record<string, string>;
  attempt: StoredAttempt | null;
  simNow: number;
  createNote(note: ClinicalNote): Promise<ClinicalNote>;
  refileNote(note: ClinicalNote): Promise<void>;
  deleteNote(id: string): Promise<void>;
  addAddendum(noteId: string, block: string): Promise<void>;
  saveAttempt(text: string, signed: boolean): Promise<void>;
  clearAttempt(): Promise<void>;
  advanceSim(target: number): Promise<void>;
};
```

(c) Add a `simNow` state cell (alongside the other `useState` calls near the top of the hook):

```ts
  const [simNow, setSimNow] = useState(0);
```

(d) Fetch the clock alongside the work in the existing mount effect. Replace the `fetchCaseWork(caseId).then(...)` call with a `Promise.all` that also fetches the session (keep the exact same `cancelled` guard and the 401-reload / loadError branches):

```ts
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCaseWork(caseId), fetchCaseSession(caseId)]).then(
      ([work, session]) => {
        if (cancelled) return;
        setNotes(work.notes);
        setAddendaRows(work.addenda);
        setAttempt(work.attempt);
        setSimNow(session.simNow);
        setLoaded(true);
      },
      (err: unknown) => {
        if (cancelled) return;
        // A 401 at mount means the session died: reload so the sign-in gate
        // shows (nothing is in flight at mount, so nothing can be lost).
        // Mutation-time 401s deliberately do NOT reload; their catch paths
        // keep the draft and show an error instead.
        if (err instanceof ApiError && err.status === 401) window.location.reload();
        else setLoadError("Couldn't load your notes from the server.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [caseId]);
```

(e) Return `simNow` and add the `advanceSim` mutator (forward-only clamp; PUT then update local state). Add `simNow` to the returned object and this method alongside the others:

```ts
    simNow,
    async advanceSim(target) {
      const next = Math.max(simNow, Math.floor(target));
      if (next === simNow) return;
      const res = await apiPutSession(caseId, next);
      setSimNow(res.simNow);
    },
```

- [ ] **Step 3: Compose reveals into the fold in `PatientWorkspace`**

Modify `src/components/PatientWorkspace.tsx`:

(a) Add the `revealEvents` import next to the existing `applyEvents`/`workToEvents` import:

```ts
import { applyEvents, workToEvents } from "../lib/applyEvents";
import { revealEvents } from "../lib/reveal";
```

(b) Replace the current `events`/`liveCase` memo block (the two lines at ~L78-79) with a three-memo version that reveals authored events by the clock and folds them BEFORE trainee work (so trainee notes sort last / newest, consistent with the `anchor`/`caseNow` stamping):

```tsx
  // Authored sim-events revealed by the server clock (Model B), plus the
  // trainee's own work, fold onto the static case through one applyEvents seam.
  // Reveals go first so trainee notes sort last (newest). With no events.ts and
  // simNow 0 this is identical to the pre-engine merge.
  const revealed = useMemo(
    () => revealEvents(activeCase.events ?? [], work.simNow),
    [activeCase.events, work.simNow],
  );
  const events = useMemo(
    () => [...revealed, ...workToEvents(userNotes, addenda)],
    [revealed, userNotes, addenda],
  );
  const liveCase = useMemo(() => applyEvents(activeCase, events), [activeCase, events]);
  const allDocuments = liveCase.documents;
  const allNotes = liveCase.notes;
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: all PASS. `tsc` confirms the new hook shape and `CaseBundle.events` optional access typecheck; `lint` confirms no unused imports (every new import is used); `build` emits `dist/client` + `dist/legend`.

- [ ] **Step 5: Apply the migration locally and browser-smoke the inert engine**

Run (if not already applied in Task 1): `npx wrangler d1 migrations apply legend-db --local`

Then run: `npm run dev` and, in the browser at `http://localhost:5173`:
1. Sign in (guest is fine), open the cholangitis001 chart.
2. Confirm the chart renders IDENTICALLY to before (Notes, Chart Review, Summary vitals, encounters all unchanged) — the engine is inert because cholangitis001 has no `events.ts`.
3. Open DevTools > Network, filter to `session`: confirm a `GET /api/cases/cholangitis001/session` returns `{"simNow":0}` on chart open (and DevTools > Application shows a `case_session` row was created — or re-open the chart and confirm the GET now hits the existing row).
4. Confirm NO console errors and NO failed requests.
5. Sign, pend, addendum, delete a note as before: all still work (the work path is unchanged; reveals are additive).

Record the result (pass/fail per check) in the commit body or a short `.superpowers/sdd/` note.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/hooks/useCaseWork.ts src/components/PatientWorkspace.tsx
git commit -m "feat(engine): wire the /session clock into useCaseWork + compose authored reveals in PatientWorkspace"
```

---

### Task 7: Full-suite verification + doc reconciliation

**Files:**
- Modify: `CLAUDE.md` (document the engine surface in the relevant bullets)
- Modify: `CASE_AUTHORING.md` (stub the `events.ts` authoring surface)
- Modify: `STATUS.md` (Plan 3 done; Plan 4 next)

**Interfaces:**
- Consumes: everything built in Tasks 1-6.
- Produces: green full suite + docs that match the shipped code (house rule: docs never drift from code).

- [ ] **Step 1: Run the complete verification suite**

Run each and confirm green:
- `npx tsc -b` (type-check)
- `npm test` (node pool: applyEvents + reveal + rubric + progress-autofill leak-guard + all lib)
- `npm run test:workers` (real-D1: the new session schema/route/rekey/purge tests + all prior worker tests)
- `npm run lint`
- `npm run build`

Expected: all PASS. Note the new test counts (node pool gains the reveal suite + applyEvents sim-reveal tests; workers pool gains `session.workers.test.ts`).

- [ ] **Step 2: Update `CLAUDE.md`**

In the `src/lib/` bullet, extend the `applyEvents.ts` description to note the sim-reveal kinds and add `reveal.ts`:

> `applyEvents.ts` (the single overlay seam: pure immutable `applyEvents(bundle, events)` fold + `workToEvents` adapter; patches `documents`/`encounters`/`summary.vitalsTrend`/`flags`, recomputes `notes`; `CaseEvent` kinds `note.create`/`note.addendum`/`result.release`/`encounter.append`/`vitals.append`/`flag.set`), `reveal.ts` (pure `revealEvents(authored, simNow)`: a case's authored `events.ts` filtered to `at <= simNow`, sorted by `seq`).

In the `src/worker/` bullet, add `session.ts` next to `work.ts`:

> `session.ts` (session-gated per-case sim clock, Model B: `GET`/`PUT /cases/:caseId/session` over the ONE `case_session` table, column `scope` = user id; clones `work.ts`'s session middleware). `rekey.ts` also re-keys `case_session` (`UPDATE OR REPLACE ... SET scope`).

Add a Gotcha bullet:

> **The sim clock is server-persisted, the reveal is client-side (Model B).** `case_session(scope, caseId, simNow, updatedAt)` (migration 0004) stores only `simNow` (a sim-offset in seconds from `CaseBundle.anchor`); the client reads it via `useCaseWork().simNow`, filters the case's authored `events.ts` (`CaseBundle.events?: AuthoredEvent[]`) with `revealEvents`, and folds via `applyEvents`. Column is `scope` (value = user id today; fork D carries the name for multiplayer). Advance is client-driven (`useCaseWork().advanceSim`, forward-only, last-write-wins PUT). No case authors `events` yet (Plan 4).

- [ ] **Step 3: Stub the `events.ts` authoring surface in `CASE_AUTHORING.md`**

Add a short "Dynamic events (optional, `events.ts`)" section describing `AuthoredEvent` (`{ at, seq, dedupeKey?, event }`), the `CaseEvent` reveal kinds, that `at`/`simNow` are sim-offset seconds from the case `anchor`, and that a case opts in by importing its `events.ts` and setting `events:` on its registry entry. Note the full authored example (cholangitis001 micro Final reveal, NPC round notes, vitals trend, chronos intents) lands in Plan 4.

- [ ] **Step 4: Update `STATUS.md`**

- Move "Dynamic Patients Plan 3 (server engine, Model B)" from "Next concrete step" to Done, with the commit range.
- Set the new "Next concrete step" to Plan 4 (product loop: cholangitis001 `events.ts` authoring incl. the micro Final reveal + NPC round notes + vitals trend + chronos intents; sign-advances-clock + chronos wiring calling `advanceSim`; rubric-fairness cursor on the attempt; NPC suppression by `encounterId`; contribution tracker; extended leak-guard per reachable state; CI timeline walker).
- Record the **Plan 4 authoring caveat (from grounding Flag 1):** cholangitis001's static note `timestamp` epochs sit 24h behind the `anchor` (notes on 15/06, anchor 16/06 17:00 UTC). The engine is unaffected (it compares `at`/`simNow` offsets, never static epochs), but when authoring `events.ts` `at` offsets and reasoning about "N hours since admission," decide deliberately whether the anchor or the static epochs are canonical, and keep reveal `at` offsets measured from the `anchor`.
- Note the outstanding Ryan-gated ship gate: remote migration 0004 + `npm run deploy` (NOT done in this plan).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md CASE_AUTHORING.md STATUS.md
git commit -m "docs: reconcile CLAUDE/CASE_AUTHORING/STATUS with the Plan 3 engine"
```

---

## Self-Review (completed against DYNAMIC_PATIENTS_SPEC.md §5-§7, §15 and the STATUS "Next concrete step")

**Spec coverage (Plan 3 scope = the engine):**
- §5.1 ONE table `case_session`, Model B, column `scope`, FK cascade, lazy create at 0 → Task 1 + Task 2. ✓
- §5.2 rekey `UPDATE OR REPLACE case_session SET scope` → Task 3. ✓
- §5.3 `applyEvents` pure/immutable, patches `documents` + recomputes `notes`, ordering by `seq` (carried on `AuthoredEvent`, applied via reveal-filter sort) → Task 4 + Task 5. ✓
- §5.4 clock rail (GET lazily creates + returns `simNow`; PUT last-write-wins) + reveal rail (client filters `events.ts` by `at <= simNow`) + client-driven advance (`advanceSim`) → Tasks 2, 5, 6. ✓
- §6 event kinds `result.release`/`encounter.append`/`vitals.append`/`flag.set` (+ existing note kinds) → Task 4. `encounter.append` prepends at index 0 with `group` omitted per §6. ✓
- §7 `simNow`/`at` are sim-offset seconds from `anchor`; the engine never trusts display strings → Global Constraints + Tasks 4/5. ✓
- §15 fork D (`scope` now, value = user id), Model B (no `case_event` table) → honored throughout. ✓

**Deliberately deferred to Plan 4 (out of this plan, flagged in Task 7):** chronos matcher (§8), NPC auto-progression + `encounterId` suppression (§9), rubric-fairness cursor on the attempt + extended leak-guard per reachable state (§10), cholangitis001 `events.ts` content incl. the micro Final reveal (§11), CI timeline walker (§11). None require re-architecture: chronos/sign call the existing `advanceSim`; suppression is a one-arg refinement of `revealEvents`; the fold and clock are stable.

**Placeholder scan:** every code step contains complete, compilable code; every command has an expected result. No TBD/TODO. ✓

**Type consistency:** `revealEvents(authored, simNow)` signature is identical in Task 5 (definition) and Task 6 (call site). `advanceSim(target)` / `simNow` on `CaseWorkState` match between Task 6's type edit and its return edit. `CaseEvent` kind names (`result.release`, `encounter.append`, `vitals.append`, `flag.set`) are identical across Task 4's union, the fold, the tests, and Task 5's fixtures. `AuthoredEvent` fields (`at`, `seq`, `dedupeKey?`, `event`) match between the type (Task 4), the reveal filter (Task 5), and `CaseBundle.events` (Task 4). Column name `scope` is consistent across the migration (Task 1), router (Task 2), rekey line (Task 3), and every test. ✓
