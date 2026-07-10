import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";

/**
 * Same format as src/lib/userNotes.ts generateHcpId (kept separate so the
 * worker program never imports DOM-adjacent app code). Keep the two in sync.
 */
function generateHcpId(): string {
  return `d9${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
}

export function createAuth(env: Env, baseURL: string) {
  return betterAuth({
    database: env.DB,
    baseURL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    plugins: [anonymous({ emailDomainName: "legend.local" })],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
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
}
