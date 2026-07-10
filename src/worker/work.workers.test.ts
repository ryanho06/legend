import { applySetCookies } from "better-auth/cookies";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { createAuth } from "./auth";
import worker from "./index";
import { purgeStaleAnonUsers } from "./purge";
import { rekeyUserWork } from "./rekey";

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

async function createNote(cookie: string, body = "v1", status = "incomplete") {
  const res = await callWorker("/api/cases/cholangitis001/notes", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ status, payload: { body } }),
  });
  return (await res.json()) as { id: string };
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

  test("rejects an addendum with an empty caseId", async () => {
    const cookie = await anonCookie();
    const res = await callWorker("/api/notes/note-adm-1/addenda", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ caseId: "", body: "x" }),
    });
    expect(res.status).toBe(400);
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
