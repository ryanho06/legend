import type { ClinicalNote, NoteCategory, NoteDraft, NoteStatus, UserProfile } from "../types";

/** Building user-authored notes out of editor drafts. Pure; no React. */

const CATEGORY_BY_TYPE: Record<string, NoteCategory> = {
  "Progress Note": "Progress",
  "H&P": "H&P",
  "Consult Note": "Consults",
  "Procedure Note": "Procedures",
  "Nursing Note": "Nursing",
  "Discharge Summary": "Discharge",
};

/** DD/MM HH:MM, matching the app's absolute-time convention. */
export function formatStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildUserNote(
  draft: NoteDraft,
  user: UserProfile,
  plainBody: string,
  status: NoteStatus,
  now: Date,
): ClinicalNote {
  const stamp = formatStamp(now);
  const timestamp = Math.floor(now.getTime() / 1000);
  return {
    kind: "note",
    id: `user-note-${timestamp}-${draft.id}`,
    encounterId: "enc-admission",
    category: CATEGORY_BY_TYPE[draft.noteType] ?? "Progress",
    noteType: draft.noteType,
    author: `${user.surname.trim()}, ${user.forename.trim()}`,
    authorId: user.hcpId,
    credential: "MS",
    authorRole: "*MEDICAL STUDENT",
    service: draft.service,
    dateOfService: stamp,
    fileTime: status === "signed" ? stamp : "—",
    timestamp,
    status,
    admission: true,
    body: plainBody,
  };
}

/** Random runtime doctor ID; the d9 range is reserved for generated logins. */
export function generateHcpId(): string {
  return `d9${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
}

/**
 * A note is yours if its authorId matches your login or the persona this case
 * assigns you. The user-note- prefix is a backstop for notes stored before
 * doctor IDs existed.
 */
export function isOwnNote(
  note: ClinicalNote,
  userHcpId: string,
  playerHcpId?: string,
): boolean {
  if (note.id.startsWith("user-note-")) return true;
  if (!note.authorId) return false;
  return note.authorId === userHcpId || note.authorId === playerHcpId;
}

/** Stamped addendum block, matching the static attestation style in case data. */
export function buildAddendumBlock(user: UserProfile, text: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `ADDENDUM — ${user.surname.trim()}, ${user.forename.trim()}, MS — ${stamp}:\n${text}`;
}

export function appendAddendum(existing: string | undefined, block: string): string {
  return existing ? `${existing}\n\n${block}` : block;
}

/** Re-file an edited incomplete user note in place: same identity, new content. */
export function refileUserNote(
  original: ClinicalNote,
  draft: NoteDraft,
  plainBody: string,
  status: NoteStatus,
  now: Date,
): ClinicalNote {
  const stamp = formatStamp(now);
  return {
    ...original,
    noteType: draft.noteType,
    category: CATEGORY_BY_TYPE[draft.noteType] ?? original.category,
    body: plainBody,
    status,
    timestamp: Math.floor(now.getTime() / 1000),
    dateOfService: stamp,
    fileTime: status === "signed" ? stamp : "—",
  };
}
