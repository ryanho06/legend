import type { ClinicalNote, NoteCategory, NoteDraft, NoteStatus, UserProfile } from "../types";
import { gradeAuthorRole, gradeCredential } from "./grades";
import { formatDate, formatNoteStamp, formatTime } from "./simTime";

/** Building user-authored notes out of editor drafts. Pure; no React. */

const CATEGORY_BY_TYPE: Record<string, NoteCategory> = {
  "Progress Note": "Progress",
  "Post-Take Ward Round": "Progress",
  "H&P": "H&P",
  "Consult Note": "Consults",
  "Procedure Note": "Procedures",
  "Nursing Note": "Nursing",
  "Discharge Summary": "Discharge",
};

/** DD/MM HH:MM, matching the app's absolute-time convention (wrap-up "at"). */
export function formatStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildUserNote(
  draft: NoteDraft,
  user: UserProfile,
  plainBody: string,
  status: NoteStatus,
  nowSec: number,
  encounterId = "enc-admission",
): ClinicalNote {
  const stamp = formatNoteStamp(nowSec);
  return {
    kind: "note",
    id: "", // the server assigns the real id when the note is POSTed
    encounterId,
    category: CATEGORY_BY_TYPE[draft.noteType] ?? "Progress",
    noteType: draft.noteType,
    author: `${user.surname.trim()}, ${user.forename.trim()}`,
    authorId: user.hcpId,
    credential: gradeCredential(user.grade),
    authorRole: gradeAuthorRole(user.grade),
    service: draft.service,
    dateOfService: stamp,
    fileTime: status === "signed" ? stamp : "—",
    timestamp: nowSec,
    status,
    admission: true,
    body: plainBody,
  };
}

/** Stamped addendum block, matching the static attestation style in case data. */
export function buildAddendumBlock(user: UserProfile, text: string, nowSec: number): string {
  const stamp = `${formatDate(nowSec)} ${formatTime(nowSec)}`;
  return `ADDENDUM — ${user.surname.trim()}, ${user.forename.trim()}, ${gradeCredential(user.grade)} — ${stamp}:\n${text}`;
}

export function appendAddendum(existing: string | undefined, block: string): string {
  return existing ? `${existing}\n\n${block}` : block;
}

/** Fold server addendum rows into the per-note display blocks. */
export function foldAddenda(
  rows: { noteId: string; body: string; createdAt: number }[],
): Record<string, string> {
  const folded: Record<string, string> = {};
  for (const row of [...rows].sort((a, b) => a.createdAt - b.createdAt)) {
    folded[row.noteId] = appendAddendum(folded[row.noteId], row.body);
  }
  return folded;
}

/** Re-file an edited incomplete user note in place: same identity, new content. */
export function refileUserNote(
  original: ClinicalNote,
  draft: NoteDraft,
  plainBody: string,
  status: NoteStatus,
  nowSec: number,
): ClinicalNote {
  const stamp = formatNoteStamp(nowSec);
  return {
    ...original,
    noteType: draft.noteType,
    category: CATEGORY_BY_TYPE[draft.noteType] ?? original.category,
    body: plainBody,
    status,
    timestamp: nowSec,
    dateOfService: stamp,
    fileTime: status === "signed" ? stamp : "—",
  };
}
