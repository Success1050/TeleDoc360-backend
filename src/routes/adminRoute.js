import express from "express";
import { getAdminStats, setDoctorApprovalStatus, getAuditLogs } from "../controllers/adminController.js";
import { auth } from "../middleware/authMiddleWare.js";
import { roleCheck } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/stats", auth, roleCheck(["ADMIN"]), getAdminStats);
router.patch("/doctors/:id/approval", auth, roleCheck(["ADMIN"]), setDoctorApprovalStatus);
router.get("/audit-logs", auth, roleCheck(["ADMIN"]), getAuditLogs);

export default router;

