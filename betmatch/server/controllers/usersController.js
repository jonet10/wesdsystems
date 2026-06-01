import { pool } from "../config/db.js";

export const getUserHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT
        b.id AS bet_id,
        b.amount,
        b.prediction,
        b.status,
        b.created_at,
        m.team_home,
        m.team_away,
        m.league,
        m.match_date,
        t.type AS transaction_type,
        t.amount AS transaction_amount
       FROM bets b
       JOIN matches m ON m.id = b.match_id
       LEFT JOIN transactions t ON t.bet_id = b.id
       WHERE b.creator_id = ? OR b.opponent_id = ?
       ORDER BY b.created_at DESC`,
      [id, id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};
