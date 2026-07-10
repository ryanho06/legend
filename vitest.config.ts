import { defineConfig, defaultExclude } from "vitest/config";

// Vitest must not load vite.config.ts once the Cloudflare plugin lives there:
// the workerd dev server has no business inside the node test pool.
export default defineConfig({
  test: {
    environment: "node",
    exclude: [...defaultExclude, "**/*.workers.test.ts"],
    // Non-UTC pin: if a formatter in src/lib/simTime.ts ever regresses from a
    // getUTC* accessor to a local get* accessor, this makes the existing
    // "17:00" / "0905" style assertions fail instead of silently passing
    // (local time == UTC time on a CI box running in the UTC zone).
    env: { TZ: "America/New_York" },
  },
});
