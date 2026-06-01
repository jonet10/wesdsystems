import { Router } from "express";
import { getUserHistory } from "../controllers/usersController.js";

const router = Router();

router.get("/:id/history", getUserHistory);

export default router;
