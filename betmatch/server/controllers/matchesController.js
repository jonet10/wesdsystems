import { pool } from "../config/db.js";
import { emitEvent } from "../socket/index.js";

const COMMISSION_RATE = 0.05;

const parseScore = (score) => {
  if (!score || typeof score !== "string") return null;
  const cleaned = score.trim().replace(/\s+/g, "");
  const separator = cleaned.includes("-") ? "-" : cleaned.includes(":") ? ":" : null;
  if (!separator) return null;
  const [home, away] = cleaned.split(separator).map((value) => Number(value));
  if (Number.isNaN(home) || Number.isNaN(away)) return null;
  return { home, away };
};

export const listMatches = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, team_home, team_away, league, match_date, status, score
       FROM matches
       WHERE status IN ('upcoming','live')
       ORDER BY match_date ASC`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

export const updateMatchResult = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { score, status = "finished" } = req.body || {};
    await pool.query("UPDATE matches SET score = ?, status = ? WHERE id = ?", [score || null, status, id]);

    const parsedScore = parseScore(score);
    if (parsedScore && parsedScore.home !== parsedScore.away) {
      const winnerTeam = parsedScore.home > parsedScore.away ? "home" : "away";
      const [bets] = await pool.query(
        `SELECT b.id, b.creator_id, b.opponent_id, b.amount, b.prediction, m.team_home, m.team_away
         FROM bets b
         JOIN matches m ON m.id = b.match_id
         WHERE b.match_id = ? AND b.status = 'matched'`,
        [id]
      );

      for (const bet of bets) {
        const creatorWon =
          winnerTeam === "home"
            ? bet.prediction === bet.team_home || bet.prediction === "home"
            : bet.prediction === bet.team_away || bet.prediction === "away";
        const totalPot = Number(bet.amount || 0) * 2;
        const commissionAmount = totalPot * COMMISSION_RATE;
        const payout = totalPot - commissionAmount;
        const winnerId = creatorWon ? bet.creator_id : bet.opponent_id;
        const loserId = creatorWon ? bet.opponent_id : bet.creator_id;

        await pool.query("UPDATE bets SET status = ? WHERE id = ?", [creatorWon ? "won" : "lost", bet.id]);
        await pool.query("UPDATE users SET balance = balance + ? WHERE id = ?", [payout, winnerId]);
        await pool.query("INSERT INTO platform_revenue (bet_id, commission_amount) VALUES (?, ?)", [bet.id, commissionAmount]);
        await pool.query("INSERT INTO transactions (user_id, bet_id, type, amount) VALUES (?, ?, 'win', ?)", [
          winnerId,
          bet.id,
          payout,
        ]);
        await pool.query("INSERT INTO transactions (user_id, bet_id, type, amount) VALUES (?, ?, 'commission', ?)", [
          loserId,
          bet.id,
          commissionAmount,
        ]);
      }
    }

    const [rows] = await pool.query("SELECT id, team_home, team_away, league, match_date, status, score FROM matches WHERE id = ?", [id]);
    emitEvent("match_result", rows[0]);
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};
