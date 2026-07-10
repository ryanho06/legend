import { authClient } from "./authClient";

/** "Always ignore this message" for the delete-note confirm. Device-level
 * preference, deliberately NOT cleared by signOut. */
export const SKIP_DELETE_CONFIRM_KEY = "legend-skip-delete-confirm";

/**
 * End the better-auth session, then sweep every `legend*` localStorage key
 * (sticky notes and other client-side scratch) and reload so the sign-in
 * gate shows again. Notes, feedback attempts, and addenda are server-side
 * now and are untouched by this — sweeps by prefix so new per-case keys
 * never need registering here; the one deliberate survivor is the
 * device-level delete-confirm preference.
 */
export async function signOut() {
  await authClient.signOut();
  const doomed = Object.keys(window.localStorage).filter(
    (key) => key.startsWith("legend") && key !== SKIP_DELETE_CONFIRM_KEY,
  );
  doomed.forEach((key) => window.localStorage.removeItem(key));
  window.location.reload();
}
