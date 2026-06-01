import { Router } from "express";
import { acceptBet, createBet, getBetDetail, listBets } from "../controllers/betsController.js";

const router = Router();

router.get("/", listBets);
router.post("/", createBet);
router.get("/:id", getBetDetail);
router.put("/:id/accept", acceptBet);

export default router;
