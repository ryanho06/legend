// CLI schema generation only — never imported at runtime; keep options in sync with src/worker/auth.ts
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";

function generateHcpId(): string {
  return `d9${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
}

// `database: {} as never` (per the plan's original recipe) throws
// "Failed to initialize database adapter" — better-auth's kysely-adapter
// dialect detection needs a real duck-typed db handle to introspect (even
// an empty one), not just an empty object. An in-memory node:sqlite
// DatabaseSync satisfies that detection (`"createSession" in db`) with a
// throwaway, empty, non-persistent database — still not real D1, still no
// live credentials, still schema-generation-only.
export const auth = betterAuth({
  database: new DatabaseSync(":memory:") as never,
  baseURL: "http://localhost:5173",
  basePath: "/api/auth",
  secret: "",
  plugins: [anonymous({ emailDomainName: "legend.local" })],
  socialProviders: {
    google: {
      clientId: "",
      clientSecret: "",
      prompt: "select_account",
    },
  },
  user: {
    additionalFields: {
      forename: { type: "string", required: false },
      surname: { type: "string", required: false },
      grade: { type: "string", required: false },
      hcpId: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, hcpId: generateHcpId() } }),
      },
    },
  },
});
