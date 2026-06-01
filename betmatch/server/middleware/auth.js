import jwt from "jsonwebtoken";

export const authRequired = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "betmatch-dev-secret");
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const optionalAuth = (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "betmatch-dev-secret");
  } catch {
    req.user = null;
  }
  return next();
};
