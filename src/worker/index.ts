import { Hono } from "hono";
import { createAuth } from "./auth";

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

export default app;
