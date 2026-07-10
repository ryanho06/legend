import { currentPersona, ensureSnapshot } from "./persona";

/**
 * Move a guest's work to the account they just linked. Runs inside
 * onLinkAccount, BEFORE the anonymous plugin deletes the anonymous user
 * (whose deletion would cascade the rows away). UPDATE OR REPLACE on
 * wrapup_attempt: if the target account already has an attempt for the same
 * case, the guest's (their live session's) attempt wins. Alias history moves
 * too, and the outgoing guest persona itself is snapshotted under the new
 * account so it survives as a switchable "previous alias".
 */
export async function rekeyUserWork(
  db: D1Database,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  // Read the guest persona while its user row still exists.
  const outgoing = await currentPersona(db, fromUserId);
  await db.batch([
    db.prepare(`UPDATE user_note SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
    db.prepare(`UPDATE note_addendum SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
    db
      .prepare(`UPDATE OR REPLACE wrapup_attempt SET userId = ?2 WHERE userId = ?1`)
      .bind(fromUserId, toUserId),
    db
      .prepare(`UPDATE OR REPLACE case_session SET scope = ?2 WHERE scope = ?1`)
      .bind(fromUserId, toUserId),
    db.prepare(`UPDATE user_alias SET userId = ?2 WHERE userId = ?1`).bind(fromUserId, toUserId),
  ]);
  // After the move, so the dedupe check sees the transferred rows.
  await ensureSnapshot(db, toUserId, outgoing);
}
