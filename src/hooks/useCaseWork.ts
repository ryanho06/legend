import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  apiAddAddendum,
  apiCreateNote,
  apiDeleteAttempt,
  apiDeleteNote,
  apiPutAttempt,
  apiPutSession,
  apiRefileNote,
  fetchCaseSession,
  fetchCaseWork,
  type AddendumRow,
  type StoredAttempt,
} from "../lib/api";
import { foldAddenda, formatStamp } from "../lib/userNotes";
import type { ClinicalNote } from "../types";

export type CaseWorkState = {
  loaded: boolean;
  loadError: string | null;
  notes: ClinicalNote[];
  addenda: Record<string, string>;
  attempt: StoredAttempt | null;
  simNow: number;
  createNote(note: ClinicalNote): Promise<ClinicalNote>;
  refileNote(note: ClinicalNote): Promise<void>;
  deleteNote(id: string): Promise<void>;
  addAddendum(noteId: string, block: string): Promise<void>;
  saveAttempt(text: string, signed: boolean): Promise<void>;
  clearAttempt(): Promise<void>;
  advanceSim(target: number): Promise<void>;
};

/**
 * The trainee's server-side work for one case. Fetch-on-mount is sound
 * because PatientWorkspace remounts per case (key={caseId}); the chart
 * renders static documents immediately and the user's notes merge in when
 * this resolves.
 */
export function useCaseWork(caseId: string): CaseWorkState {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [addendaRows, setAddendaRows] = useState<AddendumRow[]>([]);
  const [attempt, setAttempt] = useState<StoredAttempt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [simNow, setSimNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCaseWork(caseId), fetchCaseSession(caseId)]).then(
      ([work, session]) => {
        if (cancelled) return;
        setNotes(work.notes);
        setAddendaRows(work.addenda);
        setAttempt(work.attempt);
        setSimNow(session.simNow);
        setLoaded(true);
      },
      (err: unknown) => {
        if (cancelled) return;
        // A 401 at mount means the session died: reload so the sign-in gate
        // shows (nothing is in flight at mount, so nothing can be lost).
        // Mutation-time 401s deliberately do NOT reload; their catch paths
        // keep the draft and show an error instead.
        if (err instanceof ApiError && err.status === 401) window.location.reload();
        else setLoadError("Couldn't load your notes from the server.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const addenda = useMemo(() => foldAddenda(addendaRows), [addendaRows]);

  return {
    loaded,
    loadError,
    notes,
    addenda,
    attempt,
    simNow,
    async createNote(note) {
      const stored = await apiCreateNote(caseId, note);
      setNotes((prev) => [...prev, stored]);
      return stored;
    },
    async refileNote(note) {
      const stored = await apiRefileNote(note);
      setNotes((prev) => prev.map((n) => (n.id === stored.id ? stored : n)));
    },
    async deleteNote(id) {
      await apiDeleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    async addAddendum(noteId, block) {
      const row = await apiAddAddendum(caseId, noteId, block);
      setAddendaRows((prev) => [...prev, row]);
    },
    async saveAttempt(text, signed) {
      const next = { text, at: formatStamp(new Date()), signed };
      await apiPutAttempt(caseId, next);
      setAttempt(next);
    },
    async clearAttempt() {
      await apiDeleteAttempt(caseId);
      setAttempt(null);
    },
    async advanceSim(target) {
      const next = Math.max(simNow, Math.floor(target));
      if (next === simNow) return;
      const res = await apiPutSession(caseId, next);
      setSimNow(res.simNow);
    },
  };
}
