# Permissions enforcement: research and design direction

Status: research complete, not specced or approved. Written 2026-07-10 for the move
toward multiplayer (shared patients, HCP responsibility, faculty/admin roles). This is
input to a future SPEC/PLAN, not an approved plan. It answers three questions Ryan
posed: how to activate elevated permissions, whether guests should have passwords, and
how the permission model should shape the multiplayer data model. Sources and a
verified-vs-inferred split are at the bottom.

## TL;DR recommendation

One path, sized for a solo dev on the Cloudflare free tier:

- **Activation: adopt the better-auth admin plugin for the role machinery, bootstrap
  yourself with `adminUserIds` from a secret, and elevate faculty with a one-time invite
  code you mint in D1.** Do not build a coupon field that the client trusts, do not make
  the `hcpId` namespace (`a*****` vs `d*****`) the security boundary, and do not pull in
  the organization plugin yet. The security boundary is a server-side `role` on the
  session, checked in the existing Hono middleware exactly like `work.ts` checks the
  session today.
- **Guests stay passwordless.** Keep the anonymous plugin as is. Do not give guests
  passwords. The "database junk" problem is already solved by the 30-day anon purge cron
  (`purge.ts`). If durable cross-device identity is ever wanted beyond Google, add
  passkeys or a magic link, not a password.
- **Patient responsibility: a per-patient assignment table in D1 (an ACL row), keyed to
  the same `scope` column the dynamic-patients event log will use.** Not org teams, not a
  role flag. Assignment is data, checked in the request guard.

The whole thing reuses the pattern already shipped: `createAuth` -> `getSession` ->
`c.set(...)` -> route reads it. Roles and assignments become two more things the same
middleware resolves before a handler runs.

## What better-auth 1.6 actually gives you

Three plugins are relevant. They are not interchangeable; they sit at different scales.

**Admin plugin** (verified against the 1.6 admin docs). Adds four columns to the `user`
table: `role` (string, default `"user"`, comma-separated for multiple roles), `banned`
(boolean), `banReason`, `banExpires`. Ships server APIs for create-user, set-role, ban,
unban, impersonate, set-password, list-users, delete-user. Permission checks come three
ways: `auth.api.userHasPermission(...)` (server-side, the one that matters here),
`authClient.admin.hasPermission(...)` (client, round-trips), and
`checkRolePermission(...)` (client, synchronous, no server call, for hiding UI only).
Custom permission sets are declared with `createAccessControl(statement)` where the
statement maps resource names to allowed actions, then `ac.newRole({...})` builds roles.
Critically, it supports `adminUserIds: [...]`: users whose id is in that list are admins
regardless of the `role` column, so you can bootstrap the first admin with zero schema
churn and zero UI.

Cost to adopt: one migration (four columns on `user`), one plugin line, and the client
plugin. Light.

**Organization plugin** (verified against the 1.6 organization docs). Adds
organizations, members, teams, and invitations as first-class tables, with owner/admin/
member roles per org and per team, `invitationExpiresIn`, and dynamic per-org custom
roles. Invitation links are native here: you call the invite API, it creates an
invitation row with an id, and you send a link carrying that id which `acceptInvitation`
consumes. This is the right tool for true multi-tenancy (hospitals, cohorts, a faculty
group that manages its own students). It is also four to five new tables and a
membership model the app does not need yet.

Cost to adopt: heavy relative to current scale. Defer.

**Access control primitive** (`createAccessControl`). Shared by both plugins. This is the
`statement` + `newRole` machinery. It is what you use to say "a `faculty` role can
`read` and `assign` on the `patient` resource, an `admin` can also `create`." You can use
it with the admin plugin without the org plugin.

## Q1: activating elevated permissions

Ryan's three candidate mechanisms, judged against "server-enforceable per request, not
client trust," which is the only property that matters:

- **(a) Coupon code the user types to unlock permissions.** Fine as an *enrollment*
  mechanism, dangerous as an *authorization* mechanism. If the client sends "I typed
  FACULTY2026, treat me as faculty" and the server believes the client on each request,
  it is broken. The safe version: the code is a one-time row in a D1 `invite_code` table
  (`code`, `grantsRole`, `usedBy`, `expiresAt`); redeeming it once, server-side, sets the
  user's `role` column; every later request reads `role` from the session, never the
  code. In that form the code is just a bootstrap for a real server-side role. This is a
  reasonable low-infra fit for onboarding a handful of educators.
- **(b) Admin ID namespace (`hcpId` `a*****` instead of `d*****`).** Reject as a security
  boundary. `hcpId` is deliberately game/display data: server-generated, `input: false`,
  forge-proof precisely because it is *not* trusted input, and it is the persona a trainee
  plays, not who they are. Overloading it as the authorization signal couples identity
  cosmetics to access control and invites a class of bug where changing the played persona
  changes privileges. Keep `hcpId` as flavour. If you want admin accounts to *also* read
  as `a*****` for readability, fine, but derive that from the `role`, do not let the id
  grant the role.
- **(c) Custom signup URLs / invite links.** This is exactly what the organization
  plugin's invitations are, and it is the cleanest native option once you need
  org-scoped invites. Until then it is heavier than (a). A signed invite link is really
  just mechanism (a) with the code in the URL instead of a text field, so the same
  server-side redemption rule applies.

**Recommendation for Q1: admin plugin + `adminUserIds` bootstrap + a D1 invite-code
table for faculty.** Concretely:

1. Add the admin plugin. Put your own user id in `adminUserIds` via a secret
   (`ADMIN_USER_IDS`), so you are admin with no migration and no self-service path that
   could be abused.
2. Define an access-control statement for the domain resources you actually gate
   (`patient`, `case`, `roster`, maybe `user`) rather than reusing the plugin's default
   user-resource actions.
3. For educators, mint one-time invite codes (admin-only endpoint) that redeem into a
   `faculty` role server-side. This avoids standing up the org plugin's table set for
   what is, today, a short list of trusted people.
4. Enforce in the Hono guard. The session already carries `role` once the admin plugin is
   installed, so the middleware that today does `c.set("userId", ...)` also does
   `c.set("role", ...)`, and a small `requireRole("faculty")` / `userHasPermission` check
   guards the privileged routes. Same shape as `work.ts:13-19`.

Adopt the organization plugin only when the unit of tenancy becomes a group that
manages its own membership (a med school, a ward cohort). At that point its invitations
replace the invite-code table.

## Q2: should guests have passwords?

No. Two sub-questions were folded into this: is the "email/password is impossible on
Workers" ruling still true, and does giving guests passwords solve the database-junk and
permission-revocation churn. Both point the same way.

**Is email/password still off the table?** Partly outdated as a *technical* claim, still
correct as a *product* one. The repo's recorded reason (bcrypt/argon2 unusable in
workerd, PBKDF2 capped near 100k iterations) is real, and better-auth's default password
hash is pure-JS scrypt from `@noble/hashes`, which sits right on the edge of the free
tier's 10ms-per-request CPU budget and fails intermittently with "Worker exceeded CPU
time limit" on sign-up (verified: better-auth issues #8860, #8456). The newer wrinkle is
that Workers now expose native `node:crypto.scrypt`, and you can pass a custom
`password.hash`/`verify` using `scryptSync` to get off the pure-JS path, so email/password
is no longer strictly impossible. But that is effort spent to add a credential Legend does
not need: Google already gives a verified durable identity, and guests are meant to be
throwaway. Do not add passwords.

**Does a password fix the junk / churn?** No, and it is the wrong lever. The junk is
abandoned anonymous rows, and phase 3 already ships the fix: a daily cron purges
anonymous users whose sessions all expired past a 30-day cutoff, cascading their notes,
addenda, and attempts (`purge.ts`, `index.ts:29-33`). Passwords would not reduce junk,
they would *increase* it by turning throwaway guests into permanent password rows the
purge can no longer collect. The permission-revocation churn Ryan is feeling is a
symptom of not having a real role model, not of guests lacking passwords; Q1 fixes that
directly.

**If durable guest identity is ever wanted** (a returning user who will not use Google),
the passwordless options both work on Workers and both beat a password:

- **Passkeys / WebAuthn** (better-auth passkey plugin, backed by SimpleWebAuthn, pure JS,
  no heavy hashing, runs on workerd; verified there are working Hono-on-Workers passkey
  demos). Strongest security, but adds a device-registration UX and a table.
- **Magic link or email OTP** (better-auth plugins). These need an email transport.
  Cloudflare Email Service can send from a Worker binding and there is a community
  `better-auth-cloudflare-email` plugin wiring it in, but Cloudflare Email Sending is in
  private beta as of this writing (verified), so treat it as not-yet-reliable
  infrastructure. Google OAuth already covers the "verified email identity" need without
  it.

**Recommendation for Q2: keep guests anonymous and passwordless; keep Google as the only
durable login; rely on the existing purge cron for junk.** Revisit passkeys only if a
concrete "returning non-Google user" requirement appears. Do not add email/password.

## Q3: data model for multiplayer patient responsibility

The requirement: a patient is assigned to specific HCPs, and only they see that chart.
Three shapes were considered.

- **Per-patient ACL rows in D1 (recommended).** A `patient_assignment` table:
  `scope` (the shared-session key), `caseId`, `userId`, `roleOnPatient`
  (`responsible` | `covering` | `observer`), `assignedBy`, `assignedAt`. Visibility of a
  chart becomes a query: does a row exist for this `(scope, caseId, userId)`. This is the
  natural join partner for the dynamic-patients `case_event` log, which already needs a
  `scope` column that is `userId` today and `sessionId` under multiplayer. Assignment is
  data, not a role, so it changes per patient without touching the auth schema, and it
  purges for free under the same FK-cascade discipline the event log uses. Cheapest to
  build, most flexible, and it keeps the auth layer (who you are, what global role you
  hold) cleanly separate from the domain layer (which patients you are on).
- **Role-based only.** A global `role` cannot express "responsible for patient 7 but not
  patient 3," so this fails the requirement on its own. Roles still belong in the model,
  but for *global* capability (admin, faculty, trainee), layered on top of per-patient
  assignment: role says "faculty can assign anyone," assignment says "who is on this
  patient."
- **better-auth organization teams.** Teams could model a ward and its members, and the
  plugin gives invitations and membership for free. But mapping "team = patient" is a
  category error (patients are content, not tenants), and "team = ward" still needs a
  separate patient-to-member assignment table underneath, so you pay for the org tables
  and still write the ACL. Only worth it when the *tenant* (a hospital or cohort that owns
  many cases and manages its own roster) becomes the real unit.

**Recommendation for Q3: per-patient assignment rows in D1, layered under a small global
role set.** Two concepts, kept separate:

1. **Global role** (from the admin plugin): `admin`, `faculty`, `trainee`. Governs
   capabilities that are not patient-specific (assign patients, mint invite codes, author
   cases, impersonate for support).
2. **Per-patient assignment** (the ACL table above): governs chart visibility and who may
   write into a given patient's chart within a shared session.

The request guard resolves both: session -> `userId` + `role` (already there once the
admin plugin lands), then for a patient route, one indexed lookup on
`patient_assignment` to decide visibility. This is the same middleware seam as `work.ts`,
extended by two reads.

**Design the `scope` column in from day one.** `docs/superpowers/specs/user/DYNAMIC_PATIENTS.md` already flags
`scope` (`userId` now, `sessionId` under multiplayer) as the one migration that hurts to
retrofit. The assignment table shares that column and that risk, so settle
`userId`-vs-`sessionId` for both tables together, before either is created. This is the
single decision most expensive to change later.

## How it fits the existing code

Nothing here breaks the current shape. The middleware in `work.ts:13-19` already does
create-auth, get-session, unauthorized-or-continue. The admin plugin makes `role`
available on that same session object, so the guard gains a line, not a rewrite. Route
guards become `requireRole(...)` (a synchronous check on the value the middleware set) or
`auth.api.userHasPermission(...)` (when the check is a fine-grained
resource/action pair). Per-patient reads become one indexed D1 query in the guard. The
`auth.cli.ts` stub must stay identical to `createAuth` (existing rule), so the admin and
any access-control config added to `createAuth` must be mirrored there or schema
generation drifts. The one thing to hold firm on: `hcpId` stays display data, and the
authorization signal is always the server-resolved `role` plus the assignment rows, never
anything the client can assert.

## Sources

Verified against primary docs and issues (fetched 2026-07-10):
- better-auth admin plugin: role/banned schema fields, `userHasPermission` /
  `checkRolePermission`, `createAccessControl`, `adminUserIds` bootstrap
  (better-auth.com/docs/plugins/admin).
- better-auth organization plugin: teams, invitations (id-carrying links,
  `acceptInvitation`), per-org dynamic roles, `invitationExpiresIn`
  (better-auth.com/docs/plugins/organization).
- Workers password-hash reality: pure-JS scrypt on the 10ms free-tier CPU edge, native
  `node:crypto.scrypt` workaround (better-auth issues #8860 and #8456; Cloudflare Workers
  limits page: free tier 100k req/day, 10ms CPU/request).
- Passkey on Workers: better-auth passkey plugin (SimpleWebAuthn), working Hono-on-Workers
  demos (better-auth.com/docs/plugins/passkey; FabioDiCeglie/Passkey).
- Email transport: better-auth magic-link and email-OTP plugins; Cloudflare Email Service
  send-from-Worker binding and the community `better-auth-cloudflare-email` plugin;
  Cloudflare Email Sending is in private beta
  (better-auth.com/docs/plugins/magic-link, developers.cloudflare.com/email-service,
  paulstenhouse/better-auth-cloudflare-email-plugin).

Codebase, read directly: `src/worker/auth.ts` (current `createAuth`, `hcpId`
`input: false` + `databaseHooks`), `src/worker/work.ts` (session-guard middleware
pattern), `src/worker/purge.ts` + `src/worker/index.ts` (30-day anon purge cron),
`STATUS.md` (phase-3 state, the recorded no-password decision),
`docs/superpowers/specs/user/DYNAMIC_PATIENTS.md` (the `scope` column and the
multiplayer-migration warning).

Inferred, not from a primary source: the invite-code table shape, the
`patient_assignment` table shape, the `role` set (`admin`/`faculty`/`trainee`), and the
judgement calls on which plugin to adopt when. These are design proposals for the SPEC,
not verified library behaviour.

All patient data are synthetic. For education and simulation only. Not for clinical use.
