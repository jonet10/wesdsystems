export const mapBetRow = (row) => ({
  id: row.id,
  creator_id: row.creator_id,
  opponent_id: row.opponent_id,
  match_id: row.match_id,
  prediction: row.prediction,
  amount: Number(row.amount || 0),
  status: row.status,
  created_at: row.created_at,
  creator_name: row.creator_name || null,
  opponent_name: row.opponent_name || null,
  match: row.match_id
    ? {
        id: row.match_id,
        team_home: row.team_home,
        team_away: row.team_away,
        league: row.league,
        match_date: row.match_date,
        status: row.match_status,
        score: row.score,
      }
    : null,
});
