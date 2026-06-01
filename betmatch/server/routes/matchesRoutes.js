import { Router } from "express";
import { listMatches, updateMatchResult } from "../controllers/matchesController.js";

const router = Router();
router.get("/", listMatches);
router.put("/:id/result", updateMatchResult);

export default router;
