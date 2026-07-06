/** localStorage keys for the demo session (trainee identity + their work). */

export const USER_KEY = "legend-user";

export const userNotesKey = (caseId: string) => `legend-user-notes-${caseId}`;

/** "Always ignore this message" for the delete-note confirm. Device-level
 * preference, deliberately NOT cleared by signOut. */
export const SKIP_DELETE_CONFIRM_KEY = "legend-skip-delete-confirm";

/**
 * Clear the trainee's identity and their work on every case (notes, feedback
 * attempts, sticky notes), then reload so the sign-in gate shows again.
 * Everything lives in localStorage — nothing leaves the browser. Sweeps by
 * prefix so new per-case keys never need registering here; the one deliberate
 * survivor is the device-level delete-confirm preference.
 */
export function signOut() {
  const doomed = Object.keys(window.localStorage).filter(
    (key) => key.startsWith("legend") && key !== SKIP_DELETE_CONFIRM_KEY,
  );
  doomed.forEach((key) => window.localStorage.removeItem(key));
  window.location.reload();
}
