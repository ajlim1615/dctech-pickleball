/**
 * Queue inserts that respect the database rule "one active entry per player per
 * session". A clash (Postgres 23505) means the player is already in line, which is
 * not an error: that row is skipped and the rest still go in.
 */

export type QueueEntryInsert = {
  session_id: string;
  player_id: string;
  status: "waiting";
  group_id?: string | null;
  joined_at?: string;
  target_court_id?: string | null;
};

type InsertError = { code?: string; message: string } | null;

/** The minimal client shape used here; the Supabase server and admin clients both fit. */
export type QueueInsertClient = {
  from(table: "queue_entries"): {
    insert(rows: QueueEntryInsert[]): PromiseLike<{ error: InsertError }>;
  };
};

const UNIQUE_VIOLATION = "23505";

export async function insertQueueEntries(
  client: QueueInsertClient,
  rows: QueueEntryInsert[]
): Promise<{ inserted: number; skipped: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const { error } = await client.from("queue_entries").insert(rows);
  if (!error) return { inserted: rows.length, skipped: 0 };
  if (error.code !== UNIQUE_VIOLATION) return { inserted: 0, skipped: 0, error: error.message };

  // Someone in the batch is already in line: insert one at a time, skipping them.
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const { error: rowError } = await client.from("queue_entries").insert([row]);
    if (!rowError) inserted++;
    else if (rowError.code === UNIQUE_VIOLATION) skipped++;
    else return { inserted, skipped, error: rowError.message };
  }
  return { inserted, skipped };
}

/** Join times 1 ms apart, so players added together keep the order they were listed in. */
export function staggeredJoinTimes(count: number, now: Date): string[] {
  return Array.from({ length: count }, (_, i) => new Date(now.getTime() + i).toISOString());
}
