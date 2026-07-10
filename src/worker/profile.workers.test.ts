import { applySetCookies } from "better-auth/cookies";
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { createAuth } from "./auth";
import worker from "./index";

/** Sign in anonymously and return both the session cookie and the user id. */
async function anonSession(): Promise<{ cookie: string; userId: string }> {
  const auth = createAuth(env as unknown as Env, "http://localhost");
  const signIn = await auth.api.signInAnonymous({ returnHeaders: true });
  const h = new Headers();
  applySetCookies(h, signIn.headers.getSetCookie());
  const cookie = h.get("cookie");
  if (!cookie) throw new Error("no session cookie");
  return { cookie, userId: signIn.response.user.id };
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

function setPersona(userId: string, forename: string, surname: string, grade: string) {
  return env.DB.prepare(`UPDATE user SET forename = ?2, surname = ?3, grade = ?4 WHERE id = ?1`)
    .bind(userId, forename, surname, grade)
    .run();
}

function seedAlias(userId: string, p: { forename: string; surname: string; grade: string; hcpId: string }) {
  const id = crypto.randomUUID();
  return env.DB.prepare(
    `INSERT INTO user_alias (id, userId, forename, surname, grade, hcpId, createdAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(id, userId, p.forename, p.surname, p.grade, p.hcpId, Date.now())
    .run()
    .then(() => id);
}

function userRow(userId: string) {
  return env.DB.prepare(`SELECT forename, surname, grade, hcpId FROM user WHERE id = ?1`)
    .bind(userId)
    .first<{ forename: string | null; surname: string | null; grade: string | null; hcpId: string }>();
}

describe("GET /api/profile/aliases", () => {
  test("401 without a session", async () => {
    const res = await callWorker("/api/profile/aliases");
    expect(res.status).toBe(401);
  });

  test("seeds the current persona and does not duplicate on repeat", async () => {
    const { cookie, userId } = await anonSession();
    await setPersona(userId, "Alice", "One", "fy");

    const first = await callWorker("/api/profile/aliases", { headers: { cookie } });
    expect(first.status).toBe(200);
    const data = (await first.json()) as { aliases: { forename: string; hcpId: string }[] };
    expect(data.aliases).toHaveLength(1);
    expect(data.aliases[0].forename).toBe("Alice");

    // Idempotent: a second GET must not snapshot the unchanged persona again.
    await callWorker("/api/profile/aliases", { headers: { cookie } });
    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM user_alias WHERE userId = ?1`)
      .bind(userId)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });
});

describe("POST /api/profile/aliases/switch", () => {
  test("401 without a session", async () => {
    const res = await callWorker("/api/profile/aliases/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aliasId: "whatever" }),
    });
    expect(res.status).toBe(401);
  });

  test("swaps the persona and snapshots the outgoing one", async () => {
    const { cookie, userId } = await anonSession();
    await setPersona(userId, "Alice", "One", "fy");
    const before = await userRow(userId);
    const outgoingHcp = before!.hcpId;

    const aliasId = await seedAlias(userId, { forename: "Bob", surname: "Two", grade: "consultant", hcpId: "d900042" });

    const res = await callWorker("/api/profile/aliases/switch", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ aliasId }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ forename: "Bob", surname: "Two", grade: "consultant", hcpId: "d900042" });

    const after = await userRow(userId);
    expect(after).toMatchObject({ forename: "Bob", surname: "Two", grade: "consultant", hcpId: "d900042" });

    // The outgoing Alice persona must survive in the alias set.
    const alice = await env.DB.prepare(
      `SELECT hcpId FROM user_alias WHERE userId = ?1 AND forename = 'Alice'`,
    )
      .bind(userId)
      .first<{ hcpId: string }>();
    expect(alice?.hcpId).toBe(outgoingHcp);
  });

  test("preserves the switched-in hcpId format exactly", async () => {
    const { cookie, userId } = await anonSession();
    await setPersona(userId, "Alice", "One", "fy");
    const aliasId = await seedAlias(userId, { forename: "Bob", surname: "Two", grade: "st3", hcpId: "d912345" });

    await callWorker("/api/profile/aliases/switch", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ aliasId }),
    });
    const after = await userRow(userId);
    expect(after?.hcpId).toBe("d912345");
    expect(after?.hcpId).toMatch(/^d9\d{5}$/);
  });

  test("404 for an alias owned by another user; leaves the caller untouched", async () => {
    const owner = await anonSession();
    const attacker = await anonSession();
    await setPersona(attacker.userId, "Mallory", "Attacker", "fy");
    const before = await userRow(attacker.userId);

    const aliasId = await seedAlias(owner.userId, { forename: "Bob", surname: "Two", grade: "consultant", hcpId: "d900099" });

    const res = await callWorker("/api/profile/aliases/switch", {
      method: "POST",
      headers: { cookie: attacker.cookie, "content-type": "application/json" },
      body: JSON.stringify({ aliasId }),
    });
    expect(res.status).toBe(404);

    const after = await userRow(attacker.userId);
    expect(after).toMatchObject({ forename: "Mallory", surname: "Attacker", hcpId: before!.hcpId });
  });

  test("400 on a missing aliasId", async () => {
    const { cookie } = await anonSession();
    const res = await callWorker("/api/profile/aliases/switch", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
