export const MIN_QUALIFIED_GAMES = 3;

export interface SessionRankedPlayer {
  id: string;
  full_name: string;
  display_name: string;
  avatar_url?: string | null;
  skill_rating: number;
  games_played: number;
  games_won: number;
  games_lost: number;
  win_rate: number;
  points_scored: number;
  points_conceded: number;
  point_diff: number;
  /** Opponents' average win rate (0-100, 1 decimal), excluding games against this player. */
  schedule_strength: number;
  /** True once the player has reached MIN_QUALIFIED_GAMES completed games. */
  qualified: boolean;
  /** Dense rank: players level on all tie-breakers share a number (1, 2, 2, 3). */
  rank: number;
  /** Shares their rank with at least one other player. */
  tied?: boolean;
}

export function computeSessionLeaderboard(
  matches: any[] = [],
  checkins: any[] = []
): SessionRankedPlayer[] {
  const playerMap = new Map<string, SessionRankedPlayer>();
  // Head-to-head record per player: opponentId -> { games against each other, wins by that opponent }
  const vsRecord = new Map<string, Map<string, { games: number; oppWins: number }>>();
  // Ordered list of opponent IDs faced per player (one entry per opponent per completed match)
  const opponentAppearances = new Map<string, string[]>();

  const makeBlankPlayer = (p: any): SessionRankedPlayer => ({
    id: p.id,
    full_name: p.full_name || p.display_name || "Employee",
    display_name: p.display_name || p.full_name || "Employee",
    avatar_url: p.avatar_url || null,
    skill_rating: Number(p.skill_rating || 2.0),
    games_played: 0,
    games_won: 0,
    games_lost: 0,
    win_rate: 0,
    points_scored: 0,
    points_conceded: 0,
    point_diff: 0,
    schedule_strength: 0,
    qualified: false,
    rank: 0,
  });

  const recordMatchup = (playerId: string, oppId: string, oppWon: boolean) => {
    let byOpp = vsRecord.get(playerId);
    if (!byOpp) {
      byOpp = new Map();
      vsRecord.set(playerId, byOpp);
    }
    const cur = byOpp.get(oppId) ?? { games: 0, oppWins: 0 };
    cur.games += 1;
    if (oppWon) cur.oppWins += 1;
    byOpp.set(oppId, cur);

    const list = opponentAppearances.get(playerId);
    if (list) list.push(oppId);
    else opponentAppearances.set(playerId, [oppId]);
  };

  // 1. Seed from check-ins so all attendees are tracked
  for (const c of checkins) {
    const p = c.player || c;
    if (!p || !p.id || p.email?.toLowerCase() === "admin@dctechmicro.com") continue;
    if (!playerMap.has(p.id)) {
      playerMap.set(p.id, makeBlankPlayer(p));
    }
  }

  // 2. Process all completed matches for this session
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const teamAScore = Number(m.team_a_score || 0);
    const teamBScore = Number(m.team_b_score || 0);
    const winningTeam =
      m.winning_team ||
      (teamAScore > teamBScore ? "team_a" : teamBScore > teamAScore ? "team_b" : "tie");

    const teamAPlayers: any[] = [];
    const teamBPlayers: any[] = [];

    if (Array.isArray(m.players)) {
      for (const mp of m.players) {
        const profile = mp.player || mp;
        if (!profile || !profile.id || profile.email?.toLowerCase() === "admin@dctechmicro.com")
          continue;
        if (mp.team === "team_a") teamAPlayers.push(profile);
        else if (mp.team === "team_b") teamBPlayers.push(profile);
      }
    }

    // Process Team A
    for (const p of teamAPlayers) {
      let rec = playerMap.get(p.id);
      if (!rec) {
        rec = makeBlankPlayer(p);
        playerMap.set(p.id, rec);
      }
      rec.games_played += 1;
      rec.points_scored += teamAScore;
      rec.points_conceded += teamBScore;
      if (winningTeam === "team_a") {
        rec.games_won += 1;
      } else if (winningTeam === "team_b") {
        rec.games_lost += 1;
      }
    }

    // Process Team B
    for (const p of teamBPlayers) {
      let rec = playerMap.get(p.id);
      if (!rec) {
        rec = makeBlankPlayer(p);
        playerMap.set(p.id, rec);
      }
      rec.games_played += 1;
      rec.points_scored += teamBScore;
      rec.points_conceded += teamAScore;
      if (winningTeam === "team_b") {
        rec.games_won += 1;
      } else if (winningTeam === "team_a") {
        rec.games_lost += 1;
      }
    }

    // Record opponent matchups for Schedule Strength
    for (const a of teamAPlayers) {
      for (const b of teamBPlayers) {
        recordMatchup(a.id, b.id, winningTeam === "team_b");
        recordMatchup(b.id, a.id, winningTeam === "team_a");
      }
    }
  }

  // 3. Finalize win rates, differentials, and schedule strength
  const rawWinRate = new Map<string, number>();
  const rawScheduleStrength = new Map<string, number>();

  for (const p of playerMap.values()) {
    rawWinRate.set(p.id, p.games_played > 0 ? p.games_won / p.games_played : 0);
  }

  const list = Array.from(playerMap.values()).map((p) => {
    const winRate = p.games_played > 0 ? Math.round((p.games_won / p.games_played) * 100) : 0;
    const pointDiff = p.points_scored - p.points_conceded;
    const opps = opponentAppearances.get(p.id) ?? [];
    const byOpp = vsRecord.get(p.id);
    let sosSum = 0;
    for (const oppId of opps) {
      const opp = playerMap.get(oppId);
      if (!opp) continue;
      const vs = byOpp?.get(oppId);
      const exclGames = opp.games_played - (vs?.games ?? 0);
      const exclWins = opp.games_won - (vs?.oppWins ?? 0);
      const oppRate =
        exclGames > 0
          ? exclWins / exclGames
          : opp.games_played > 0
          ? opp.games_won / opp.games_played
          : 0;
      sosSum += oppRate;
    }
    const rawSos = opps.length > 0 ? sosSum / opps.length : 0;
    rawScheduleStrength.set(p.id, rawSos);

    return {
      ...p,
      win_rate: winRate,
      point_diff: pointDiff,
      schedule_strength: Math.round(rawSos * 1000) / 10,
      qualified: p.games_played >= MIN_QUALIFIED_GAMES,
    };
  });

  // 4. Sort hierarchy (matching pickleq.app):
  // 0) Qualified (>= 3 completed games) before Provisional (< 3)
  // 1) Total Wins desc
  // 2) Win Rate desc (unrounded)
  // 3) Point Differential desc
  // 4) Schedule Strength desc (unrounded)
  // 5) Alphabetical, only to order players who are truly tied
  const EPS = 1e-9;
  const cmpFloatDesc = (a: number, b: number) => (Math.abs(b - a) < EPS ? 0 : b - a);
  const standing = (a: SessionRankedPlayer, b: SessionRankedPlayer) =>
    Number(b.qualified) - Number(a.qualified) ||
    b.games_won - a.games_won ||
    cmpFloatDesc(rawWinRate.get(a.id) ?? 0, rawWinRate.get(b.id) ?? 0) ||
    b.point_diff - a.point_diff ||
    cmpFloatDesc(rawScheduleStrength.get(a.id) ?? 0, rawScheduleStrength.get(b.id) ?? 0);

  list.sort((a, b) => standing(a, b) || a.full_name.localeCompare(b.full_name));

  // Dense ranking (1, 2, 2, 3...)
  let currentRank = 0;
  const ranked = list.map((p, idx) => {
    if (idx === 0 || standing(list[idx - 1], p) !== 0) {
      currentRank += 1;
    }
    const tied =
      (idx > 0 && standing(list[idx - 1], p) === 0) ||
      (idx < list.length - 1 && standing(list[idx + 1], p) === 0);
    return { ...p, rank: currentRank, tied };
  });

  return ranked;
}
