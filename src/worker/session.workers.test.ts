import { applySetCookies } from "better-auth/cookies";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { createAuth } from "./auth";
import worker from "./index";

export async function anonCookie(): Promise<string> {
  const auth = createAuth(env as unknown as Env, "http://localhost");
  const signIn = await auth.api.signInAnonymous({ returnHeaders: true });
  const h = new Headers();
  applySetCookies(h, signIn.headers.getSetCookie());
  const cookie = h.get("cookie");
  if (!cookie) throw new Error("no session cookie");
  return cookie;
}

export async function callWorker(path: string, init?: RequestInit): Promise<Response> {
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
