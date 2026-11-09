import { prisma } from "../config/db.js";

// ============================================
// MEDICAL RECORDS & CONSULTATION NOTES
// ============================================

// 1. Create Consultation / Medical Record (Doctor Only)
export const createMedicalRecord = async (req, res) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!doctor) {
            return res.status(403).json({ message: "Only doctors can record medical consultations" });
        }

        const {
            patientId,
            appointmentId,
            diagnosis,
            symptoms,
            vitalSigns,
            labResults,
            notes,
            followUpRequired,
            followUpDate
        } = req.body;

        if (!patientId || !diagnosis) {
            return res.status(400).json({ message: "patientId and diagnosis are required" });
        }

        // Verify patient exists by UUID or by Email
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId.trim());
        let patient = null;

        if (isUuid) {
            patient = await prisma.patient.findUnique({ where: { id: patientId.trim() } });
        }

        if (!patient) {
            patient = await prisma.patient.findFirst({
                where: {
                    user: { email: { equals: patientId.trim(), mode: "insensitive" } }
                }
            });
        }

        if (!patient) {
            return res.status(404).json({ message: `Patient '${patientId}' not found. Please provide a valid patient UUID or registered patient email address.` });
        }

        const record = await prisma.medicalRecord.create({
            data: {
                doctorId: doctor.id,
                patientId: patient.id,
                appointmentId: appointmentId || null,
                diagnosis,
                symptoms: Array.isArray(symptoms) ? symptoms : (symptoms ? [symptoms] : []),
                vitalSigns: vitalSigns ? vitalSigns : undefined,
                labResults: labResults || null,
                notes: notes || null,
                followUpRequired: Boolean(followUpRequired),
                followUpDate: followUpDate ? new Date(followUpDate) : null
            },
            include: {
                doctor: {
                    select: {
                        firstName: true,
                        lastName: true,
                        specialization: true
                    }
                },
                patient: {
                    select: {
                        firstName: true,
                        lastName: true,
                        dateOfBirth: true,
                        bloodGroup: true
                    }
                }
            }
        });

        res.status(201).json({
            message: "Medical record created successfully",
            record
        });
    } catch (error) {
        console.error("Create Medical Record Error:", error);
        res.status(500).json({ message: "Failed to create medical record", error: error.message });
    }
};

// 2. Get Medical Records by Patient ID (Patient can view own, Doctor/Admin can view patient's)
export const getPatientMedicalRecords = async (req, res) => {
    try {
        const { patientId } = req.params;

        // Security ownership check
        if (req.user.role === "PATIENT") {
            const currentPatient = await prisma.patient.findUnique({
                where: { userId: req.user.id }
            });
            if (!currentPatient || currentPatient.id !== patientId) {
                return res.status(403).json({ message: "Unauthorized access to patient records" });
            }
        }

        const records = await prisma.medicalRecord.findMany({
            where: { patientId },
            include: {
                doctor: {
                    select: {
                        firstName: true,
                        lastName: true,
                        specialization: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        res.json({ records });
    } catch (error) {
        console.error("Get Patient Records Error:", error);
        res.status(500).json({ message: "Failed to retrieve medical records", error: error.message });
    }
};

// 3. Get Single Medical Record Details
export const getMedicalRecordById = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await prisma.medicalRecord.findUnique({
            where: { id },
            include: {
                doctor: true,
                patient: true,
                appointment: true
            }
        });

        if (!record) {
            return res.status(404).json({ message: "Medical record not found" });
        }

        res.json({ record });
    } catch (error) {
        console.error("Get Record Detail Error:", error);
        res.status(500).json({ message: "Failed to retrieve record detail", error: error.message });
    }
};

// ============================================
// ALLERGIES MANAGEMENT
// ============================================

// 4. Add Allergy (Doctor or Patient)
export const addAllergy = async (req, res) => {
    try {
        const { patientId, allergen, severity = "MILD", reaction, notes, diagnosedDate } = req.body;

        if (!allergen) {
            return res.status(400).json({ message: "Allergen is required" });
        }

        let targetPatientId = patientId;

        // If patient adding for self
        if (req.user.role === "PATIENT") {
            const currentPatient = await prisma.patient.findUnique({ where: { userId: req.user.id } });
            if (!currentPatient) return res.status(404).json({ message: "Patient profile not found" });
            targetPatientId = currentPatient.id;
        }

        if (!targetPatientId) {
            return res.status(400).json({ message: "patientId is required" });
        }

        const allergy = await prisma.allergy.create({
            data: {
                patientId: targetPatientId,
                allergen,
                severity,
                reaction: reaction || null,
                notes: notes || null,
                diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : new Date()
            }
        });

        res.status(201).json({ message: "Allergy added successfully", allergy });
    } catch (error) {
        console.error("Add Allergy Error:", error);
        res.status(500).json({ message: "Failed to record allergy", error: error.message });
    }
};

// 5. Get Patient Allergies
export const getPatientAllergies = async (req, res) => {
    try {
        const { patientId } = req.params;

        const allergies = await prisma.allergy.findMany({
            where: { patientId },
            orderBy: { createdAt: "desc" }
        });

        res.json({ allergies });
    } catch (error) {
        console.error("Get Allergies Error:", error);
        res.status(500).json({ message: "Failed to fetch allergies", error: error.message });
    }
};

// 6. Delete Allergy
export const deleteAllergy = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.allergy.delete({ where: { id } });

        res.json({ message: "Allergy removed successfully" });
    } catch (error) {
        console.error("Delete Allergy Error:", error);
        res.status(500).json({ message: "Failed to delete allergy", error: error.message });
    }
};

// ============================================
// PRESCRIPTIONS MANAGEMENT
// ============================================

// 7. Create Prescription (Doctor Only)
export const createPrescription = async (req, res) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!doctor) {
            return res.status(403).json({ message: "Only doctors can issue prescriptions" });
        }

        const { patientId, appointmentId, medications, diagnosis, notes, validUntil } = req.body;

        if (!patientId || !medications || !diagnosis) {
            return res.status(400).json({ message: "patientId, diagnosis, and medications list are required" });
        }

        // Verify patient exists by UUID or by Email
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId.trim());
        let patient = null;

        if (isUuid) {
            patient = await prisma.patient.findUnique({ where: { id: patientId.trim() } });
        }

        if (!patient) {
            patient = await prisma.patient.findFirst({
                where: {
                    user: { email: { equals: patientId.trim(), mode: "insensitive" } }
                }
            });
        }

        if (!patient) {
            return res.status(404).json({ message: `Patient '${patientId}' not found. Please provide a valid patient UUID or registered patient email address.` });
        }

        const prescription = await prisma.prescription.create({
            data: {
                doctorId: doctor.id,
                patientId: patient.id,
                appointmentId: appointmentId || null,
                diagnosis,
                medications, // Array of { name, dosage, frequency, duration, instructions }
                notes: notes || null,
                validUntil: validUntil ? new Date(validUntil) : null,
                isActive: true
            },
            include: {
                doctor: {
                    select: {
                        firstName: true,
                        lastName: true,
                        specialization: true,
                        licenseNumber: true
                    }
                }
            }
        });

        res.status(201).json({
            message: "Prescription issued successfully",
            prescription
        });
    } catch (error) {
        console.error("Create Prescription Error:", error);
        res.status(500).json({ message: "Failed to issue prescription", error: error.message });
    }
};

// 8. Get Patient Prescriptions
export const getPatientPrescriptions = async (req, res) => {
    try {
        const { patientId } = req.params;

        const prescriptions = await prisma.prescription.findMany({
            where: { patientId },
            include: {
                doctor: {
                    select: {
                        firstName: true,
                        lastName: true,
                        specialization: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        res.json({ prescriptions });
    } catch (error) {
        console.error("Get Prescriptions Error:", error);
        res.status(500).json({ message: "Failed to fetch prescriptions", error: error.message });
    }
};
