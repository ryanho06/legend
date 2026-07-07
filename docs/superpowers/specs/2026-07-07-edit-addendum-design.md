# Edit and Addendum for self-authored notes

Date: 2026-07-07
Status: approved

## Goal

Make NotePreview's decorative Addendum button functional for notes the trainee owns:

- Incomplete notes you filed (Pend): button reads **Edit** and reopens the note in the note editor pane so it can be finished and re-filed.
- Complete notes you authored (your signed notes, plus static case notes whose author ID matches the persona you play, e.g. `note-prog-003` in cholangitis001): **Addendum** opens an editor tab whose signed text is appended to the note's addendum block.

## Non-goals

- No editing of static case notes (even persona-owned ones); static content is immutable. Only the addendum overlay grows.
- No ID sweep across all cases and staff surfaces now; `authorId` is optional, populated where ownership matters (cholangitis001 first). A full staff-ID sweep is future work.
- No cosign workflow changes; the Cosign button stays decorative.
- No rubric scoring of addenda; the Performance dock is for full notes only.

## Ownership model: HCP IDs

Every person can carry a stable clinician identifier: a doctor ID in the format `d` + 6 digits (e.g. `d123456`), mirroring real hospital staff logins. Other professions get their own prefixes later (pharmacy, nursing, physio); ownership is an ID comparison, which scales to future accounts and multiplayer.

- `UserProfile` gains `hcpId: string`, generated once at sign-in (random `d9#####`; the leading 9 is reserved for runtime-generated users so authored case staff, who use `d0#####`-`d8#####`, can never collide). Persisted with the profile in `legend-user`. Future account systems replace generation with server-assigned IDs; nothing else changes.
- `ClinicalNote` gains `authorId?: string`. Notes without one are ownable by nobody (today's behavior for all static notes). `buildUserNote` stamps `authorId: user.hcpId` on trainee-filed notes.
- Each case may declare the persona the trainee plays: `playerHcpId?: string` on `CaseBundle` (set in the registry entry). This is the piece a bare ID comparison cannot provide: the case saying "in this chart, you are this resident". Documented in CASE_AUTHORING.md.
- Ownership rule (pure helper in `src/lib/userNotes.ts`):
  `isOwnNote(note, userHcpId, playerHcpId) = !!note.authorId && (note.authorId === userHcpId || note.authorId === playerHcpId)`, with a backstop: user notes are also recognized by their `user-note-` id prefix so stored notes filed before this change keep working.
- cholangitis001: Mensah, Daniel gets a doctor ID (e.g. `d284617`); his notes (including `note-prog-003`) get `authorId`, and the case registry entry sets `playerHcpId` to it. Other cases and staff surfaces (encounters, care team) can adopt IDs later; the field is optional everywhere, so partial population is safe.

## Button rules (NotePreview)

Follows the existing Delete pattern: the parent passes a callback only when the action is allowed; the button disables with a tooltip otherwise.

- `note.status === "incomplete"` and the note is a user note (`user-note-` prefix): the Addendum slot renders as **Edit** (pencil icon), live.
- `note.status` is `signed` or `cosign` and `isOwnNote(...)` is true: **Addendum**, live.
- Anything else: **Addendum**, disabled, tooltip "Only your own notes can be addended".
- New optional props: `onEdit?: () => void`, `onAddendum?: () => void`. Wired through `NotesBrowser` (both the Notes activity and Chart Review > Notes render it) the same way `onDelete` flows today. `DocumentPanel`'s NotePreview stays read-only (no callbacks), matching Delete.

## Draft model

`NoteDraft` gains two optional fields: `mode?: "edit" | "addendum"` and `targetNoteId?: string`. Absent mode = a normal new note; existing behavior unchanged.

### Edit flow (incomplete user notes)

- Opening: build a draft from the stored note (`noteType`, `service`, `targetNoteId: note.id`, `mode: "edit"`), with `body` produced by a new pure helper `plainTextToEditorHtml(text)` in `src/lib/smarttext.ts` (it lives beside the chip markup and escaping helpers it uses, avoiding a circular import with noteText): HTML-escapes the text, wraps lines in `<div>` (blank lines as `<div><br></div>`), and reconstitutes literal `***` tokens into SmartText wildcard chips (`<span class="st-wildcard" contenteditable="false">***</span>`, imported from `lib/smarttext`). Chip reconstitution preserves the Sign gate across the pend/edit round trip; without it a half-finished SmartText note could be signed.
- If a draft for that `targetNoteId` is already open, focus it instead of opening a duplicate.
- Filing: Sign/Pend replaces the stored note in place: same id, same author fields, updated `body`, `status`, `timestamp`, `dateOfService`/`fileTime` stamps. Signing runs the normal Wrap-Up feedback (it is a full note). Closing the tab without filing keeps the original untouched.
- If the target note was deleted while the draft was open, filing falls back to appending as a new note.

### Addendum flow (signed/cosign own notes)

- Opening: empty draft, `mode: "addendum"`, `targetNoteId`, `noteType: "Addendum"`, service copied from the target note. If an addendum draft for that note is already open, focus it.
- Editor in addendum mode: tab labelled "Addendum", the note-type dropdown is replaced by a fixed "Addendum" label, the Pend button is hidden (addenda are signed directly, as in Epic), SmartText and the wildcard Sign gate still work.
- Signing appends a stamped block to the note's addendum overlay and closes the tab. No Performance dock. Block format matches the existing static addendum style:
  `ADDENDUM — Surname, Forename, MS — DD/MM/YYYY HH:MM:` followed by the text. Multiple addenda stack separated by blank lines.

## Addendum storage

- One runtime overlay per case: localStorage key `legend-addenda-<caseId>` (builder `addendaKey(caseId)` added to `src/lib/session.ts`; the `legend` prefix means `signOut()` sweeps it automatically). Value: JSON map `{ [noteId]: string }`.
- Merge at display time in `PatientWorkspace`, where user notes already merge: any note (static or user) with an overlay entry renders `addendum = [static addendum if any, overlay].filter(Boolean).join("\n\n")`. `note-prog-003` already has a static attending attestation addendum; trainee addenda append after it.
- Corrupt JSON degrades to an empty map (same defensive pattern as `parseUserNotes`).

## Testing

- Vitest (`src/lib` convention): `plainTextToEditorHtml` (escaping, div/blank-line structure, `***` chip reconstitution), `isOwnNote` (authorId match vs user, vs player persona, missing authorId, prefix backstop), the addendum block builder (stamp format, stacking), and the edit-refile helper (id/author preserved, status/body/stamps updated).
- Browser verify at the end: pend a SmartText note with chips, Edit it, confirm chips are back and Sign stays gated; sign it and confirm scoring; add two addenda to `note-prog-003` and confirm they stack under the attending attestation; confirm Addendum is disabled on a colleague's note.
