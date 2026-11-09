import express from "express";
import {
    getPatientProfile,
    updatePatientProfile,
    getDoctorProfile,
    updateDoctorProfile,
    submitDoctorOnboarding,
    toggleDoctorAvailability,
    getAllDoctors,
    getDoctorById,
    deactivateAccount,
    getAllPatients
} from "../controllers/userController.js";
import { auth } from "../middleware/authMiddleWare.js";
import { roleCheck } from "../middleware/roleMiddleware.js";
import upload from "../middleware/uploadMiddlewae.js";

const router = express.Router();

// ============================================
// PATIENTS DIRECTORY (DOCTOR / ADMIN ONLY)
// ============================================
router.get("/patients", auth, roleCheck(["DOCTOR", "ADMIN"]), getAllPatients);

// ============================================
// PUBLIC DOCTOR DIRECTORY
// ============================================
router.get("/doctors", getAllDoctors);
router.get("/doctors/:id", getDoctorById);


// ============================================
// PROTECTED PATIENT PROFILE ROUTES
// ============================================
router.get("/profile/patient", auth, roleCheck(["PATIENT", "ADMIN"]), getPatientProfile);
router.put(
    "/profile/patient", 
    auth, 
    roleCheck(["PATIENT", "ADMIN"]), 
    upload.single("profilePicture"), 
    updatePatientProfile
);

// ============================================
// PROTECTED DOCTOR PROFILE & ONBOARDING ROUTES
// ============================================
router.get("/profile/doctor", auth, roleCheck(["DOCTOR", "ADMIN"]), getDoctorProfile);
router.post("/profile/doctor/onboarding", auth, roleCheck(["DOCTOR", "ADMIN"]), submitDoctorOnboarding);
router.put(
    "/profile/doctor", 
    auth, 
    roleCheck(["DOCTOR", "ADMIN"]), 
    upload.single("profilePicture"), 
    updateDoctorProfile
);
router.patch("/doctor/availability", auth, roleCheck(["DOCTOR", "ADMIN"]), toggleDoctorAvailability);

// ============================================
// ACCOUNT DEACTIVATION
// ============================================
router.patch("/deactivate", auth, deactivateAccount);

export default router;
