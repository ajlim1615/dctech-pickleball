export interface RequeueInput {
  /** Players who just finished a match, in match order. */
  matchPlayerIds: string[];
  /** Players still checked in to the session (anyone who checked out goes home). */
  checkedInIds: Iterable<string>;
  /** Players who already hold a waiting / called / playing entry in this session. */
  activeQueueIds: Iterable<string>;
  /** Most recent group_id per player, so doubles partners rejoin as a pair. */
  previousGroupIds?: Record<string, string | null | undefined>;
}

export interface RequeueEntry {
  player_id: string;
  group_id: string | null;
}

/**
 * Decides which players rejoin the back of the waiting line after a match.
 * Pure so it can be unit-tested without Supabase.
 */
export function selectPlayersToRequeue({
  matchPlayerIds,
  checkedInIds,
  activeQueueIds,
  previousGroupIds = {},
}: RequeueInput): RequeueEntry[] {
  const checkedIn = new Set(checkedInIds);
  const alreadyQueued = new Set(activeQueueIds);
  const seen = new Set<string>();

  const entries: RequeueEntry[] = [];
  for (const id of matchPlayerIds) {
    if (!id || seen.has(id) || !checkedIn.has(id) || alreadyQueued.has(id)) continue;
    seen.add(id);
    entries.push({ player_id: id, group_id: previousGroupIds[id] ?? null });
  }

  // A group only stays bonded if both partners are rejoining together.
  const groupCounts = new Map<string, number>();
  for (const e of entries) {
    if (e.group_id) groupCounts.set(e.group_id, (groupCounts.get(e.group_id) || 0) + 1);
  }
  return entries.map((e) =>
    e.group_id && groupCounts.get(e.group_id) !== 2 ? { ...e, group_id: null } : e
  );
}
