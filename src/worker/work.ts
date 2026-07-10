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
