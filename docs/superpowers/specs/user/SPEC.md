# SPEC: Phase 3 — Server-side notes, addenda, and attempts (D1 persistence)

> Durable design contract. Survives `/clear` and compaction. Edit this, not your memory.
> Previous spec (phase 2, real accounts): SHIPPED 2026-07-10, lives in git history.

Status: SHIPPED 2026-07-10 (all tasks incl. the gated T13: remote migrations 0002+0003, deployed, live-verified; plus a post-ship wave: profile/aliases, guest Google-link button, staff-ID display). Plan: PLAN.md (historical). Execution record: .superpowers/sdd/progress.md.
Depends on: Phase 2 (better-auth accounts, everyone is a server-side user), SHIPPED 2026-07-10.

## Context (why)

The trainee's work (signed/pended notes, addenda, wrap-up attempts) lives in
localStorage. It dies on sign-out, never follows the user across devices, and
blocks phase 4 (Patient Message + LLM feedback need the user's notes on the
server). Phase 3 moves the three work stores to D1, keyed on the better-auth
account, and retires their localStorage keys.

## Decisions (resolved forks, do not re-litigate)

1. **Scope: notes + addenda + attempts.** Sticky notes stay device-local
   scratch. Unsigned editor drafts stay in-memory (the phase-0 dispute is
   untouched by this phase).
2. **Guests persist like Google users.** One code path; guest work lives under
   their anonymous `user.id`. A purge job handles abandonment (below).
3. **No localStorage import, clean break.** Pre-phase-3 device data is
   abandoned (it is Ryan's test data; there are no real users yet). The
   `onLinkAccount` re-key (below) replaces the import as the guest-to-Google
   migration path.
4. **Server-authoritative, thin client.** D1 is the only store. Fetch on chart
   open, write through the API, update React state on success. No cache, no
   sync engine.
5. **Ownership is better-auth `user.id`, never `hcpId`** (phase-2 review
   warning: hcpId is non-unique with a 100k value space). `hcpId` remains
   display data inside the note payload.

## Schema (migration 0002)

Three tables, all `REFERENCES user(id) ON DELETE CASCADE` (D1 enforces FKs):

```sql
user_note      id TEXT PK (server UUID), user_id, case_id, status ('signed'|'incomplete'),
               payload TEXT (ClinicalNote JSON), created_at, updated_at
               INDEX (user_id, case_id)
note_addendum  id TEXT PK, user_id, case_id, note_id (static or user note), body, created_at
wrapup_attempt PK (user_id, case_id), text, at, signed, updated_at   -- upsert, last attempt only
```

JSON payload + indexed ownership columns: the note type can evolve without
migrations; the server owns identity and ownership, the payload owns display
fields. Addenda are one row each; the client folds them with the existing
`appendAddendum`. `wrapup_attempt` keeps the current last-attempt-only
semantics.

## API (Hono, session-gated)

Middleware resolves the better-auth session once per request
(`auth.api.getSession`); no session is a 401. Routes:

- `GET  /api/cases/:caseId/work` — one fetch per chart open: `{ notes, addenda, attempt }`
- `POST /api/cases/:caseId/notes` — Sign or Pend a draft; server assigns id + timestamps
- `PUT  /api/notes/:id` — refile an edited incomplete note (ownership-checked)
- `DELETE /api/notes/:id` — delete an own user note
- `POST /api/notes/:id/addenda` — append an addendum
- `PUT  /api/cases/:caseId/attempt` — upsert the wrap-up attempt
- `DELETE /api/cases/:caseId/attempt` — clear it ("Try another note" persists the reset)

Server generates note ids (`crypto.randomUUID()`), retiring the `user-note-`
prefix as an identity mechanism. Validation is minimal hand-rolled shape checks
(no zod; consistent with the no-ORM stance). Every write checks
`user_id = session.user.id`.

## Client

- New `src/lib/api.ts` fetch wrapper (JSON in/out, credentials included, typed
  errors).
- `PatientWorkspace` swaps `usePersistentState(userNotesKey/addendaKey)` for a
  `useCaseWork(caseId)` hook: fetch on mount (the workspace already remounts
  per case), hold in React state, mutate via API-then-setState. Static
  documents render immediately; user notes merge in when the fetch lands.
- `WrapUpModule` reads the attempt from the same fetched state, not
  localStorage.
- Ownership: `GET /work` filters by the session user, so every fetched user
  note is the user's own by construction (no flag needed). `isOwnNote`
  survives only for the static `playerHcpId` persona-note case; the
  `user-note-` prefix backstop is deleted.
- `signOut` keeps its sweep (now clears only sticky/scratch keys). The three
  work keys (`legend-user-notes-*`, `legend-addenda-*`, `legend-wrapup-*`) die.
- Rides along: delete `generateHcpId` from `src/lib/userNotes.ts` (dead since
  the server took over) and the dead `USER_KEY`.

## Guest lifecycle

- **Upgrade:** `onLinkAccount` re-keys the anonymous user's rows to the new
  Google user (`UPDATE ... SET user_id` on the three tables). This replaces
  the localStorage import promised in the phase-2 spec.
- **Purge:** daily cron trigger on the worker deletes anonymous users with no
  session row newer than 30 days; FK cascades wipe their work. Closes the
  phase-2 review warning about unbounded anon rows.

## Error handling

- 401 mid-session: surface the sign-in gate.
- Failed write: keep the editor/draft state intact and show the failure. A
  failed Sign never destroys the draft.

## Testing / verify targets

- API tests in the real-D1 workers pool (extends the existing
  `auth.workers.test.ts` project): CRUD, ownership rejection, 401 without a
  session, cascade on user delete, `onLinkAccount` re-key.
- Pure-lib node tests unchanged (182 tests keep passing).
- `npx tsc -b`, `npm run lint`, `npm run build`, browser click-through
  (guest sign-in, Sign a note, reload, note still there; sign out and back in
  as Google, work follows the account after linking).

## Out of scope

- Unsigned draft autosave (phase 0, disputed, separate decision).
- Sticky notes server-side.
- Patient Message + LLM proxy (phase 4).
- Persona name change after creation.
