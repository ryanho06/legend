import { attemptKey } from "./wrapupAttempt";

/** localStorage keys for the demo session (trainee identity + their work). */

export const USER_KEY = "legend-user";

export const userNotesKey = (caseId: string) => `legend-user-notes-${caseId}`;

/**
 * Clear the trainee's identity, notes and last feedback attempt, then reload
 * so the sign-in gate shows again. Everything lives in localStorage (not
 * cookies — nothing leaves the browser).
 */
export function signOut(caseId: string) {
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(userNotesKey(caseId));
  window.localStorage.removeItem(attemptKey(caseId));
  window.location.reload();
}
