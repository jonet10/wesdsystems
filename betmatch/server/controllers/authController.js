import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET || "betmatch-dev-secret", {
    expiresIn: "7d",
  });

export const register = async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (existing.length) return res.status(409).json({ error: "Email already in use" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)",
      [name, email.toLowerCase(), hash, avatar || null]
    );

    const user = { id: result.insertId, name, email: email.toLowerCase(), avatar: avatar || null, balance: 0 };
    return res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const [rows] = await pool.query("SELECT id, name, email, password, balance, avatar FROM users WHERE email = ? LIMIT 1", [
      email.toLowerCase(),
    ]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    await pool.query("UPDATE users SET created_at = created_at WHERE id = ?", [user.id]);
    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: Number(user.balance || 0),
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};
