import { pool, withTransaction } from "../config/db.js";
import { emitEvent } from "../socket/index.js";

export const listBets = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        b.id, b.creator_id, b.opponent_id, b.match_id, b.prediction, b.amount, b.status, b.created_at,
        u.name AS creator_name,
        o.name AS opponent_name,
        m.team_home, m.team_away, m.league, m.match_date, m.status AS match_status, m.score
       FROM bets b
       JOIN users u ON u.id = b.creator_id
       LEFT JOIN users o ON o.id = b.opponent_id
       JOIN matches m ON m.id = b.match_id
       WHERE b.status = 'open'
       ORDER BY b.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

export const createBet = async (req, res, next) => {
  try {
    const { creator_id, match_id, prediction, amount } = req.body || {};
    if (!creator_id || !match_id || !prediction || !amount) {
      return res.status(400).json({ error: "creator_id, match_id, prediction and amount are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO bets (creator_id, match_id, prediction, amount, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [creator_id, match_id, prediction, amount]
    );

    const [rows] = await pool.query("SELECT * FROM bets WHERE id = ?", [result.insertId]);
    emitEvent("new_bet", rows[0]);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

export const acceptBet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { opponent_id } = req.body || {};
    if (!opponent_id) return res.status(400).json({ error: "opponent_id is required" });

    const payload = await withTransaction(async (connection) => {
      const [[bet]] = await connection.query("SELECT * FROM bets WHERE id = ? FOR UPDATE", [id]);
      if (!bet) throw new Error("Bet not found");
      if (bet.status !== "open") throw new Error("Bet is not open");

      const [[creator]] = await connection.query("SELECT id, balance FROM users WHERE id = ? FOR UPDATE", [bet.creator_id]);
      const [[opponent]] = await connection.query("SELECT id, balance FROM users WHERE id = ? FOR UPDATE", [opponent_id]);
      if (!creator || !opponent) throw new Error("User not found");
      if (Number(creator.balance || 0) < Number(bet.amount)) throw new Error("Creator has insufficient balance");
      if (Number(opponent.balance || 0) < Number(bet.amount)) throw new Error("Opponent has insufficient balance");

      await connection.query("UPDATE bets SET opponent_id = ?, status = 'matched' WHERE id = ?", [opponent_id, id]);
      await connection.query(
        "INSERT INTO transactions (user_id, bet_id, type, amount) VALUES (?, ?, 'withdraw', ?)",
        [bet.creator_id, id, Number(bet.amount)]
      );
      await connection.query(
        "INSERT INTO transactions (user_id, bet_id, type, amount) VALUES (?, ?, 'withdraw', ?)",
        [opponent_id, id, Number(bet.amount)]
      );
      await connection.query("UPDATE users SET balance = balance - ? WHERE id = ?", [Number(bet.amount), bet.creator_id]);
      await connection.query("UPDATE users SET balance = balance - ? WHERE id = ?", [Number(bet.amount), opponent_id]);

      const [matched] = await connection.query(
        `SELECT
          b.id, b.creator_id, b.opponent_id, b.match_id, b.prediction, b.amount, b.status, b.created_at,
          u.name AS creator_name,
          o.name AS opponent_name,
          m.team_home, m.team_away, m.league, m.match_date, m.status AS match_status, m.score
         FROM bets b
         JOIN users u ON u.id = b.creator_id
         LEFT JOIN users o ON o.id = b.opponent_id
         JOIN matches m ON m.id = b.match_id
         WHERE b.id = ?`,
        [id]
      );

      return {
        bet: matched[0],
      };
    });

    emitEvent("bet_matched", payload.bet);
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

export const getBetDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT
        b.id, b.creator_id, b.opponent_id, b.match_id, b.prediction, b.amount, b.status, b.created_at,
        u.name AS creator_name,
        o.name AS opponent_name,
        m.team_home, m.team_away, m.league, m.match_date, m.status AS match_status, m.score
       FROM bets b
       JOIN users u ON u.id = b.creator_id
       LEFT JOIN users o ON o.id = b.opponent_id
       JOIN matches m ON m.id = b.match_id
       WHERE b.id = ?`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Bet not found" });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};
