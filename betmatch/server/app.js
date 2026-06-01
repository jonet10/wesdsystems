import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import matchesRoutes from "./routes/matchesRoutes.js";
import betsRoutes from "./routes/betsRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import { errorHandler, notFound } from "./middleware/error.js";

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "betmatch" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/matches", matchesRoutes);
  app.use("/api/bets", betsRoutes);
  app.use("/api/users", usersRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
