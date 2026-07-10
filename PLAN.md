# PLAN: Phase 2 — Real user accounts (better-auth + Google + anonymous guests)

> Implementation plan for SPEC.md (phase 2, approved 2026-07-10). Written for a fresh implementer with no prior context. Planner is not the implementer. Phase 1 plan is historical (git: PLAN.md @ fc27d81).

## Approach

Mount better-auth (>= 1.6.23, native D1) on the phase-1 Hono worker at `/api/auth/*`, with the anonymous plugin (guests) and Google as the only social provider. Persona (forename, surname, grade, hcpId) lives as `additionalFields` on the better-auth user table; `hcpId` is server-generated via a `databaseHooks.user.create.before` hook. The SPA gate switches from the localStorage `legend-user` profile to the better-auth React client's session; `UserProfile` is derived from the session user so all downstream code (authorship, ownership, overreach) is untouched. D1 migrations begin this phase.

The plan is sequenced to burn down the three research uncertainties FIRST (mount/basePath composition -> T2; CLI schema generation vs hand-authoring -> T3; real-D1 test plugin API -> T4) before any UI work.

Facts pinned by research 2026-07-10 (primary sources; do not re-litigate):
- better-auth `basePath` must be the FULL external path (`"/api/auth"`), while the Hono route registers as `/auth/*` under the app's existing `.basePath("/api")`. This composition is inferred, not documented verbatim — T2 proves it empirically via better-auth's DB-free `/api/auth/ok` endpoint before anything else builds on it.
- Per-request factory (`createAuth(c.env, origin)`) instead of a module-level singleton; do NOT use `import { env } from "cloudflare:workers"` (depends on ALS plumbing we don't need).
- `trustedOrigins` is NOT needed: dev and prod each run same-origin with their own `baseURL`.
- Anonymous plugin adds `isAnonymous` to the user schema; anonymous user email domain is configurable (`emailDomainName: "legend.local"`). Default behavior deletes the anonymous row on account-link; leave defaults (no in-app linking this phase per SPEC).
- All four additionalFields are `required: false` (the anonymous plugin creates users without them; our UI enforces presence). `hcpId` is `input: false` (server-owned) and set in `databaseHooks.user.create.before`.
- Client typing uses `inferAdditionalFields` with an EXPLICIT schema object, NOT `inferAdditionalFields<typeof auth>` — a type-only import of `src/worker/auth.ts` would pull worker files (and the global `Env`) into the DOM-typed app program and break the phase-1 type-world separation. Implementer verifies the object form against current docs (context7 /better-auth/better-auth) in-task.
- `.dev.vars` values reach the worker under `npm run dev` (Cloudflare vite plugin) and `wrangler types` infers `Env` fields from `.dev.vars` keys — no `vars`/`secrets` block needed in wrangler.jsonc.
- `cookieCache` stays DISABLED (two 2026 logout/expiry bugs: better-auth #8273, #10021). No KV secondary storage.
- Cookies: better-auth only sets `Secure` in production mode; plain-HTTP localhost dev works without config. Do not set `advanced.useSecureCookies`.
- `@cloudflare/vitest-pool-workers@0.18.x` uses the `cloudflareTest()` vite plugin + `readD1Migrations`/`applyD1Migrations` (`cloudflare:test`); the older `defineWorkersConfig` pattern is superseded.
- Google flow: `authClient.signIn.social({ provider: "google", callbackURL: "/" })`; better-auth itself serves `/api/auth/callback/google` under the mounted wildcard and 302s back to `callbackURL`.

Global constraints:
- `UserProfile` keeps its exact shape (`forename/surname/hcpId/grade`); `src/lib/userNotes.ts`, `grades.ts`, ownership and overreach logic must not change.
- SPA files may be modified ONLY where this plan names them (`src/App.tsx`, `src/components/SignInPage.tsx`, `src/lib/session.ts`, new `src/lib/authClient.ts`). Everything else under `src/` outside `src/worker/` is frozen.
- Secrets never enter git or chat: `.dev.vars` is gitignored (verified); prod secrets go via `wrangler secret put` reading from stdin. Never print secret values in command output or reports.
- Remote D1 migrations and deploy are GATED on Ryan (T8). Local-only until then. Never `git push`.
- Lint must stay clean (baseline 0 problems); suite baseline 182 tests / 23 files (node pool) must stay green; `npx tsc -b` clean; `npm run build` emits dist/client + dist/legend.
- The working tree carries unrelated uncommitted changes (.gitignore, CLAUDE.md, .graphifyignore, src/data/patients/hyponatraemia001/, .dev.vars): NEVER `git add -A`/`git add .`; stage files explicitly.
- Windows environment; commands are shell-neutral npm/npx unless noted.

## Tasks (bite-sized, ordered, independently verifiable)

### T1: Dependencies + secret plumbing
- Files: `package.json`, `package-lock.json`, create `.dev.vars.example`; append one line to the (gitignored, DO NOT COMMIT) `.dev.vars`
- Change:
  1. `npm install better-auth` (expect >= 1.6.23) and `npm install -D @cloudflare/vitest-pool-workers` (expect >= 0.18.3; peer-compatible with the repo's vitest 4.1).
  2. Create `.dev.vars.example` (committed):
     ```
     BETTER_AUTH_SECRET=
     GOOGLE_CLIENT_ID=
     GOOGLE_CLIENT_SECRET=
     ```
  3. Generate a secret and append to `.dev.vars` WITHOUT printing it: `echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .dev.vars` (Git Bash has openssl). Ryan's Google credentials are already in the file — do not touch those lines.
- Verify: `npm ls better-auth @cloudflare/vitest-pool-workers` clean; `grep -c "=" .dev.vars` returns 3 (count only — never cat the file); `npm test` still 182/23 green.
- Commit (package.json, package-lock.json, .dev.vars.example only): `Deps: better-auth + vitest-pool-workers; dev secrets scaffold`
- Depends on: none

### T2: Auth factory + Hono mount, smoke-proven (burns down the basePath uncertainty)
- Files: create `src/worker/auth.ts`, modify `src/worker/index.ts`, regenerate `worker-configuration.d.ts`
- Interfaces produced: `createAuth(env: Env, baseURL: string)` returning a better-auth instance; auth endpoints live under `/api/auth/*`.
- Change:
  1. `src/worker/auth.ts`:
     ```ts
     import { betterAuth } from "better-auth";
     import { anonymous } from "better-auth/plugins";

     /** Same format as src/lib/userNotes.ts generateHcpId (kept separate so the
      *  worker program never imports DOM-adjacent app code). */
     function generateHcpId() {
       return `d9${Math.floor(Math.random() * 90000 + 10000)}`;
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
     ```
     IMPORTANT: before writing, check `src/lib/userNotes.ts` `generateHcpId()` and copy its EXACT format (the snippet above is the planner's recollection — the real one wins; keep the two in sync and cross-reference in the comment).
  2. `src/worker/index.ts` — add the mount ABOVE the health route:
     ```ts
     import { createAuth } from "./auth";
     // ...existing app = new Hono<{ Bindings: Env }>().basePath("/api")

     app.on(["GET", "POST"], "/auth/*", (c) =>
       createAuth(c.env, new URL(c.req.url).origin).handler(c.req.raw),
     );
     ```
  3. `npm run cf-typegen` — `Env` must now include `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (inferred from `.dev.vars`) alongside `DB`. Commit the regenerated file.
- Verify (empirical smoke for the inferred basePath composition — DB-free, so it works before migrations):
  - `npm run dev -- --port 5199 --strictPort` in background; `curl -s http://localhost:5199/api/auth/ok` returns better-auth's ok JSON (`{"ok":true}`); `curl -s http://localhost:5199/api/health` still works; kill the server (only the one you started; port 5173 belongs to someone else).
  - If `/api/auth/ok` 404s: try `basePath: "/auth"` as the single permitted variation, re-test, and REPORT which composition worked — the reviewer needs to know.
  - `npx tsc -b` clean; `npm test` still green (worker index change is additive).
- Commit: `Auth server: better-auth factory (anonymous + Google + persona fields) mounted at /api/auth`
- Depends on: T1

### T3: Schema -> D1 migrations (burns down the CLI uncertainty)
- Files: create `migrations/0001_better_auth.sql` (via wrangler), possibly create `auth.cli.ts` (repo root, CLI-only), no src changes
- Change, in order:
  1. Try the CLI directly against the factory: `npx @better-auth/cli@latest generate --config src/worker/auth.ts --output .superpowers/sdd/auth-schema.sql -y`. (PR #5559 auto-stubs `cloudflare:workers`; the factory takes args, which the CLI cannot call — if it errors, step 2.)
  2. Fallback: create `auth.cli.ts` at repo root exporting `export const auth = betterAuth({...})` with the IDENTICAL options object as `createAuth` but `database: {} as never` (schema generation reads config shape, not the connection), then `npx @better-auth/cli@latest generate --config auth.cli.ts --output .superpowers/sdd/auth-schema.sql -y`. Commit `auth.cli.ts` with a header comment "CLI schema generation only — never imported at runtime; keep options in sync with src/worker/auth.ts". Exclude it from tsconfig app/node programs if `tsc -b` complains (add to `tsconfig.node.json` include ONLY if needed for editor sanity).
  3. If BOTH fail: STOP, report BLOCKED with exact errors. Do NOT hand-invent schema SQL.
  4. Inspect the generated SQL: it must contain `user` (with `isAnonymous`, `forename`, `surname`, `grade`, `hcpId`), `session`, `account`, `verification` tables. Report the table/column list.
  5. `npx wrangler d1 migrations create legend-db better_auth_init` -> creates `migrations/0001_better_auth_init.sql`; move the generated SQL into it.
  6. `npx wrangler d1 migrations apply legend-db --local` (NEVER --remote in this task).
- Verify: `npx wrangler d1 migrations list legend-db --local` shows it applied; `npx wrangler d1 execute legend-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"` lists the four better-auth tables (+ d1_migrations); `npm test` green.
- Commit (migrations/ + auth.cli.ts if created): `D1 migrations: better-auth schema (user+persona fields, session, account, verification)`
- Depends on: T2

### T4: Real-D1 test project + auth behavior tests (TDD)
- Files: create `vitest.workers.config.ts`, create `test/apply-migrations.ts`, create `src/worker/auth.workers.test.ts`, modify `vitest.config.ts` (one exclude line), modify `package.json` (one script)
- Interfaces consumed: `createAuth(env, baseURL)`; migrations dir from T3.
- Change:
  1. `vitest.workers.config.ts` (repo root) per the current pool-workers API (verify plugin import name against installed version's README/types — research pinned `cloudflareTest()` + `readD1Migrations` from `@cloudflare/vitest-pool-workers`, superseding `defineWorkersConfig`; if the installed 0.18.x still ships `defineWorkersConfig` and not `cloudflareTest`, use what the installed package actually exports and report which):
     ```ts
     import path from "node:path";
     import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
     import { defineConfig, defineProject, mergeConfig } from "vitest/config";

     export default defineConfig(async () => {
       const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
       return mergeConfig(
         {},
         defineProject({
           plugins: [
             cloudflareTest({
               wrangler: { configPath: "./wrangler.jsonc" },
               miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
             }),
           ],
           test: { include: ["src/worker/**/*.workers.test.ts"], setupFiles: ["./test/apply-migrations.ts"] },
         }),
       );
     });
     ```
  2. `test/apply-migrations.ts`:
     ```ts
     import { applyD1Migrations, env } from "cloudflare:test";

     await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
     ```
     (If `env` is not exported from `cloudflare:test` in the installed version, import it from `cloudflare:workers` per the fixture — use whichever the installed fixture pattern shows.)
  3. TDD `src/worker/auth.workers.test.ts`. The `.workers.test.ts` suffix still matches the node pool's default `*.test.ts` include, so FIRST add `exclude: ["**/*.workers.test.ts", "**/node_modules/**"]` to the `test` block of the existing `vitest.config.ts` — the node pool must never load `cloudflare:test`. Then:
     ```ts
     import { env } from "cloudflare:test";
     import { describe, expect, test } from "vitest";
     import { createAuth } from "./auth";

     describe("anonymous sign-in", () => {
       test("creates a user with a server-generated hcpId and isAnonymous", async () => {
         const auth = createAuth(env as unknown as Env, "http://localhost");
         const res = await auth.api.signInAnonymous();
         expect(res?.user).toBeTruthy();
         const row = await env.DB.prepare("SELECT hcpId, isAnonymous FROM user WHERE id = ?")
           .bind(res!.user.id)
           .first<{ hcpId: string; isAnonymous: number }>();
         expect(row?.hcpId).toMatch(/^d9\d+$/);
         expect(row?.isAnonymous).toBe(1);
       });
     });
     ```
     RED first (config not yet wired -> cannot resolve `cloudflare:test`), then wire, then GREEN. The exact `auth.api.signInAnonymous()` server-call signature must be verified against docs (context7 /better-auth/better-auth, "server side anonymous sign in api") — if server-side anonymous sign-in isn't exposed via `auth.api`, drive it through the HTTP handler instead: `await auth.handler(new Request("http://localhost/api/auth/sign-in/anonymous", { method: "POST" }))` and assert the Set-Cookie + user row. Use whichever works; report which.
  4. `package.json` script: `"test:workers": "vitest run --config vitest.workers.config.ts"`.
- Verify: `npm run test:workers` green (>= 1 real-D1 test); `npm test` still 182/23 (node pool untouched by the new suffix exclusion); `npx tsc -b` clean (the workers test file lives in src/worker — already in the worker program; `cloudflare:test` types come from the pool-workers package — add its `/types` to tsconfig.worker.json `types` array only if tsc demands it, and report if so).
- Commit: `Real-D1 tests: vitest-pool-workers project; anonymous sign-in creates hcpId`
- Depends on: T3

### T5: Client — auth client, App gate on session, guest flow, sign-out
- Files: create `src/lib/authClient.ts`, modify `src/App.tsx`, modify `src/components/SignInPage.tsx`, modify `src/lib/session.ts`
- Interfaces produced: `authClient` (+ `useSession`); `SignInPage` gains props `{ mode: "signin" | "persona", initialName?: { forename: string; surname: string }, onComplete: (p: PersonaInput) => Promise<void>, onGoogle: () => void }` where `PersonaInput = { forename: string; surname: string; grade: Grade }`.
- Change:
  1. `src/lib/authClient.ts`:
     ```ts
     import { createAuthClient } from "better-auth/react";
     import { anonymousClient, inferAdditionalFields } from "better-auth/client/plugins";

     // Explicit field schema instead of inferAdditionalFields<typeof auth>: importing
     // the worker's auth type would drag workerd globals into the DOM program.
     export const authClient = createAuthClient({
       plugins: [
         anonymousClient(),
         inferAdditionalFields({
           user: {
             forename: { type: "string", required: false },
             surname: { type: "string", required: false },
             grade: { type: "string", required: false },
             hcpId: { type: "string", required: false, input: false },
           },
         }),
       ],
     });

     export const { useSession } = authClient;
     ```
     Verify the object-form `inferAdditionalFields` signature against docs in-task; if only the generic form exists, define a local `type AuthShape` mirroring the fields instead — do NOT import from src/worker.
  2. `src/App.tsx` — replace the localStorage profile gate:
     - Delete `parseUser` and the `usePersistentState(USER_KEY, "")` line (keep `USER_KEY` in session.ts for the sign-out sweep; it simply stops being written).
     - Gate:
       ```tsx
       const { data: session, isPending } = useSession();
       const user: UserProfile | null =
         session?.user && session.user.forename && session.user.surname && session.user.grade && session.user.hcpId
           ? {
               forename: session.user.forename,
               surname: session.user.surname,
               grade: session.user.grade as Grade,
               hcpId: session.user.hcpId,
             }
           : null;

       if (isPending) return null; // brief blank while the session loads
       if (!user) {
         return (
           <SignInPage
             mode={session?.user ? "persona" : "signin"}
             initialName={splitName(session?.user?.name)}
             onComplete={async (p) => {
               if (!session?.user) await authClient.signIn.anonymous();
               await authClient.updateUser({ forename: p.forename, surname: p.surname, grade: p.grade });
             }}
             onGoogle={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
           />
         );
       }
       ```
       `splitName(name?: string)` = first token as forename, rest as surname (empty-safe); lives in App.tsx.
       After `updateUser`, the session store refetches automatically; if the installed version does not auto-refetch, call `authClient.getSession()`/`useSession`'s `refetch` — implementer verifies behavior in dev and reports which was needed.
     - Persona-complete definition: all four fields present. A returning Google user has them -> straight in. A fresh Google user (no persona yet) -> `mode: "persona"`.
  3. `src/components/SignInPage.tsx` — keep the card, the disclaimers, the Hierarchy dropdown exactly as-is; changes:
     - Accept the new props. In `signin` mode render the existing form (labels/copy unchanged) PLUS below the submit button: a divider and a `Sign in with Google` button (`type="button"`, `onClick={onGoogle}`, same `.signin-submit` styling with a `signin-google` modifier class; add minimal CSS to App.css reusing existing button styles — no redesign).
     - In `persona` mode: same form, name inputs prefilled from `initialName`, submit label `Save and start training`, NO Google button.
     - `submit` now calls `await onComplete({ forename, surname, grade })`; disable the button while the promise is pending (local `saving` state) to prevent double anonymous sign-ins. The `generateHcpId()` import and `hcpId` field go away (server owns it).
  4. `src/lib/session.ts` — `signOut()` becomes async: call `authClient.signOut()` (import from `./authClient`) FIRST, then the existing `legend*` sweep + reload unchanged. Callers (`TopSystemBar` user bubble) may fire-and-forget: `void signOut()` — check the call site compiles; do not otherwise modify TopSystemBar.
- Verify:
  - `npx tsc -b` clean, `npm run lint` clean, `npm test` green, `npm run test:workers` green.
  - Dev browser (port 5199, background, kill after): guest flow end-to-end — fill name+grade, Start training -> app opens on Patient Lists; `npx wrangler d1 execute legend-db --local --command "SELECT forename, surname, grade, hcpId, isAnonymous FROM user ORDER BY createdAt DESC LIMIT 1"` shows the persona row with a d9 hcpId and isAnonymous=1; write+sign a note in cholangitis001 and confirm authorship shows the persona name; user-bubble sign-out returns to the card and sweeps localStorage.
- Commit: `Client auth: session-gated App, guest anonymous flow, async sign-out`
- Depends on: T2 (mount), T3 (local tables). T4 not required but will exist.

### T6: Google sign-in + persona mode, browser-proven
- Files: none new (T5 built the UI); this task is verification + fixes only, plus `src/App.css` if the Google button styling landed rough
- Change: none planned — this task exercises the T5 `persona` mode with the real Google OAuth client (credentials already in `.dev.vars`).
- Verify (dev browser, port 5199 — note: the Google OAuth client's registered origin is `http://localhost:5173`; if Google rejects the redirect because of the port, EITHER temporarily run dev on 5173 — requires Ryan to have freed the port — or ask Ryan to add the 5199 origin+redirect in Google Cloud Console; report which path was taken):
  - Click `Sign in with Google` -> Google account chooser -> redirected back to `/` -> card in persona mode with name prefilled -> edit name, pick grade, save -> app opens.
  - D1 local: user row has `isAnonymous` NULL/0, persona fields set, d9 hcpId; `account` table has a google row.
  - Sign out; sign in with Google again -> NO persona form, straight to Patient Lists (returning-user path).
  - Console: no errors.
- Commit (only if fixes were needed): `Google flow fixes from browser verification`
- Depends on: T5

### T7: Carry-overs + full gate
- Files: `eslint.config.js`
- Change: scoped globals for the worker — add after the existing `**/*.{ts,tsx}` block:
  ```js
  {
    files: ['src/worker/**/*.ts'],
    languageOptions: { globals: globals.serviceworker },
  },
  ```
  (`globals.serviceworker` is the closest published set to workerd: fetch/Request/Response/caches/crypto without DOM. If lint then flags anything real in src/worker, report rather than sprinkling disables.)
- Verify: `npm run lint` clean; `npx tsc -b` clean; `npm test` 182/23+; `npm run test:workers` green; `npm run build` emits dist/client + dist/legend.
- Commit: `Lint: workerd-appropriate globals for src/worker`
- Depends on: T5 (worker code final shape)

### T8: Ship — GATED, requires Ryan's explicit go
- Files: none; STATUS.md update after
- Change, in order (each step names its owner):
  1. Secrets to prod (implementer, without printing values): for each of `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: extract the value from `.dev.vars` and pipe to `npx wrangler secret put <NAME>` via stdin (e.g. `grep '^NAME=' .dev.vars | cut -d= -f2- | npx wrangler secret put NAME`).
  2. Remote migrations (Ryan-gated — this touches the production database): `npx wrangler d1 migrations apply legend-db --remote`.
  3. Deploy: `npm run deploy` (NEVER bare `wrangler deploy`).
- Verify (live):
  - `https://legend.ryanhocn.workers.dev/api/auth/ok` -> ok JSON; `/api/health` still `{"ok":true,"db":true}`.
  - Browser on the live site: guest flow end-to-end; Google flow (origin + redirect already registered for the prod URL); returning-Google path; sign-out.
  - Update STATUS.md (phase 2 shipped) + ledger; commit.
- Depends on: T6, T7, and Ryan's approval.

## Verification target (whole feature)

`npm test` (node pool, >= 182 green) && `npm run test:workers` (real-D1 auth tests green) && `npx tsc -b` && `npm run lint` (clean) && `npm run build` (dist/client + dist/legend) && dev browser: all three sign-in flows (guest, first Google, returning Google) + sign-out sweep. Live after gated T8: same three flows on legend.ryanhocn.workers.dev with `/api/health` and `/api/auth/ok` green.
