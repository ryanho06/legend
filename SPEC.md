# SPEC: Phase 2 — Real user accounts (better-auth + Google + anonymous guests)

> Durable design contract. Survives `/clear` and compaction. Edit this, not your memory.
> Previous spec (multi-case foundation): DONE 2026-07-06, lives in git history (SPEC.md @ 0d48f4e).

Status: DESIGN APPROVED by Ryan 2026-07-10 (three forks resolved in-session).
Depends on: Phase 1 (Hono /api worker + D1 legend-db + Cloudflare vite plugin), SHIPPED 2026-07-10.

## Context (why)

Legend's sign-in is a demo gate: a name + Hierarchy form that writes a `UserProfile`
to localStorage. Nothing survives a device switch, and the upcoming phases need a real
user: phase 3 persists notes/attempts server-side per user, phase 4 (Patient Message +
LLM proxy) needs authenticated, per-user rate-limited API access — including for
guests, who are the abuse vector on a public LLM endpoint. Phase 2 makes every visitor
a server-side user (anonymous or Google) with a session cookie, while changing the
trainee-visible experience as little as possible.

## Decisions (resolved forks — do not re-litigate)

1. **Sign-in UX: guest-first + Google button.** The current LegendCare card (first
   name, last name, Hierarchy, "Start training") stays as the primary path and becomes
   the guest flow — it silently creates an anonymous server user. A "Sign in with
   Google" button sits below it for durable cross-device accounts.
2. **Persona: form once, saved to the account.** First Google sign-in returns to the
   card in persona mode (name prefilled from Google, editable; grade picked); saved
   server-side with a server-generated `hcpId`. Returning Google users skip the form
   entirely. (Persona name change after creation: later, out of scope.)
3. **Sign-out: keep the full localStorage wipe for everyone** (guests and Google),
   plus ending the server session. Temporary until phase 3 moves work server-side.

## Architecture

- **Everyone is a server-side user** (Approach A). better-auth >= 1.5 mounted on the
  existing Hono app at `/api/auth/*`, `database: env.DB` (native D1, no ORM),
  plugins: `anonymous()` (with `onLinkAccount` wired but data migration deferred to
  phase 3's import), Google as the ONLY social provider. No email/password ever
  (workerd can't hash passwords acceptably). No `cookieCache`, no KV secondary
  storage (open logout bug, Feb 2026).
- **Sessions:** httpOnly same-origin cookies (better-auth default). No tokens in JS.
- **Data model:** better-auth's generated tables (user, session, account,
  verification) via its CLI schema generation, applied with
  `wrangler d1 migrations create/apply` (`--local` for dev, `--remote` for prod) —
  this begins the repo's migrations story (`migrations/` dir). The `user` table
  carries four additional fields (better-auth `additionalFields`): `forename`,
  `surname`, `grade`, `hcpId`. `hcpId` is generated server-side on persona save,
  same d9###### format as today's `generateHcpId()`.
- **Client:** better-auth React client (`createAuthClient`). `App.tsx`'s gate
  switches from the localStorage `legend-user` key to the session (`useSession`).
  The in-app `UserProfile` shape (`forename/surname/hcpId/grade`) is now DERIVED
  from the session user — downstream code (`userNotes.ts` authorship, `isOwnNote`,
  overreach, WrapUp) does not change.
- **Secrets/config:** `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  — prod via `wrangler secret put`, dev via gitignored `.dev.vars`. OAuth client
  origins/redirects registered for `http://localhost:5173` and
  `https://legend.ryanhocn.workers.dev` (callback path `/api/auth/callback/google`).

## Flows

- **Guest:** fill name + grade -> anonymous sign-in -> persona fields saved onto the
  anonymous user -> app. Indistinguishable from today to the trainee.
- **First Google sign-in:** Google button -> OAuth redirect -> back on the card in
  persona mode (name prefilled, editable; grade) -> save -> app.
- **Returning Google user:** lands straight in the app (session cookie or fresh
  Google sign-in), no form.
- **Sign-out (user bubble):** end server session + sweep `legend*` localStorage keys
  (except the device-level delete-confirm preference) + reload, as today.

## Scope

- In scope: better-auth server setup on the phase-1 worker; D1 migrations for auth
  tables + persona fields; SignInPage rework (guest path, Google button, persona
  mode); App gate on session instead of localStorage profile; sign-out integration;
  eslint globals override for `src/worker/**` (phase-1 carry-over); real-D1 test
  project via `@cloudflare/vitest-pool-workers` (phase-1 carry-over).
- Out of scope: server persistence of notes/attempts and localStorage import
  (phase 3); Patient Message + LLM proxy (phase 4); persona name change UI (later);
  email/password (never); guest-work data migration on account upgrade (phase 3);
  in-app "upgrade guest to Google" button (phase 2 reaches Google sign-in from the
  sign-in card only — a signed-in guest upgrades by signing out first; the
  `onLinkAccount` hook exists for phase 3, nothing calls it yet).
- Non-goals: multi-provider auth, roles/orgs, Workers Paid tier.

## Constraints

- The SPA's downstream contract is frozen: `UserProfile` keeps its shape; note
  authorship, ownership (`hcpId`/`playerHcpId`), grades, and overreach logic are
  untouched.
- Free tier: no scrypt/password paths; Google + anonymous only.
- Dev/prod parity via the phase-1 vite plugin (auth cookies must work under
  `npm run dev` on localhost:5173 and in prod).
- Deploy remains `npm run deploy` only. Remote migrations are a deliberate,
  Ryan-gated step (`wrangler d1 migrations apply legend-db --remote`).
- All patient data remain synthetic; Google gives us identity, not patient data.
  Preserve the training-environment disclaimers on the sign-in card.

## Tasks (indicative — PLAN.md is authoritative once written)

- [ ] Server: better-auth config + Hono mount + secrets plumbing -> verify by auth
      endpoints answering locally (session create/read) with real local D1.
- [ ] Schema: generate better-auth schema, create + apply local migrations (auth
      tables + persona additionalFields) -> verify by `wrangler d1 migrations list`
      + a real-D1 route test.
- [ ] Client: auth client + App gate on session -> verify by guest flow end-to-end
      in dev (anonymous user row exists, app opens, notes attribute correctly).
- [ ] SignInPage: Google button + persona mode -> verify by first/returning Google
      flows in dev.
- [ ] Sign-out: server session end + existing sweep -> verify by cookie gone + row
      session revoked + localStorage swept.
- [ ] Carry-overs: eslint worker globals override; vitest-pool-workers project.
- [ ] Gated: remote migrations + `npm run deploy` + live verification of all three
      flows on legend.ryanhocn.workers.dev.

## Open questions

- None blocking. Exact better-auth API shapes (CLI schema output for D1, anonymous
  plugin call signatures, React client hooks, Workers `nodejs_compat` specifics on
  the installed version) to be pinned by research during PLAN.md writing — the plan
  must cite current docs, not memory.
