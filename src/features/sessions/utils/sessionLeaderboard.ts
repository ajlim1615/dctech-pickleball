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
  rank: number;
}

export function computeSessionLeaderboard(
  matches: any[] = [],
  checkins: any[] = []
): SessionRankedPlayer[] {
  const playerMap = new Map<string, SessionRankedPlayer>();

  // 1. Seed from check-ins so all attendees are tracked
  for (const c of checkins) {
    const p = c.player || c;
    if (!p || !p.id || p.email?.toLowerCase() === "admin@dctechmicro.com") continue;
    if (!playerMap.has(p.id)) {
      playerMap.set(p.id, {
        id: p.id,
        full_name: p.full_name || p.display_name || "Employee",
        display_name: p.display_name || p.full_name || "Employee",
        avatar_url: p.avatar_url || null,
        skill_rating: Number(p.skill_rating || 3.0),
        games_played: 0,
        games_won: 0,
        games_lost: 0,
        win_rate: 0,
        points_scored: 0,
        points_conceded: 0,
        point_diff: 0,
        rank: 0,
      });
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
        rec = {
          id: p.id,
          full_name: p.full_name || p.display_name || "Employee",
          display_name: p.display_name || p.full_name || "Employee",
          avatar_url: p.avatar_url || null,
          skill_rating: Number(p.skill_rating || 3.0),
          games_played: 0,
          games_won: 0,
          games_lost: 0,
          win_rate: 0,
          points_scored: 0,
          points_conceded: 0,
          point_diff: 0,
          rank: 0,
        };
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
        rec = {
          id: p.id,
          full_name: p.full_name || p.display_name || "Employee",
          display_name: p.display_name || p.full_name || "Employee",
          avatar_url: p.avatar_url || null,
          skill_rating: Number(p.skill_rating || 3.0),
          games_played: 0,
          games_won: 0,
          games_lost: 0,
          win_rate: 0,
          points_scored: 0,
          points_conceded: 0,
          point_diff: 0,
          rank: 0,
        };
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
  }

  // 3. Finalize win rates and differentials
  const list = Array.from(playerMap.values()).map((p) => {
    const winRate = p.games_played > 0 ? Math.round((p.games_won / p.games_played) * 100) : 0;
    const pointDiff = p.points_scored - p.points_conceded;
    return {
      ...p,
      win_rate: winRate,
      point_diff: pointDiff,
    };
  });

  // 4. Sort hierarchy:
  // 1) Games Won desc
  // 2) Games Played desc
  // 3) Win Rate desc
  // 4) Point Differential desc
  // 5) DUPR skill rating desc
  // 6) Alphabetical
  list.sort((a, b) => {
    if (b.games_won !== a.games_won) return b.games_won - a.games_won;
    if (b.games_played !== a.games_played) return b.games_played - a.games_played;
    if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
    if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
    if (b.skill_rating !== a.skill_rating) return b.skill_rating - a.skill_rating;
    return a.full_name.localeCompare(b.full_name);
  });

  return list.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));
}
