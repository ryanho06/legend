import type { Note } from "../types";

/**
 * Whether the CURRENT persona may EDIT or DELETE a note. In a real chart you
 * only rewrite or withdraw your own notes; addenda, by contrast, are universal
 * (any HCP appends to any note) and are deliberately NOT gated here (the
 * addendum action is gated only by note status at the callsite). Server-side,
 * work ownership is the account (better-auth user.id); this is a client-only
 * realism layer that keeps aliases from editing each other's notes. Pure; no React.
 *
 * - userNotes: every note the server returned for this account + case.
 * - myHcpId:   the live persona's doctor id (UserProfile.hcpId).
 */
export function noteOwnership(
  note: Note,
  args: { userNotes: Note[]; myHcpId: string },
): { canEdit: boolean; canDelete: boolean } {
  const { userNotes, myHcpId } = args;
  const isAccountNote = userNotes.some((n) => n.id === note.id);
  // Authored by the persona currently signed in; a legacy account note with no
  // stamped authorId is grandfathered to the current persona.
  const mine = isAccountNote && (note.authorId == null || note.authorId === myHcpId);
  return { canEdit: mine, canDelete: mine };
}
