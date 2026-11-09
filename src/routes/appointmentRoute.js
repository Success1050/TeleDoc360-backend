import express from "express";
import {
    createAppointment,
    getMyAppointments,
    getAppointmentById,
    transitionAppointmentStatus,
    cancelAppointment,
    getDoctorSuggestedSlots
} from "../controllers/appointmentController.js";
import { auth } from "../middleware/authMiddleWare.js";

const router = express.Router();

// All appointment operations require authentication
router.post("/", auth, createAppointment);
router.get("/my", auth, getMyAppointments);
router.get("/suggested-slots/:doctorId", auth, getDoctorSuggestedSlots);
router.get("/:id", auth, getAppointmentById);
router.patch("/:id/transition", auth, transitionAppointmentStatus);
router.patch("/:id/cancel", auth, cancelAppointment);

export default router;

