# Phase 3: Server-side notes/addenda/attempts — Implementation Plan

> **EXECUTED AND SHIPPED 2026-07-10.** This plan is a historical record: all
> tasks T1-T13 are done including the Ryan-gated ship (remote migrations 0002
> and 0003 applied, deployed, live-verified). Checkboxes below were tracked in
> the ledger (.superpowers/sdd/progress.md), not ticked here. Current state
> lives in STATUS.md. Phase 4 gets a fresh PLAN.md.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Spec: `SPEC.md` (phase 3, approved 2026-07-10). Execution ledger: `.superpowers/sdd/progress.md`. Phase 2 plan is historical (git: PLAN.md @ HEAD~).

**Goal:** Move trainee notes, addenda, and wrap-up attempts from localStorage to D1, owned by the better-auth `user.id`, with guest re-key on Google link and a daily anon purge.

**Architecture:** New Hono sub-router `src/worker/work.ts` (session-gated CRUD over three new D1 tables, JSON note payloads), a `useCaseWork(caseId)` client hook replacing the localStorage stores in `PatientWorkspace`, `onLinkAccount` re-keys guest rows before the anonymous user is deleted, and a cron-triggered purge.

**Tech Stack:** Hono, better-auth 1.6 (native D1), Cloudflare D1 + cron triggers, React 19, vitest (node pool for pure libs, vitest-pool-workers for real-D1 API tests).

## Global Constraints

- Ownership is ALWAYS the better-auth `user.id` column, never `hcpId` (SPEC decision 5).
- Worker code never imports SPA code and vice versa (two TS programs). Wire types are duplicated on each side, following the `authClient.ts` precedent.
- No new dependencies. Validation is hand-rolled; SQL is raw D1 prepared statements.
- Migration files follow `migrations/0001_better_auth_init.sql` style: lowercase SQL, camelCase quoted column names.
- `npx wrangler d1 migrations apply legend-db --local` for the local dev DB; `--remote` is Ryan-gated (Task 13 only).
- Absolute display times, DD/MM formats (existing convention); epoch-ms integers in new DB columns.
- Commit after every task (never leave verified work uncommitted).
- Run `npm run test:workers` for worker tasks, `npm test` for lib tasks, `npx tsc -b` always.
- Docs/commit prose: no em dashes.

---

### Task 1: Migration 0002 (three work tables) + FK cascade proof

**Files:**
- Create: `migrations/0002_user_work.sql`
- Create: `src/worker/work.workers.test.ts` (first test only)

**Interfaces:**
- Produces: tables `user_note`, `note_addendum`, `wrapup_attempt` with the exact columns below. Every later worker task queries them.

- [ ] **Step 1: Write the migration**

```sql
-- Migration number: 0002 	 2026-07-10

create table "user_note" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "caseId" text not null, "status" text not null, "payload" text not null, "createdAt" integer not null, "updatedAt" integer not null);

create index "user_note_userId_caseId_idx" on "user_note" ("userId", "caseId");

create table "note_addendum" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "caseId" text not null, "noteId" text not null, "body" text not null, "createdAt" integer not null);

create index "note_addendum_userId_caseId_idx" on "note_addendum" ("userId", "caseId");

create table "wrapup_attempt" ("userId" text not null references "user" ("id") on delete cascade, "caseId" text not null, "text" text not null, "at" text not null, "signed" integer not null, "updatedAt" integer not null, primary key ("userId", "caseId"));
```

`status` is `'signed' | 'incomplete'`. `payload` is the full `ClinicalNote` JSON (display truth); `status` is mirrored into its own column for querying. `at` is the client-formatted DD/MM HH:MM stamp (display-only, matches the current `StoredAttempt`).

- [ ] **Step 2: Write the failing cascade test**

`src/worker/work.workers.test.ts` (migrations auto-apply via `test/apply-migrations.ts`):

```ts
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { createAuth } from "./auth";

describe("user_work schema", () => {
  test("deleting a user cascades to their work rows", async () => {
    const auth = createAuth(env as unknown as Env, "http://localhost");
    const res = await auth.api.signInAnonymous();
    const userId = res!.user.id;

    await env.DB.prepare(
      `INSERT INTO user_note (id, userId, caseId, status, payload, createdAt, updatedAt)
       VALUES ('n1', ?1, 'cholangitis001', 'signed', '{}', 1, 1)`,
    ).bind(userId).run();
    await env.DB.prepare(
      `INSERT INTO note_addendum (id, userId, caseId, noteId, body, createdAt)
       VALUES ('a1', ?1, 'cholangitis001', 'n1', 'x', 1)`,
    ).bind(userId).run();
    await env.DB.prepare(
      `INSERT INTO wrapup_attempt (userId, caseId, text, at, signed, updatedAt)
       VALUES (?1, 'cholangitis001', 'x', '10/07 12:00', 1, 1)`,
    ).bind(userId).run();

    await env.DB.prepare(`DELETE FROM user WHERE id = ?1`).bind(userId).run();

    for (const table of ["user_note", "note_addendum", "wrapup_attempt"]) {
      const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE userId = ?1`)
        .bind(userId)
        .first<{ n: number }>();
      expect(row?.n).toBe(0);
    }
  });
});
```

- [ ] **Step 3: Run with the migration file DELETED (or stashed), verify the test fails** — `npm run test:workers`. Expected: FAIL with `no such table: user_note`. (This proves the test needs the migration; restore the file after.)
- [ ] **Step 4: Run with the migration present, verify PASS** — `npm run test:workers` (3 tests total: 2 existing auth + this one).
- [ ] **Step 5: Apply locally for the dev server** — `npx wrangler d1 migrations apply legend-db --local`. Expected output lists `0002_user_work.sql` as applied.
- [ ] **Step 6: Commit** — `git add migrations src/worker/work.workers.test.ts && git commit -m "Phase 3 T1: user work tables (user_note, note_addendum, wrapup_attempt)"`

---

### Task 2: work router — session middleware + GET /work (empty case)

**Files:**
- Create: `src/worker/work.ts`
- Modify: `src/worker/index.ts`
- Test: `src/worker/work.workers.test.ts`

**Interfaces:**
- Consumes: `createAuth(env, origin)` from `./auth`; Task 1 tables.
- Produces: `export const work: Hono` mounted under `/api`; `GET /api/cases/:caseId/work` returning `{ notes: <ClinicalNote payloads>[], addenda: {noteId,body,createdAt}[], attempt: {text,at,signed}|null }`; the `userId` Hono variable for later routes. Test helpers `anonCookie()` and `callWorker(path, init)` reused by Tasks 3-7.

- [ ] **Step 1: Write the failing tests** (append to `work.workers.test.ts`):

```ts
import { applySetCookies } from "better-auth/cookies";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
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

describe("GET /api/cases/:caseId/work", () => {
  test("401 without a session", async () => {
    const res = await callWorker("/api/cases/cholangitis001/work");
    expect(res.status).toBe(401);
  });

  test("empty work for a fresh user", async () => {
    const cookie = await anonCookie();
    const res = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notes: [], addenda: [], attempt: null });
  });
});
```

(If `tsc` accepts `Request`/`Response` without the casts, drop them. In Task 7 the default export becomes an `ExportedHandler` object; until then `worker` is the Hono app, whose `.fetch(req, env, ctx)` has the same shape, so these helpers survive unchanged.)

- [ ] **Step 2: Run, verify FAIL** — `npm run test:workers`. Expected: 404 (route missing), not 401.
- [ ] **Step 3: Implement `src/worker/work.ts`**

```ts
import { Hono } from "hono";
import { createAuth } from "./auth";

/**
 * Session-gated CRUD for the trainee's work (notes, addenda, wrap-up
 * attempts). Ownership is always the better-auth user id; the hcpId inside
 * a note payload is display data only.
 */
type WorkEnv = { Bindings: Env; Variables: { userId: string } };

export const work = new Hono<WorkEnv>();

work.use("*", async (c, next) => {
  const auth = createAuth(c.env, new URL(c.req.url).origin);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

work.get("/cases/:caseId/work", async (c) => {
  const userId = c.get("userId");
  const caseId = c.req.param("caseId");
  const [notes, addenda, attempt] = await Promise.all([
    c.env.DB.prepare(
      `SELECT payload FROM user_note WHERE userId = ?1 AND caseId = ?2 ORDER BY createdAt`,
    ).bind(userId, caseId).all<{ payload: string }>(),
    c.env.DB.prepare(
      `SELECT noteId, body, createdAt FROM note_addendum WHERE userId = ?1 AND caseId = ?2 ORDER BY createdAt`,
    ).bind(userId, caseId).all<{ noteId: string; body: string; createdAt: number }>(),
    c.env.DB.prepare(
      `SELECT text, at, signed FROM wrapup_attempt WHERE userId = ?1 AND caseId = ?2`,
    ).bind(userId, caseId).first<{ text: string; at: string; signed: number }>(),
  ]);
  return c.json({
    notes: notes.results.map((r) => JSON.parse(r.payload) as unknown),
    addenda: addenda.results,
    attempt: attempt ? { text: attempt.text, at: attempt.at, signed: attempt.signed === 1 } : null,
  });
});
```

- [ ] **Step 4: Mount it in `src/worker/index.ts`.** Order matters: `/auth/*` and `/health` are registered BEFORE `app.route("/", work)`, so the work middleware never runs for them.

```ts
import { Hono } from "hono";
import { createAuth } from "./auth";
import { work } from "./work";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.on(["GET", "POST"], "/auth/*", (c) =>
  createAuth(c.env, new URL(c.req.url).origin).handler(c.req.raw),
);

app.get("/health", async (c) => {
  let db = false;
  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    db = row?.ok === 1;
  } catch {
    // Health must answer even when the DB binding is missing or broken.
  }
  return c.json({ ok: true, db });
});

app.route("/", work);

export default app;
```

- [ ] **Step 5: Run, verify PASS** — `npm run test:workers` (5 tests). Also `npx tsc -b`.
- [ ] **Step 6: Commit** — `git commit -m "Phase 3 T2: session-gated work router, GET case work"`

---

### Task 3: POST note (Sign/Pend) + cross-user isolation

**Files:**
- Modify: `src/worker/work.ts`
- Test: `src/worker/work.workers.test.ts`

**Interfaces:**
- Consumes: Task 2 middleware and test helpers.
- Produces: `POST /api/cases/:caseId/notes` with body `{ status: "signed"|"incomplete", payload: object }`; responds 201 with the stored payload (server-assigned `payload.id` = row id, a UUID). Later tasks rely on `payload.id` being the row id.

- [ ] **Step 1: Failing tests**

```ts
describe("POST /api/cases/:caseId/notes", () => {
  test("creates, assigns a server id, and roundtrips through GET", async () => {
    const cookie = await anonCookie();
    const payload = { kind: "note", noteType: "Progress Note", status: "signed", body: "AKI resolving" };
    const res = await callWorker("/api/cases/cholangitis001/notes", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ status: "signed", payload }),
    });
    expect(res.status).toBe(201);
    const stored = (await res.json()) as { id: string; body: string };
    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.body).toBe("AKI resolving");

    const workRes = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie } });
    const data = (await workRes.json()) as { notes: { id: string }[] };
    expect(data.notes.map((n) => n.id)).toEqual([stored.id]);
  });

  test("rejects a malformed body", async () => {
    const cookie = await anonCookie();
    const res = await callWorker("/api/cases/cholangitis001/notes", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ status: "published", payload: null }),
    });
    expect(res.status).toBe(400);
  });

  test("one user's notes are invisible to another", async () => {
    const cookieA = await anonCookie();
    const cookieB = await anonCookie();
    await callWorker("/api/cases/cholangitis001/notes", {
      method: "POST",
      headers: { cookie: cookieA, "content-type": "application/json" },
      body: JSON.stringify({ status: "incomplete", payload: { body: "mine" } }),
    });
    const res = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie: cookieB } });
    const data = (await res.json()) as { notes: unknown[] };
    expect(data.notes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL (404)** — `npm run test:workers`
- [ ] **Step 3: Implement** (append to `work.ts`):

```ts
const NOTE_STATUSES = new Set(["signed", "incomplete"]);

function parseNoteBody(raw: unknown): { status: string; payload: Record<string, unknown> } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { status, payload } = raw as { status?: unknown; payload?: unknown };
  if (typeof status !== "string" || !NOTE_STATUSES.has(status)) return null;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  return { status, payload: payload as Record<string, unknown> };
}

work.post("/cases/:caseId/notes", async (c) => {
  const parsed = parseNoteBody(await c.req.json().catch(() => null));
  if (!parsed) return c.json({ error: "bad request" }, 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  // The row id is the note's identity everywhere, including inside the payload.
  const payload = { ...parsed.payload, id, status: parsed.status };
  await c.env.DB.prepare(
    `INSERT INTO user_note (id, userId, caseId, status, payload, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  )
    .bind(id, c.get("userId"), c.req.param("caseId"), parsed.status, JSON.stringify(payload), now)
    .run();
  return c.json(payload, 201);
});
```

- [ ] **Step 4: Run, verify PASS** — `npm run test:workers`; `npx tsc -b`
- [ ] **Step 5: Commit** — `git commit -m "Phase 3 T3: POST user note with server-assigned id"`

---

### Task 4: PUT /notes/:id (refile) + DELETE /notes/:id, ownership-checked

**Files:**
- Modify: `src/worker/work.ts`
- Test: `src/worker/work.workers.test.ts`

**Interfaces:**
- Consumes: Tasks 2-3.
- Produces: `PUT /api/notes/:id` body `{ status, payload }` → 200 with the stored payload, 404 if not the caller's note; `DELETE /api/notes/:id` → 204, 404 if not the caller's note.

- [ ] **Step 1: Failing tests**

```ts
async function createNote(cookie: string, body = "v1", status = "incomplete") {
  const res = await callWorker("/api/cases/cholangitis001/notes", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ status, payload: { body } }),
  });
  return (await res.json()) as { id: string };
}

describe("PUT and DELETE /api/notes/:id", () => {
  test("refile replaces the payload in place", async () => {
    const cookie = await anonCookie();
    const note = await createNote(cookie);
    const res = await callWorker(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ status: "signed", payload: { id: note.id, body: "v2" } }),
    });
    expect(res.status).toBe(200);
    const workRes = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie } });
    const data = (await workRes.json()) as { notes: { id: string; body: string; status: string }[] };
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0]).toMatchObject({ id: note.id, body: "v2", status: "signed" });
  });

  test("cannot refile or delete another user's note", async () => {
    const owner = await anonCookie();
    const attacker = await anonCookie();
    const note = await createNote(owner);
    const put = await callWorker(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { cookie: attacker, "content-type": "application/json" },
      body: JSON.stringify({ status: "signed", payload: { body: "stolen" } }),
    });
    expect(put.status).toBe(404);
    const del = await callWorker(`/api/notes/${note.id}`, { method: "DELETE", headers: { cookie: attacker } });
    expect(del.status).toBe(404);
  });

  test("delete removes the note", async () => {
    const cookie = await anonCookie();
    const note = await createNote(cookie);
    const del = await callWorker(`/api/notes/${note.id}`, { method: "DELETE", headers: { cookie } });
    expect(del.status).toBe(204);
    const workRes = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie } });
    expect(((await workRes.json()) as { notes: unknown[] }).notes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npm run test:workers`
- [ ] **Step 3: Implement**

```ts
work.put("/notes/:id", async (c) => {
  const parsed = parseNoteBody(await c.req.json().catch(() => null));
  if (!parsed) return c.json({ error: "bad request" }, 400);
  const id = c.req.param("id");
  const payload = { ...parsed.payload, id, status: parsed.status };
  const res = await c.env.DB.prepare(
    `UPDATE user_note SET status = ?1, payload = ?2, updatedAt = ?3 WHERE id = ?4 AND userId = ?5`,
  )
    .bind(parsed.status, JSON.stringify(payload), Date.now(), id, c.get("userId"))
    .run();
  if (res.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json(payload);
});

work.delete("/notes/:id", async (c) => {
  const res = await c.env.DB.prepare(
    `DELETE FROM user_note WHERE id = ?1 AND userId = ?2`,
  )
    .bind(c.req.param("id"), c.get("userId"))
    .run();
  if (res.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});
```

- [ ] **Step 4: Run, verify PASS**; `npx tsc -b`
- [ ] **Step 5: Commit** — `git commit -m "Phase 3 T4: refile and delete user notes, ownership-checked"`

---

### Task 5: Addenda POST + attempt PUT/DELETE

**Files:**
- Modify: `src/worker/work.ts`
- Test: `src/worker/work.workers.test.ts`

**Interfaces:**
- Consumes: Tasks 2-4.
- Produces: `POST /api/notes/:id/addenda` body `{ caseId, body }` → 201 `{ noteId, body, createdAt }`; `PUT /api/cases/:caseId/attempt` body `{ text, at, signed }` → 200 (upsert); `DELETE /api/cases/:caseId/attempt` → 204. Addenda are legal against ANY note id (static case notes included), so there is deliberately no note-existence check.

- [ ] **Step 1: Failing tests**

```ts
describe("addenda and attempts", () => {
  test("addendum rows accumulate and come back in order", async () => {
    const cookie = await anonCookie();
    for (const body of ["first", "second"]) {
      const res = await callWorker("/api/notes/note-adm-1/addenda", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ caseId: "cholangitis001", body }),
      });
      expect(res.status).toBe(201);
    }
    const workRes = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie } });
    const data = (await workRes.json()) as { addenda: { noteId: string; body: string }[] };
    expect(data.addenda.map((a) => a.body)).toEqual(["first", "second"]);
    expect(data.addenda[0].noteId).toBe("note-adm-1");
  });

  test("attempt upserts and clears", async () => {
    const cookie = await anonCookie();
    const put = (text: string) =>
      callWorker("/api/cases/cholangitis001/attempt", {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ text, at: "10/07 12:00", signed: true }),
      });
    expect((await put("v1")).status).toBe(200);
    expect((await put("v2")).status).toBe(200);
    let workRes = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie } });
    expect(((await workRes.json()) as { attempt: { text: string } }).attempt.text).toBe("v2");

    const del = await callWorker("/api/cases/cholangitis001/attempt", { method: "DELETE", headers: { cookie } });
    expect(del.status).toBe(204);
    workRes = await callWorker("/api/cases/cholangitis001/work", { headers: { cookie } });
    expect(((await workRes.json()) as { attempt: unknown }).attempt).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**
- [ ] **Step 3: Implement**

```ts
work.post("/notes/:id/addenda", async (c) => {
  const raw = (await c.req.json().catch(() => null)) as { caseId?: unknown; body?: unknown } | null;
  if (!raw || typeof raw.caseId !== "string" || typeof raw.body !== "string" || raw.body.length === 0)
    return c.json({ error: "bad request" }, 400);
  const row = {
    id: crypto.randomUUID(),
    noteId: c.req.param("id"),
    body: raw.body,
    createdAt: Date.now(),
  };
  await c.env.DB.prepare(
    `INSERT INTO note_addendum (id, userId, caseId, noteId, body, createdAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(row.id, c.get("userId"), raw.caseId, row.noteId, row.body, row.createdAt)
    .run();
  return c.json({ noteId: row.noteId, body: row.body, createdAt: row.createdAt }, 201);
});

work.put("/cases/:caseId/attempt", async (c) => {
  const raw = (await c.req.json().catch(() => null)) as
    | { text?: unknown; at?: unknown; signed?: unknown }
    | null;
  if (!raw || typeof raw.text !== "string" || typeof raw.at !== "string" || typeof raw.signed !== "boolean")
    return c.json({ error: "bad request" }, 400);
  await c.env.DB.prepare(
    `INSERT INTO wrapup_attempt (userId, caseId, text, at, signed, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (userId, caseId) DO UPDATE SET text = ?3, at = ?4, signed = ?5, updatedAt = ?6`,
  )
    .bind(c.get("userId"), c.req.param("caseId"), raw.text, raw.at, raw.signed ? 1 : 0, Date.now())
    .run();
  return c.json({ ok: true });
});

work.delete("/cases/:caseId/attempt", async (c) => {
  await c.env.DB.prepare(
    `DELETE FROM wrapup_attempt WHERE userId = ?1 AND caseId = ?2`,
  )
    .bind(c.get("userId"), c.req.param("caseId"))
    .run();
  return c.body(null, 204);
});
```

- [ ] **Step 4: Run, verify PASS**; `npx tsc -b`
- [ ] **Step 5: Commit** — `git commit -m "Phase 3 T5: addenda and wrap-up attempt endpoints"`

---

### Task 6: Guest-to-Google re-key (onLinkAccount)

**Files:**
- Create: `src/worker/rekey.ts`
- Modify: `src/worker/auth.ts`, `auth.cli.ts`
- Test: `src/worker/work.workers.test.ts`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `rekeyUserWork(db: D1Database, fromUserId: string, toUserId: string): Promise<void>`, wired into `anonymous({ onLinkAccount })`.

**Why it must be inside onLinkAccount:** the anonymous plugin DELETES the anonymous user after linking, and our FKs cascade. `onLinkAccount` fires before that deletion; re-keying there moves the rows out of the blast radius.

- [ ] **Step 1: Failing test** (tests the helper directly; driving a real Google link in miniflare is not possible):

```ts
import { rekeyUserWork } from "./rekey";

describe("rekeyUserWork", () => {
  test("moves all three tables to the new user, guest attempt winning conflicts", async () => {
    const auth = createAuth(env as unknown as Env, "http://localhost");
    const anon = (await auth.api.signInAnonymous())!.user.id;
    const google = (await auth.api.signInAnonymous())!.user.id; // stand-in row for the linked account

    const seed = (userId: string, text: string) =>
      env.DB.prepare(
        `INSERT INTO wrapup_attempt (userId, caseId, text, at, signed, updatedAt)
         VALUES (?1, 'cholangitis001', ?2, '10/07 12:00', 1, 1)`,
      ).bind(userId, text).run();
    await seed(anon, "guest attempt");
    await seed(google, "old google attempt");
    await env.DB.prepare(
      `INSERT INTO user_note (id, userId, caseId, status, payload, createdAt, updatedAt)
       VALUES ('rk-n1', ?1, 'cholangitis001', 'signed', '{}', 1, 1)`,
    ).bind(anon).run();
    await env.DB.prepare(
      `INSERT INTO note_addendum (id, userId, caseId, noteId, body, createdAt)
       VALUES ('rk-a1', ?1, 'cholangitis001', 'rk-n1', 'x', 1)`,
    ).bind(anon).run();

    await rekeyUserWork(env.DB, anon, google);

    const note = await env.DB.prepare(`SELECT userId FROM user_note WHERE id = 'rk-n1'`).first<{ userId: string }>();
    expect(note?.userId).toBe(google);
    const add = await env.DB.prepare(`SELECT userId FROM note_addendum WHERE id = 'rk-a1'`).first<{ userId: string }>();
    expect(add?.userId).toBe(google);
    const attempts = await env.DB.prepare(
      `SELECT text FROM wrapup_attempt WHERE userId = ?1`,
    ).bind(google).all<{ text: string }>();
    expect(attempts.results.map((r) => r.text)).toEqual(["guest attempt"]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** (module missing)
- [ ] **Step 3: Implement `src/worker/rekey.ts`**

```ts
/**
 * Move a guest's work to the account they just linked. Runs inside
 * onLinkAccount, BEFORE the anonymous plugin deletes the anonymous user
 * (whose deletion would cascade the rows away). UPDATE OR REPLACE on
 * wrapup_attempt: if the target account already has an attempt for the same
 * case, the guest's (their live session's) attempt wins.
 */
export async function rekeyUserWork(
  db: D1Database,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await db.batch([
    db.prepare(`UPDATE user_note SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
    db.prepare(`UPDATE note_addendum SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
    db
      .prepare(`UPDATE OR REPLACE wrapup_attempt SET userId = ?2 WHERE userId = ?1`)
      .bind(fromUserId, toUserId),
  ]);
}
```

- [ ] **Step 4: Wire into `src/worker/auth.ts`** (only the plugins line changes):

```ts
import { rekeyUserWork } from "./rekey";
// ...
    plugins: [
      anonymous({
        emailDomainName: "legend.local",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await rekeyUserWork(env.DB, anonymousUser.user.id, newUser.user.id);
        },
      }),
    ],
```

**Keep `auth.cli.ts` in sync** (its options must stay identical to `createAuth`'s so CLI schema generation stays truthful): add the same `anonymous({ emailDomainName: "legend.local", onLinkAccount: async () => {} })` shape there (no-op body; its stub DB has no work tables). `onLinkAccount` does not affect the generated schema, so `migrations/` output is unchanged; note the sync in a comment.

- [ ] **Step 5: Run, verify PASS** — `npm run test:workers`; `npx tsc -b`
- [ ] **Step 6: Commit** — `git commit -m "Phase 3 T6: re-key guest work to the linked account"`

---

### Task 7: Anon purge (cron)

**Files:**
- Create: `src/worker/purge.ts`
- Modify: `src/worker/index.ts`, `wrangler.jsonc`
- Test: `src/worker/work.workers.test.ts`

**Interfaces:**
- Consumes: better-auth `user`/`session` tables.
- Produces: `purgeStaleAnonUsers(db: D1Database, cutoffIso: string): Promise<number>`; the worker default export becomes `{ fetch, scheduled }`.

- [ ] **Step 1: Failing tests.** The first test pins the date format the purge comparison depends on (better-auth writes ISO-8601 strings); if better-auth ever changes it, this fails loudly instead of the purge silently matching nothing.

```ts
import { purgeStaleAnonUsers } from "./purge";

describe("purgeStaleAnonUsers", () => {
  test("session expiry is stored as an ISO string (purge comparison depends on it)", async () => {
    await anonCookie();
    const row = await env.DB.prepare(`SELECT expiresAt FROM session LIMIT 1`).first<{ expiresAt: string }>();
    expect(String(row?.expiresAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("purges anon users with no live session, keeps active ones", async () => {
    const auth = createAuth(env as unknown as Env, "http://localhost");
    const stale = (await auth.api.signInAnonymous())!.user.id;
    const active = (await auth.api.signInAnonymous())!.user.id;
    await env.DB.prepare(`UPDATE session SET expiresAt = '2020-01-01T00:00:00.000Z' WHERE userId = ?1`)
      .bind(stale)
      .run();
    await env.DB.prepare(
      `INSERT INTO user_note (id, userId, caseId, status, payload, createdAt, updatedAt)
       VALUES ('stale-n1', ?1, 'cholangitis001', 'signed', '{}', 1, 1)`,
    ).bind(stale).run();

    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await purgeStaleAnonUsers(env.DB, cutoff);

    expect(await env.DB.prepare(`SELECT id FROM user WHERE id = ?1`).bind(stale).first()).toBeNull();
    expect(await env.DB.prepare(`SELECT id FROM user_note WHERE id = 'stale-n1'`).first()).toBeNull();
    expect(await env.DB.prepare(`SELECT id FROM user WHERE id = ?1`).bind(active).first()).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**
- [ ] **Step 3: Implement `src/worker/purge.ts`**

```ts
/**
 * Delete anonymous users whose every session expired before the cutoff
 * (no activity in ~30 days; guest sessions live 7 days, so an active guest
 * always has a fresher session). FK cascades remove their notes, addenda,
 * and attempts. Google-linked users are never anonymous: the anonymous
 * plugin deletes the anon row at link time (after Task 6's re-key).
 */
export async function purgeStaleAnonUsers(db: D1Database, cutoffIso: string): Promise<number> {
  const res = await db
    .prepare(
      `DELETE FROM user WHERE isAnonymous = 1 AND NOT EXISTS (
         SELECT 1 FROM session WHERE session.userId = user.id AND session.expiresAt > ?1
       )`,
    )
    .bind(cutoffIso)
    .run();
  return res.meta.changes;
}
```

- [ ] **Step 4: Export a scheduled handler from `src/worker/index.ts`** (replace the bottom `export default app`):

```ts
import { purgeStaleAnonUsers } from "./purge";

const PURGE_AFTER_DAYS = 30;

export default {
  fetch: app.fetch,
  scheduled: async (_controller, env) => {
    const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86_400_000).toISOString();
    await purgeStaleAnonUsers(env.DB, cutoff);
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 5: Add the cron to `wrangler.jsonc`** (after `"d1_databases"`):

```jsonc
  "triggers": {
    "crons": ["17 3 * * *"]
  }
```

Run `npm run cf-typegen` (wrangler config changed; crons add no bindings but this keeps the generated types honest).

- [ ] **Step 6: Run, verify PASS** — `npm run test:workers`; `npx tsc -b`; `npm run build` (the export-shape change must not break the Cloudflare vite plugin); `npm run dev` still serves the SPA + `/api/health`.
- [ ] **Step 7: Commit** — `git commit -m "Phase 3 T7: daily purge of stale anonymous users"`

---

### Task 8: Client lib — api.ts, foldAddenda, buildUserNote id handoff

**Files:**
- Create: `src/lib/api.ts`
- Modify: `src/lib/userNotes.ts`
- Test: `src/lib/userNotes.test.ts`

**Interfaces:**
- Consumes: worker routes (Tasks 2-5).
- Produces (used by Tasks 9-10):

```ts
// api.ts
export type StoredAttempt = { text: string; at: string; signed: boolean };
export type AddendumRow = { noteId: string; body: string; createdAt: number };
export type CaseWork = { notes: ClinicalNote[]; addenda: AddendumRow[]; attempt: StoredAttempt | null };
export class ApiError extends Error { status: number }
export function fetchCaseWork(caseId: string): Promise<CaseWork>
export function apiCreateNote(caseId: string, note: ClinicalNote): Promise<ClinicalNote>
export function apiRefileNote(note: ClinicalNote): Promise<ClinicalNote>
export function apiDeleteNote(id: string): Promise<void>
export function apiAddAddendum(caseId: string, noteId: string, body: string): Promise<AddendumRow>
export function apiPutAttempt(caseId: string, attempt: StoredAttempt): Promise<void>
export function apiDeleteAttempt(caseId: string): Promise<void>
// userNotes.ts addition
export function foldAddenda(rows: { noteId: string; body: string; createdAt: number }[]): Record<string, string>
```

- [ ] **Step 1: Failing node tests** (append to `src/lib/userNotes.test.ts`):

```ts
import { foldAddenda } from "./userNotes";

describe("foldAddenda", () => {
  it("folds rows into per-note blocks in createdAt order", () => {
    const folded = foldAddenda([
      { noteId: "n1", body: "second", createdAt: 2 },
      { noteId: "n1", body: "first", createdAt: 1 },
      { noteId: "n2", body: "only", createdAt: 3 },
    ]);
    expect(folded["n1"]).toBe("first\n\nsecond");
    expect(folded["n2"]).toBe("only");
  });
  it("returns an empty record for no rows", () => {
    expect(foldAddenda([])).toEqual({});
  });
});
```

Also update the existing `buildUserNote` test expectations: `id` becomes `""` (placeholder; the server assigns the real id on POST).

- [ ] **Step 2: Run, verify FAIL** — `npm test`
- [ ] **Step 3: Implement.** In `userNotes.ts`, change `buildUserNote`'s id line to `id: "",` (comment: the server assigns the real id when the note is POSTed) and add:

```ts
/** Fold server addendum rows into the per-note display blocks. */
export function foldAddenda(
  rows: { noteId: string; body: string; createdAt: number }[],
): Record<string, string> {
  const folded: Record<string, string> = {};
  for (const row of [...rows].sort((a, b) => a.createdAt - b.createdAt)) {
    folded[row.noteId] = appendAddendum(folded[row.noteId], row.body);
  }
  return folded;
}
```

Create `src/lib/api.ts`:

```ts
import type { ClinicalNote } from "../types";

/** Thin fetch wrapper for the /api work endpoints. Pure DOM fetch; no React. */

export type StoredAttempt = { text: string; at: string; signed: boolean };
export type AddendumRow = { noteId: string; body: string; createdAt: number };
export type CaseWork = {
  notes: ClinicalNote[];
  addenda: AddendumRow[];
  attempt: StoredAttempt | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} -> ${res.status}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const fetchCaseWork = (caseId: string) => request<CaseWork>(`/cases/${caseId}/work`);

export const apiCreateNote = (caseId: string, note: ClinicalNote) =>
  request<ClinicalNote>(`/cases/${caseId}/notes`, {
    method: "POST",
    body: JSON.stringify({ status: note.status, payload: note }),
  });

export const apiRefileNote = (note: ClinicalNote) =>
  request<ClinicalNote>(`/notes/${note.id}`, {
    method: "PUT",
    body: JSON.stringify({ status: note.status, payload: note }),
  });

export const apiDeleteNote = (id: string) =>
  request<void>(`/notes/${id}`, { method: "DELETE" });

export const apiAddAddendum = (caseId: string, noteId: string, body: string) =>
  request<AddendumRow>(`/notes/${noteId}/addenda`, {
    method: "POST",
    body: JSON.stringify({ caseId, body }),
  });

export const apiPutAttempt = (caseId: string, attempt: StoredAttempt) =>
  request<void>(`/cases/${caseId}/attempt`, {
    method: "PUT",
    body: JSON.stringify(attempt),
  });

export const apiDeleteAttempt = (caseId: string) =>
  request<void>(`/cases/${caseId}/attempt`, { method: "DELETE" });
```

- [ ] **Step 4: Run, verify PASS** — `npm test`; `npx tsc -b`
- [ ] **Step 5: Commit** — `git commit -m "Phase 3 T8: api client + addenda folding, server-assigned note ids"`

---

### Task 9: useCaseWork hook

**Files:**
- Create: `src/hooks/useCaseWork.ts`

**Interfaces:**
- Consumes: everything in `src/lib/api.ts`; `foldAddenda` and `formatStamp` from `src/lib/userNotes.ts`.
- Produces (consumed by Task 10):

```ts
export type CaseWorkState = {
  loaded: boolean;
  loadError: string | null;
  notes: ClinicalNote[];               // the user's notes for this case, createdAt order
  addenda: Record<string, string>;     // noteId -> folded display block
  attempt: StoredAttempt | null;
  createNote(note: ClinicalNote): Promise<ClinicalNote>;  // resolves with the server-id note
  refileNote(note: ClinicalNote): Promise<void>;
  deleteNote(id: string): Promise<void>;
  addAddendum(noteId: string, block: string): Promise<void>;
  saveAttempt(text: string, signed: boolean): Promise<void>;
  clearAttempt(): Promise<void>;
};
export function useCaseWork(caseId: string): CaseWorkState
```

No node test: the repo has no React test rig; the workers tests cover the API and Task 12's browser pass covers the wiring.

- [ ] **Step 1: Implement**

```ts
import { useEffect, useState } from "react";
import {
  ApiError,
  apiAddAddendum,
  apiCreateNote,
  apiDeleteAttempt,
  apiDeleteNote,
  apiPutAttempt,
  apiRefileNote,
  fetchCaseWork,
  type AddendumRow,
  type StoredAttempt,
} from "../lib/api";
import { foldAddenda, formatStamp } from "../lib/userNotes";
import type { ClinicalNote } from "../types";

export type CaseWorkState = {
  loaded: boolean;
  loadError: string | null;
  notes: ClinicalNote[];
  addenda: Record<string, string>;
  attempt: StoredAttempt | null;
  createNote(note: ClinicalNote): Promise<ClinicalNote>;
  refileNote(note: ClinicalNote): Promise<void>;
  deleteNote(id: string): Promise<void>;
  addAddendum(noteId: string, block: string): Promise<void>;
  saveAttempt(text: string, signed: boolean): Promise<void>;
  clearAttempt(): Promise<void>;
};

/**
 * The trainee's server-side work for one case. Fetch-on-mount is sound
 * because PatientWorkspace remounts per case (key={caseId}); the chart
 * renders static documents immediately and the user's notes merge in when
 * this resolves.
 */
export function useCaseWork(caseId: string): CaseWorkState {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [addendaRows, setAddendaRows] = useState<AddendumRow[]>([]);
  const [attempt, setAttempt] = useState<StoredAttempt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCaseWork(caseId).then(
      (work) => {
        if (cancelled) return;
        setNotes(work.notes);
        setAddendaRows(work.addenda);
        setAttempt(work.attempt);
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

  return {
    loaded,
    loadError,
    notes,
    addenda: foldAddenda(addendaRows),
    attempt,
    async createNote(note) {
      const stored = await apiCreateNote(caseId, note);
      setNotes((prev) => [...prev, stored]);
      return stored;
    },
    async refileNote(note) {
      const stored = await apiRefileNote(note);
      setNotes((prev) => prev.map((n) => (n.id === stored.id ? stored : n)));
    },
    async deleteNote(id) {
      await apiDeleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    async addAddendum(noteId, block) {
      const row = await apiAddAddendum(caseId, noteId, block);
      setAddendaRows((prev) => [...prev, row]);
    },
    async saveAttempt(text, signed) {
      const next = { text, at: formatStamp(new Date()), signed };
      await apiPutAttempt(caseId, next);
      setAttempt(next);
    },
    async clearAttempt() {
      await apiDeleteAttempt(caseId);
      setAttempt(null);
    },
  };
}
```

- [ ] **Step 2: Verify** — `npx tsc -b` and `npm run lint` pass.
- [ ] **Step 3: Commit** — `git commit -m "Phase 3 T9: useCaseWork hook"`

---

### Task 10: UI integration — PatientWorkspace, NotesBrowser, WrapUp dock/module

**Files:**
- Modify: `src/components/PatientWorkspace.tsx`, `src/components/chart/NotesBrowser.tsx`, `src/components/chart/ChartReview.tsx`, `src/components/wrapup/WrapUpDock.tsx`, `src/components/wrapup/WrapUpModule.tsx`, `src/components/notes/NoteEditorPanel.tsx`, `src/App.css`

**Interfaces:**
- Consumes: `useCaseWork` (Task 9).
- Produces: no localStorage reads/writes for notes, addenda, or attempts anywhere under `src/components/`.

- [ ] **Step 1: PatientWorkspace — swap the stores.** Remove the two `usePersistentState` blocks (`storedUserNotes`, `storedAddenda`, currently lines 79-88), the `parseUserNotes`/`parseAddenda` helpers, and the `saveWrapupAttempt`, `addendaKey`, `userNotesKey`, `isOwnNote`, `usePersistentState` imports (keep `usePersistentState` only if something else in the file still uses it; nothing should). Add:

```tsx
import { useCaseWork } from "../hooks/useCaseWork";
// inside the component:
const work = useCaseWork(activeCase.id);
const [saveError, setSaveError] = useState<string | null>(null);
const userNotes = work.notes;
const addenda = work.addenda;
```

Ownership and deletability predicates (replace the old `ownNote` line 134):

```tsx
// A note is "yours" if the server filed it under your account for this case,
// or it is the static persona note this case has you play.
const isUserNote = (note: Note) => userNotes.some((n) => n.id === note.id);
const ownNote = (note: Note) =>
  isUserNote(note) || (!!note.authorId && note.authorId === activeCase.playerHcpId);
```

The `withAddenda` merge (lines 101-110) is unchanged: `addenda` has the same `Record<noteId, string>` shape as before.

- [ ] **Step 2: PatientWorkspace — async finishDraft and deleteUserNote.** Replace both functions:

```tsx
async function deleteUserNote(id: string) {
  try {
    await work.deleteNote(id);
    if (selectedDocId === id) onPatch({ selectedDocId: null });
  } catch {
    setSaveError("Couldn't delete the note on the server. Try again.");
  }
}

// Sign publishes the draft (or appends its addendum); Pend files it as an
// incomplete note. Edit drafts re-file their target in place; a deleted
// target degrades to filing as a new note. All paths remove the draft tab.
// Server-first: the draft tab only closes once the write lands, so a failed
// save never destroys work.
async function finishDraft(id: string, status: NoteStatus) {
  const draft = editors.find((d) => d.id === id);
  if (!draft) return;
  const text = htmlToPlainText(draft.body);
  if (wordCount(text) === 0) return;
  const remaining = editors.filter((d) => d.id !== id);
  setSaveError(null);
  try {
    if (draft.mode === "addendum" && draft.targetNoteId) {
      await work.addAddendum(draft.targetNoteId, buildAddendumBlock(user, text, new Date()));
      onPatch({ editors: remaining });
      return;
    }
    const target =
      draft.mode === "edit" && draft.targetNoteId
        ? userNotes.find((n) => n.id === draft.targetNoteId)
        : undefined;
    if (target) {
      await work.refileNote(refileUserNote(target, draft, text, status, new Date()));
    } else {
      await work.createNote(buildUserNote(draft, user, text, status, new Date()));
    }
    if (status === "signed") {
      await work.saveAttempt(text, true);
      onPatch({ editors: remaining, wrapupOpen: true });
    } else {
      onPatch({ editors: remaining });
    }
  } catch {
    setSaveError("Couldn't save to the server. Your draft is untouched; try again.");
  }
}
```

- [ ] **Step 3: Thread the new props.**
  - `NoteEditorPanel` gains `error: string | null`; render `{error && <div className="editor-save-error">{error}</div>}` above its tab strip. PatientWorkspace passes `error={saveError}`. Add to `App.css`:

```css
.editor-save-error {
  padding: 6px 10px;
  background: #fdecea;
  border-bottom: 1px solid #f5c6c0;
  color: #b3261e;
  font-size: 12px;
}
```
  - `ChartReview` and `NotesBrowser` gain `isUserNote: (note: Note) => boolean`; ChartReview forwards it exactly like `ownNote` (props at `ChartReview.tsx:37-53`, forwarding at `:137-143`). In `NotesBrowser`, replace both `activeNote.id.startsWith("user-note-")` checks (lines 277 and 287) with `isUserNote(activeNote)`.
  - `WrapUpDock` gains and forwards to `WrapUpModule`: `attempt: StoredAttempt | null`, `onSubmitAttempt: (text: string, signed: boolean) => void`, `onClearAttempt: () => void` (import `StoredAttempt` from `../../lib/api`). PatientWorkspace passes:

```tsx
<WrapUpDock
  open={wrapupOpen}
  onToggle={() => onPatch({ wrapupOpen: !wrapupOpen })}
  onClose={() => onPatch({ wrapupOpen: false })}
  editors={editors}
  userNotes={userNotes}
  user={user}
  attempt={work.attempt}
  onSubmitAttempt={(text, signed) => {
    work.saveAttempt(text, signed).catch(() => setSaveError("Couldn't save the attempt."));
  }}
  onClearAttempt={() => {
    work.clearAttempt().catch(() => setSaveError("Couldn't clear the attempt."));
  }}
/>
```

  - If `work.loadError` is set, render it once as a slim banner at the top of `.module-body` (reuse the `.editor-save-error` class).

- [ ] **Step 4: WrapUpModule — attempt via props.** Remove the `usePersistentState`, `attemptKey`, `parseAttempt`, and `formatStamp` imports and the `storedAttempt` state (lines 41-45). New props: `attempt: StoredAttempt | null; onSubmitAttempt: (text: string, signed: boolean) => void; onClearAttempt: () => void;` (`StoredAttempt` from `../../lib/api`). `submit()` becomes `onSubmitAttempt(selected.text, selected.signed)`; the overreach panel's "Try another note" button and `FeedbackReport`'s `onReset` both call `onClearAttempt()`. Candidates, overreach logic, and the report are unchanged.

- [ ] **Step 5: Verify** — `npx tsc -b` (catches every missed prop), `npm run lint`, `npm test`, `npm run build`. Grep proof the stores are gone from components: `grep -rn "userNotesKey\|addendaKey\|attemptKey\|saveWrapupAttempt" src/components` returns nothing.
- [ ] **Step 6: Commit** — `git commit -m "Phase 3 T10: workspace reads and writes work via the server"`

---

### Task 11: Retire the dead client plumbing

**Files:**
- Modify: `src/lib/userNotes.ts`, `src/lib/session.ts`, `src/lib/userNotes.test.ts`
- Delete: `src/lib/wrapupAttempt.ts`

**Interfaces:**
- Consumes: Task 10 complete (nothing imports the dead code anymore).
- Produces: the phase-2 review cleanup items closed.

- [ ] **Step 1: Confirm nothing references the doomed exports** — `grep -rn "generateHcpId\|isOwnNote\|wrapupAttempt\|USER_KEY\|userNotesKey\|addendaKey" src/ --include="*.ts" --include="*.tsx"` shows only the defining files and their tests.
- [ ] **Step 2: Delete** (Ryan approved these deletions by approving this plan):
  - `src/lib/wrapupAttempt.ts`, the whole file (attempt persistence is `api.ts` + the hook now; `StoredAttempt` lives in `api.ts`).
  - From `src/lib/userNotes.ts`: `generateHcpId` (the server generates hcpId since phase 2) and `isOwnNote` (ownership is server-filed membership + `playerHcpId`, inlined in PatientWorkspace at Task 10 Step 1).
  - From `src/lib/session.ts`: `USER_KEY`, `userNotesKey`, `addendaKey`. Keep `SKIP_DELETE_CONFIRM_KEY` and `signOut` exactly as they are (the `legend*` prefix sweep still clears sticky keys; server work now survives sign-out by construction).
  - From `src/lib/userNotes.test.ts`: the `isOwnNote` and `generateHcpId` test blocks.
- [ ] **Step 3: Verify** — `npm test`, `npm run test:workers`, `npx tsc -b`, `npm run lint`, `npm run build`. All green.
- [ ] **Step 4: Commit** — `git commit -m "Phase 3 T11: retire localStorage work stores and hcpId ownership backstops"`

---

### Task 12: Browser verification + docs

**Files:**
- Modify: `CLAUDE.md`, `STATUS.md`

- [ ] **Step 1: Browser click-through** (`npm run dev`, http://localhost:5173):
  1. Guest sign-in → open a case → New Note → type → **Pend** → note appears Incomplete.
  2. Reload (F5) → the pended note is still there (server-side now; localStorage before).
  3. Reopen → edit → **Sign** → Performance dock opens with the rubric report.
  4. Reload → the report is still there; "Try another note" clears it, and it stays cleared after another reload.
  5. Addendum on the signed note → shows under the note; survives reload.
  6. Delete the note (confirm dialog) → gone; survives reload.
  7. Sign out → sign in as a NEW guest → the first guest's work is NOT visible.
  8. DevTools > Application > localStorage: no `legend-user-notes-*`, `legend-addenda-*`, or `legend-wrapup-*` keys ever appear.
- [ ] **Step 2: Update `CLAUDE.md`** Gotchas: rewrite the "Trainee session + note feedback" bullet (notes/attempts/addenda are server-side via `/api` + `useCaseWork`; localStorage holds only sticky + the delete-confirm preference), and the Architecture bullets for `src/worker/` (work.ts, rekey.ts, purge.ts, cron trigger) and `src/lib/` (api.ts added, wrapupAttempt.ts gone, isOwnNote/generateHcpId gone).
- [ ] **Step 3: Update `STATUS.md`** (Done entry for the phase-3 build; "Next concrete step" becomes the Task 13 ship gate; note the remote migration is pending).
- [ ] **Step 4: Run `graphify update .`**
- [ ] **Step 5: Commit** — `git commit -m "Phase 3 T12: browser-verified; docs reconciled"`

---

### Task 13: SHIP (Ryan-gated — do not start without his explicit go)

- [ ] **Step 1: Remote migration** — `npx wrangler d1 migrations apply legend-db --remote` (PROD; Ryan runs it or explicitly approves).
- [ ] **Step 2: Deploy** — `npm run deploy` (NEVER bare `wrangler deploy`).
- [ ] **Step 3: Live checks** — `/api/health` returns `{"ok":true,"db":true}`; live guest sign-in → Sign a note → reload → persists; the cron shows under the worker's Settings > Triggers in the Cloudflare dashboard.
- [ ] **Step 4: Google link check** — Ryan signs in as a guest, writes a note, links Google, confirms the note followed the account.
- [ ] **Step 5: Update STATUS.md; commit** — `git commit -m "Phase 3 shipped: server-side work persistence live"`
