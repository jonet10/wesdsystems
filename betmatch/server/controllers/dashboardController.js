import { pool } from "../config/db.js";

export const getDashboardStats = async (_req, res, next) => {
  try {
    const [betsResult, revenueResult, activeResult, volumeResult, topMatchesResult, activeBetsResult, openCountResult, pendingCountResult, closedCountResult] = await Promise.all([
      pool.query(
        `SELECT
          COALESCE(SUM(amount), 0) AS total_bets_amount,
          COALESCE(SUM(CASE WHEN status = 'matched' THEN amount * 0.05 ELSE 0 END), 0) AS commission_earned
         FROM bets`
      ),
      pool.query(`SELECT COALESCE(SUM(commission_amount), 0) AS commission_earned FROM platform_revenue`),
      pool.query(`SELECT COUNT(*) AS active_bets FROM bets WHERE status IN ('open', 'matched')`),
      pool.query(
        `SELECT DATE(created_at) AS day, COALESCE(SUM(amount), 0) AS volume
         FROM bets
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(created_at)
         ORDER BY day ASC`
      ),
      pool.query(
        `SELECT
          m.id,
          m.team_home,
          m.team_away,
          m.league,
          COALESCE(SUM(CASE WHEN b.prediction = m.team_home THEN 1 ELSE 0 END), 0) AS home_count,
          COALESCE(SUM(CASE WHEN b.prediction = m.team_away THEN 1 ELSE 0 END), 0) AS away_count,
          COUNT(b.id) AS bets_count
         FROM matches m
         LEFT JOIN bets b ON b.match_id = m.id AND b.status IN ('open','matched')
         WHERE m.status IN ('upcoming','live')
         GROUP BY m.id
         ORDER BY m.match_date ASC
         LIMIT 5`
      ),
      pool.query(
        `SELECT
          b.id,
          b.amount,
          b.status,
          b.created_at,
          u.name AS user_name,
          u.avatar AS user_avatar,
          CONCAT(m.team_home, ' vs ', m.team_away) AS match_name
         FROM bets b
         JOIN users u ON u.id = b.creator_id
         JOIN matches m ON m.id = b.match_id
         WHERE b.status IN ('open','matched')
         ORDER BY b.created_at DESC
         LIMIT 6`
      ),
      pool.query(`SELECT COUNT(*) AS count FROM bets WHERE status = 'open'`),
      pool.query(`SELECT COUNT(*) AS count FROM bets WHERE status = 'matched'`),
      pool.query(`SELECT COUNT(*) AS count FROM bets WHERE status IN ('won','lost')`),
    ]);

    const betsRow = betsResult[0]?.[0] || {};
    const revenueRow = revenueResult[0]?.[0] || {};
    const activeRow = activeResult[0]?.[0] || {};
    const volumeRows = volumeResult[0] || [];
    const topMatchesRows = topMatchesResult[0] || [];
    const activeBetsRows = activeBetsResult[0] || [];
    const totalBetsAmount = Number(betsRow.total_bets_amount || 0);
    const commissionEarned = Number(revenueRow.commission_earned || 0);
    const activeBets = Number(activeRow.active_bets || 0);

    return res.json({
      totalBetsAmount,
      commissionEarned,
      activeBets,
      statsRow: {
        open: Number(openCountResult[0]?.[0]?.count || 0),
        pending: Number(pendingCountResult[0]?.[0]?.count || 0),
        closed: Number(closedCountResult[0]?.[0]?.count || 0),
      },
      volume7d: volumeRows.map((row) => ({ day: row.day, volume: Number(row.volume || 0) })),
      topMatches: topMatchesRows.map((row) => {
        const total = Number(row.home_count || 0) + Number(row.away_count || 0);
        const homeShare = total ? Math.round((Number(row.home_count || 0) / total) * 100) : 50;
        const awayShare = 100 - homeShare;
        return {
          id: row.id,
          label: `${row.team_home} vs ${row.team_away}`,
          league: row.league,
          homeTeam: row.team_home,
          awayTeam: row.team_away,
          homeShare,
          awayShare,
          betsCount: Number(row.bets_count || 0),
        };
      }),
      activeBetsList: activeBetsRows.map((row) => ({
        id: row.id,
        userName: row.user_name,
        userAvatar: row.user_avatar,
        match: row.match_name,
        amount: Number(row.amount || 0),
        status: row.status,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
};
