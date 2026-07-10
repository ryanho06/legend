import { defineConfig, defaultExclude } from "vitest/config";

// Vitest must not load vite.config.ts once the Cloudflare plugin lives there:
// the workerd dev server has no business inside the node test pool.
export default defineConfig({
  test: {
    environment: "node",
    exclude: [...defaultExclude, "**/*.workers.test.ts"],
  },
});
