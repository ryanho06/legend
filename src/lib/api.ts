import type { ClinicalNote } from "../types";

/** Thin fetch wrapper for the /api work endpoints. Pure DOM fetch; no React. */

export type StoredAttempt = { text: string; at: string; signed: boolean };
export type AddendumRow = { noteId: string; body: string; createdAt: number };
export type CaseWork = {
  notes: ClinicalNote[];
  addenda: AddendumRow[];
  attempt: StoredAttempt | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} -> ${res.status}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const fetchCaseWork = (caseId: string) => request<CaseWork>(`/cases/${caseId}/work`);

export const apiCreateNote = (caseId: string, note: ClinicalNote) =>
  request<ClinicalNote>(`/cases/${caseId}/notes`, {
    method: "POST",
    body: JSON.stringify({ status: note.status, payload: note }),
  });

export const apiRefileNote = (note: ClinicalNote) =>
  request<ClinicalNote>(`/notes/${note.id}`, {
    method: "PUT",
    body: JSON.stringify({ status: note.status, payload: note }),
  });

export const apiDeleteNote = (id: string) =>
  request<void>(`/notes/${id}`, { method: "DELETE" });

export const apiAddAddendum = (caseId: string, noteId: string, body: string) =>
  request<AddendumRow>(`/notes/${noteId}/addenda`, {
    method: "POST",
    body: JSON.stringify({ caseId, body }),
  });

export const apiPutAttempt = (caseId: string, attempt: StoredAttempt) =>
  request<void>(`/cases/${caseId}/attempt`, {
    method: "PUT",
    body: JSON.stringify(attempt),
  });

export const apiDeleteAttempt = (caseId: string) =>
  request<void>(`/cases/${caseId}/attempt`, { method: "DELETE" });

/** A persona (forename/surname/grade/hcpId) the trainee has held. */
export type Alias = {
  id: string;
  forename: string | null;
  surname: string | null;
  grade: string | null;
  hcpId: string;
  createdAt: number;
};

export type Persona = Pick<Alias, "forename" | "surname" | "grade" | "hcpId">;

export const fetchAliases = () => request<{ aliases: Alias[] }>(`/profile/aliases`);

export const switchAlias = (aliasId: string) =>
  request<Persona>(`/profile/aliases/switch`, {
    method: "POST",
    body: JSON.stringify({ aliasId }),
  });
