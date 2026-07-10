import { applySetCookies } from "better-auth/cookies";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { createAuth } from "./auth";
import worker from "./index";

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
