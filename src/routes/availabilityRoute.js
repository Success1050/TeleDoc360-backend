import express from "express";
import {
    createAvailabilitySlots,
    blockAvailabilitySlot,
    getMyAvailabilitySlots,
    getDoctorSlotsForDate,
    deleteAvailabilitySlot
} from "../controllers/availabilityController.js";
import { auth } from "../middleware/authMiddleWare.js";
import { roleCheck } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Public / Patient accessible
router.get("/doctor/:doctorId", getDoctorSlotsForDate);

// Protected Doctor routes
router.get("/my-slots", auth, roleCheck(["DOCTOR", "ADMIN"]), getMyAvailabilitySlots);
router.post("/slots", auth, roleCheck(["DOCTOR", "ADMIN"]), createAvailabilitySlots);
router.post("/block", auth, roleCheck(["DOCTOR", "ADMIN"]), blockAvailabilitySlot);
router.delete("/slots/:id", auth, roleCheck(["DOCTOR", "ADMIN"]), deleteAvailabilitySlot);

export default router;
