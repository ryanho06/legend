# Pre-Multiplayer Fixes: Spec

Date: 2026-07-11
Status: Approved (design), pending spec review
Scope owner: Ryan
Branch: `main` (fixes land here, then push, then a separate multiplayer branch)

## 1. Purpose

Four contained singleplayer fixes to land before the multiplayer branch diverges. They
are near-independent and share no new schema. Grounded against the code by a five-area
scan on 2026-07-11 (see Appendix A for the file references each fix depends on).

The real sequencing gate: `main` is not yet pushed to origin (the whole Plan 3/4 line,
`8a7fe65..b8c8856`). Order is fixes, then push, then branch multiplayer off a stable
origin `main`.

## 2. Scope

In scope (this spec):
- Fix A: guest to Google account link keeps the guest identity as the default persona.
- Fix B: alias note-edit realism gate (client) plus an addendum ownership check (server).
- Fix C: page-reload persistence (full resume) of the open workspace.
- Fix D: a singleplayer "next job" hint banner.

Out of scope (deferred to their own spec, do not start here):
- Multiplayer transport, server-authoritative clock, the deferred `case_event` log.
- The hospital-select shell and any URL routing.
- A deployed `legend-dev` environment. localhost single-process plus the local D1
  replica remains the dev loop for this batch.
- The `patient_assignment` ACL and the admin/role model from `docs/PERMISSIONS_RESEARCH.md`.

## 3. Decisions already made

Confirmed with Ryan on 2026-07-11:
1. Fix B is a client-side realism gate, not server enforcement. Aliases are multiple
   personas under one better-auth `user.id`, so a server rule would be self-bypassable
   (the same human controls every alias and can Switch back). The server authorization
   stays keyed on `user.id`. The per-alias distinction is a training nudge only.
2. Fix C is full resume: navigation, open note-preview tabs (which requires lifting them
   into `CaseUiState`), and live unsigned draft bodies. All localStorage, no backend.
3. Execution is spec first, then a plan, then subagent-driven with review checkpoints.
4. Fix A keeps the guest's `hcpId` (and name and grade) on link; the Google display name
   is discarded; no new alias is created. `hcpId` has no UNIQUE constraint on `user`
   (migration 0001), so copying the guest's `hcpId` onto the Google row while the guest
   row still exists cannot violate a constraint.
5. Fix D's dismiss control is a global device toggle (one-time "turn it off"), and it is
   hidden by default under multiplayer (an inert seam until multiplayer exists).

## 4. Fix A: guest to Google link keeps the guest identity

### Problem
On account link, `rekey.ts` snapshots the guest persona into `user_alias` as a previous
alias, and the Google user row is created with null `forename`/`surname`/`grade`. The app
then forces the persona-setup screen prefilled with the Google display name, so the Google
name becomes the default and the guest persona (the one the trainee actually chose and
wrote notes under) is demoted to a Switch-back alias.

### Change
In `rekeyUserWork` (`src/worker/rekey.ts`): after re-keying the guest's work rows onto the
linked account, replace the `ensureSnapshot(toUserId, outgoingGuestPersona)` call with a
direct write of the guest persona onto the Google user row:

```
UPDATE "user"
SET forename = ?, surname = ?, grade = ?, hcpId = ?
WHERE id = <googleUserId>
```

This mirrors the direct-D1 update `profile.ts` switch already uses (needed because `hcpId`
is `additionalFields input:false` and better-auth `updateUser` 400-rejects it). The guest's
prior aliases still move across (the existing `user_alias` re-key at `rekey.ts:28` is kept);
only the current persona stops being demoted.

### Consequence: no App change required
Once the Google row carries a full persona, `App.tsx` derives a complete `UserProfile` and
the persona-setup screen never fires. The Google display name is not read.

### Edge cases
- Guest persona incomplete: guests always have a full persona (set at "Start training",
  `hcpId` server-generated), so `currentPersona(guest)` is complete. Still, guard: if the
  guest persona lacks an `hcpId`, skip the write and fall back to the existing setup path
  rather than writing nulls.
- Prior aliases: a guest who had already switched personas carries those `user_alias` rows
  across unchanged (kept behavior).

### Acceptance
- Browser: guest sets persona "Alice Smith", writes a note, links Google "Bob Jones".
  After the redirect there is no persona-setup screen; the active persona is "Alice Smith"
  with the guest's `hcpId`; ProfileMenu shows no new previous alias; Alice's note is intact.
- The persona write must land before the client re-reads the session on redirect. The scan
  confirms `rekey` runs before the anonymous-user deletion, so this should hold; it must be
  proven in the browser, not assumed.
- Workers-pool test (edit-append to the existing rekey/auth test file, never overwrite):
  after `rekeyUserWork(guest, google)`, the Google `user` row has the guest's four persona
  fields, and `user_alias` gained no row for that persona.

## 5. Fix B: alias note gate (client) plus addendum hole (server)

> **Amendment (Ryan, 2026-07-11, decided during execution):** the server-side addendum
> ownership check described below was implemented, then REMOVED. Addenda are UNIVERSAL —
> any HCP addends any note, the same way a colleague adds a note to a real chart (an FY2
> signs, a registrar or consultant addends to escalate or cosign; the competence penalty is
> the guardrail here, not access control). `canAddend` does not exist: the client gates the
> Addendum affordance only by `status !== "incomplete"`. Only edit and delete are
> persona-gated (`canEdit`/`canDelete` from `src/lib/noteOwnership.ts`, which takes no
> `playerHcpId` argument). The rest of this section, including the `SELECT 1 FROM
> user_note ...` 404 check and the `canAddend` rule below, describes the ORIGINAL plan and
> is superseded by this amendment; kept for the record, not as current behavior.

### Problem
- Client: note ownership predicates in `PatientWorkspace.tsx` key on account membership
  (`isUserNote`) and the static case-level `playerHcpId`, with zero alias awareness. After
  switching persona, the previous persona's notes are still fully editable and deletable.
- Server: `POST /notes/:id/addenda` (`work.ts:92-108`) performs no ownership check on the
  target note. It stamps the caller's `userId` onto a caller-supplied `noteId`. Read-back
  re-scopes by `userId`, so cross-user impact is limited today, but it is a real gap and
  becomes load-bearing under multiplayer.

### Change: client realism gate
Thread the live persona's `hcpId` (from the `UserProfile` already derived in `App.tsx`)
into `PatientWorkspace` as a prop. Extract a pure helper into `src/lib/` (React-free,
unit-tested):

```
noteOwnership(note, { userNotes, myHcpId, playerHcpId }) -> {
  canEdit:   boolean,  // note is your account's AND authored by your CURRENT persona
  canDelete: boolean,  // same rule as canEdit
  canAddend: boolean,  // any note your account owns (cross-clinician, like a real chart)
}
```

Rules:
- `isUserNote = userNotes.some(n => n.id === note.id)` (server returned it for your account).
- `canEdit = canDelete = isUserNote && (note.authorId === myHcpId || note.authorId == null)`.
  The null-`authorId` grandfather covers any legacy owned note without a stamped author;
  all notes from `buildUserNote` always stamp `authorId`, so in practice this is the
  current-persona check.
- `canAddend = isUserNote || note.authorId === playerHcpId`. Unchanged from today's
  `ownNote`: you addend any note your account owns, including the static case-persona note
  you play. Addenda are cross-clinician in a real chart.

`PatientWorkspace` uses `canEdit`/`canDelete`/`canAddend` to gate the Reopen-for-edit,
Delete, and Addendum affordances respectively (the "incomplete note" precondition on
Reopen is orthogonal and stays).

Result: play as Alice, write a note, switch to Bob. Alice's note is Edit-locked and
Delete-locked for Bob, but still Addendum-able, exactly like a colleague's note.

### Change: server addendum ownership check
In the addendum route (`src/worker/work.ts`), before the INSERT, verify the target note
belongs to the caller:

```
SELECT 1 FROM user_note WHERE id = ? AND userId = ?   -- 404 if absent
```

Keyed on `user.id` (account level), consistent with the client-only decision (section 3,
item 1): the alias distinction is client-only; the server boundary stays the account.

### Acceptance
- Node-pool test for `noteOwnership`: current-persona note is editable/deletable/addendable;
  other-persona note (same account) is addend-only; static case-persona note is addend-only;
  a note not owned by the account is none.
- Workers-pool test (edit-append): addendum to a note not owned by the caller returns 404;
  addendum to an owned note still succeeds.
- Browser: switch persona, confirm the other persona's note shows Addendum but not
  Edit/Delete.

## 6. Fix C: reload persistence (full resume)

### Problem
All top-level navigation is plain `useState` in `App.tsx` (`openCaseIds`, `activeCaseId`,
the per-case `caseUi` map), wiped on reload. There is no router; reload always lands on the
empty patient-list activity. Server work (signed/pended notes, `simNow`) survives but only
re-appears once a case tab is re-opened. The Notes-activity preview tabs are component-local
in `NotesBrowser` and are wiped even on a main-tab switch today, let alone reload.

### Change: persist the top-level nav blob
Persist `{ openCaseIds, activeCaseId, caseUi }` to localStorage under `legend.session.<userId>`
(keyed by the better-auth user id so a shared device does not leak one trainee's tabs to the
next; sign-out's existing `legend*` sweep clears it). A debounced effect in `App.tsx` writes
the blob; use manual `JSON.stringify` (the pattern `StickyNotePopup` already uses for its
layout), since the existing `usePersistentState` hook is string-only.

### Change: hydrate safely
A pure `hydrateSession(raw, isKnownCase) -> { openCaseIds, activeCaseId, caseUi }`
(unit-tested), applied on mount once the session user id is known:
- Drop any `openCaseIds` entry not in the registry (guards the `getCase`-throws white-screen
  when a case was renamed or removed).
- Prune `caseUi` to surviving open cases (mirror the `closeCase` cleanup so stale per-case UI
  cannot resurrect).
- Tolerate malformed or absent JSON by returning empty state.
- If `activeCaseId` is no longer in the pruned `openCaseIds`, reset it to null (patient list).

### Change: lift the Notes preview tabs into CaseUiState
Add `openNoteIds: string[]` and `activePreviewId: string | null` to `CaseUiState`.
`NotesBrowser` reads and writes them through the existing `ui`/`onPatch` props instead of
local `useState`. This also fixes the latent bug where those tabs vanish on a main-tab
switch (they now live in the surviving `caseUi` map). Ephemeral view state (`query`,
`listCollapsed`, frozen tab width) stays local and resets on reload, which is fine.

### Drafts ride along
`editors` (and `activeEditorId`) are already in `caseUi`, so live unsigned draft bodies
persist with the blob. No backend and no separate handle. Draft bodies are contentEditable
HTML strings, which are serializable.

### Edge cases
- `closeCase` already deletes `caseUi[id]` (`App.tsx`); the persisted mirror stays clean.
- StrictMode double-invokes effects in dev; the write must be idempotent (a plain overwrite
  of the blob is).
- Do not push per-case persistence into a component that survives a case switch without the
  keyed remount. Persistence lives at the App level, outside the keyed `PatientWorkspace`
  remount, which is safe.

### Acceptance
- Node-pool test for `hydrateSession`: unknown case id dropped; `caseUi` pruned to open
  cases; malformed JSON to empty; dangling `activeCaseId` reset.
- Browser: open two patient tabs, a main tab, a right-rail document, several note-preview
  tabs, and an in-progress unsigned draft. Reload. All of the above are restored, and the
  draft body is intact.
- Browser: sign out, sign in as a different user on the same device; the previous user's
  open tabs do not appear.

## 7. Fix D: next-job hint banner

### Problem
Singleplayer has no team, so "what should I write now" is unclear. The signal already
exists (`currentRound(rounds, simNow)` is computed as `activeRound` in `PatientWorkspace`),
but it is only used to stamp a note's encounter and is never surfaced.

### Change
A new `NextJobBanner`, mounted at the strip below `MainTabBar` in `PatientWorkspace`
(where the save-error banner already renders and `activeRound` plus the rubric are already
in scope). It reads a pure helper:

```
nextJob({ rounds, simNow, userNotes, task }) -> { label, done } | null
```

- Dynamic case (rounds authored): `label = currentRound.label`; `done = true` once a user
  note covers that round's `encounterId` (the same "you" status `buildContribution` derives,
  so there is one source of truth). When `done`, hide the banner for v1 (advancing it to
  restate the next round's job is a possible later enhancement, not required here).
- Static case (no rounds): fall back to `task.label` from `CaseRubric.task` (always present)
  as a persistent "Your task" hint.
- `RoundSpec.label` and `CaseTask.label` currently disagree in wording for the same day-1
  job; the banner uses `RoundSpec.label` when rounds exist, else `task.label`.

Controls:
- Dismissible via a global device toggle `legend.hideNextJob` (localStorage, one-time
  "turn it off everywhere", matching the sticky/skip-delete-confirm device-pref pattern).
- An `isMultiplayer` seam that returns `null` (no per-you job under multiplayer). Inert now,
  since no multiplayer flag exists; wire it as a constant `false` with a clear comment.

### Acceptance
- Node-pool test for `nextJob`: dynamic case before the round note exists returns the
  round label with `done:false`; after a covering user note, `done:true`; static case
  returns `task.label`; empty schedule and no task never throws.
- Browser: on cholangitis001 the banner reads the current round's job, and hides/advances
  after that round's note is written; the global toggle removes it and the removal survives
  reload.

## 8. Verification (whole batch)

Runnable targets, all must be green before the batch is considered done:
- `npx tsc -b`
- `npm test` (node pool; the new pure helpers `noteOwnership`, `hydrateSession`, `nextJob`
  get unit tests here)
- `npm run test:workers` (real local D1; the rekey persona write and the addendum
  ownership check get tests here, edit-appended to existing files, never overwriting)
- `npm run lint`
- `npm run build`
- Browser click-throughs per each fix's Acceptance section (chrome-devtools-axi), on a
  fresh guest and on cholangitis001 for the dynamic-loop parts.

Test-file discipline (standing process guard from the Plan 4b incident): any change to a
test file must Edit-append, never Write over it; reviewers check diffs for large unexplained
deletions.

## 9. Execution

Order A, B, C, D (near-independent; this order puts the worker-only change first and the
largest client refactor, C, third). Single-threaded on edits; reads and research may
parallelize. Subagent-driven with a review checkpoint per fix. Per-task reports and review
diffs go in `.superpowers/sdd/` alongside the existing ledger; update `STATUS.md` at the
end of the block.

After the batch is green and browser-verified: reconcile docs (`STATUS.md`, `CLAUDE.md`
gotchas that this touches, `README` if user-facing), then Ryan pushes `main`, then the
multiplayer branch starts from its own brainstorm and spec.

## 10. Risks and open items

- Fix A redirect timing: the persona write must be visible to the client's first
  post-redirect session read. Proven only in the browser (Acceptance A).
- Fix C scope creep: only `openNoteIds` and `activePreviewId` are lifted from `NotesBrowser`;
  resist lifting the ephemeral view state. Keep the refactor minimal.
- Fix D two-strings drift: keep `RoundSpec.label` vs `CaseTask.label` as the documented
  source order; do not try to unify the two strings in this batch.
- None of the four touches the `case_session` schema or the `scope` column, so none
  interacts with the deferred multiplayer keying decision.

## Appendix A: grounded references (from the 2026-07-11 scan)

Fix A: `src/worker/rekey.ts:18,26,28,31`, `src/worker/persona.ts:15,37`,
`src/worker/profile.ts:53-59`, `src/worker/auth.ts:22,45`, `src/App.tsx:33-42,92-107`,
`migrations/0001_better_auth_init.sql:3` (no UNIQUE on `hcpId`), `migrations/0003_user_alias.sql`.

Fix B: `src/worker/work.ts:13-19,26,73-78,82-88,92-108`, `src/lib/userNotes.ts:38-43`,
`src/lib/api.ts:32-51`, `src/components/PatientWorkspace.tsx:62-65,128-132`,
`src/types.ts:97-98,404`, `migrations/0002_user_work.sql:3,7`.

Fix C: `src/App.tsx:46-50,22-29,59-68,76-88`, `src/types.ts:225-235,241-248`,
`src/components/PatientWorkspace.tsx:114-177`, `src/components/chart/NotesBrowser.tsx:80-113`,
`src/hooks/usePersistentState.ts:4-13`, `src/components/StickyNotePopup.tsx:13,51-57`,
`src/lib/session.ts:5,15-22`, `src/main.tsx` (no router).

Fix D: `src/lib/rounds.ts:10,19`, `src/lib/contribution.ts:42,55`, `src/types.ts:207,290,466`,
`src/data/patients/cholangitis001/events.ts:273`, `src/data/patients/cholangitis001/rubric.ts:15`,
`src/components/wrapup/ContributionTracker.tsx:3`, `src/components/PatientWorkspace.tsx:94,234,326`.
