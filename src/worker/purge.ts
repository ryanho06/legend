/**
 * Delete anonymous users whose every session expired before the cutoff
 * (no activity in ~30 days; guest sessions live 7 days, so an active guest
 * always has a fresher session). FK cascades remove their notes, addenda,
 * and attempts. Google-linked users are never anonymous: the anonymous
 * plugin deletes the anon row at link time (after Task 6's re-key).
 */
export async function purgeStaleAnonUsers(db: D1Database, cutoffIso: string): Promise<number> {
  const res = await db
    .prepare(
      `DELETE FROM user WHERE isAnonymous = 1 AND NOT EXISTS (
         SELECT 1 FROM session WHERE session.userId = user.id AND session.expiresAt > ?1
       )`,
    )
    .bind(cutoffIso)
    .run();
  return res.meta.changes;
}
