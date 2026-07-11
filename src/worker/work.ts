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

work.post("/notes/:id/addenda", async (c) => {
  const raw = (await c.req.json().catch(() => null)) as { caseId?: unknown; body?: unknown } | null;
  if (!raw || typeof raw.caseId !== "string" || raw.caseId.length === 0 || typeof raw.body !== "string" || raw.body.length === 0)
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
