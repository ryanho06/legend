import { expect, test } from "vitest";
import app from "./index";

const liveDb = {
  prepare: () => ({ first: async () => ({ ok: 1 }) }),
};
const brokenDb = {
  prepare: () => {
    throw new Error("no db");
  },
};

test("GET /api/health reports ok with a live DB binding", async () => {
  const res = await app.request("/api/health", {}, { DB: liveDb } as unknown as Env);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: true });
});

test("GET /api/health degrades db to false when the binding fails", async () => {
  const res = await app.request("/api/health", {}, { DB: brokenDb } as unknown as Env);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: false });
});
