import express from "express";
import {
    createMedicalRecord,
    getPatientMedicalRecords,
    getMedicalRecordById,
    addAllergy,
    getPatientAllergies,
    deleteAllergy,
    createPrescription,
    getPatientPrescriptions
} from "../controllers/medicalRecordController.js";
import { auth } from "../middleware/authMiddleWare.js";
import { roleCheck } from "../middleware/roleMiddleware.js";

const router = express.Router();

// ============================================
// CONSULTATION & MEDICAL RECORDS
// ============================================
router.post("/records", auth, roleCheck(["DOCTOR", "ADMIN"]), createMedicalRecord);
router.get("/records/patient/:patientId", auth, getPatientMedicalRecords);
router.get("/records/:id", auth, getMedicalRecordById);

// ============================================
// ALLERGIES
// ============================================
router.post("/allergies", auth, addAllergy);
router.get("/allergies/patient/:patientId", auth, getPatientAllergies);
router.delete("/allergies/:id", auth, deleteAllergy);

// ============================================
// PRESCRIPTIONS
// ============================================
router.post("/prescriptions", auth, roleCheck(["DOCTOR", "ADMIN"]), createPrescription);
router.get("/prescriptions/patient/:patientId", auth, getPatientPrescriptions);

export default router;
