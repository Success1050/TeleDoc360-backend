import express from "express";
import { getMedicationRecommendations, evaluatePatientRisk } from "../controllers/aiController.js";
import { auth } from "../middleware/authMiddleWare.js";

const router = express.Router();

// Decision support routes are authenticated
router.post("/recommendations", auth, getMedicationRecommendations);
router.post("/risk-score", auth, evaluatePatientRisk);

export default router;

