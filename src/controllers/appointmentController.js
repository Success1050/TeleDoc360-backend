import { prisma } from "../config/db.js";
import { calculatePatientRiskScore } from "../services/riskScoringService.js";
import {
    calculateDoctorWorkloadIndex,
    computePriorityScore,
    checkOverlappingAppointments,
    suggestAlternativeSlots
} from "../services/schedulingAlgorithmService.js";
import { transitionState } from "../services/appointmentFSMService.js";
import { validatePatientReputationForSlot } from "../services/reputationIncentiveService.js";
import { sendAppointmentConfirmation } from "../services/emailService.js";

/**
 * Core Appointment Controller with Algorithmic Scheduling & FSM
 */

// 1. Create Appointment (Patient or Admin)
export const createAppointment = async (req, res) => {
    try {
        let patientId = req.body.patientId;

        // If patient is making the request, use their logged-in profile
        if (req.user.role === "PATIENT") {
            const patient = await prisma.patient.findUnique({
                where: { userId: req.user.id }
            });
            if (!patient) {
                return res.status(404).json({ message: "Patient profile not found" });
            }
            patientId = patient.id;
        }

        if (!patientId) {
            return res.status(400).json({ message: "patientId is required" });
        }

        const {
            doctorId,
            appointmentDate,
            appointmentTime,
            duration = 30,
            type = "CONSULTATION",
            urgencyLevel = "MEDIUM",
            reason,
            symptoms,
            notes
        } = req.body;

        if (!doctorId || !appointmentDate || !appointmentTime) {
            return res.status(400).json({ message: "doctorId, appointmentDate, and appointmentTime are required" });
        }

        // Fetch patient and doctor entities
        const [patient, doctor] = await Promise.all([
            prisma.patient.findUnique({
                where: { id: patientId },
                include: { user: true }
            }),
            prisma.doctor.findUnique({
                where: { id: doctorId },
                include: { user: true }
            })
        ]);

        if (!patient) return res.status(404).json({ message: "Patient not found" });
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        // A. Reputation-Aware Access Control (Section 3.C.5):
        // Low-reputation patients cannot book peak-hour slots
        const timeString = typeof appointmentTime === "string" && appointmentTime.includes("T")
            ? new Date(appointmentTime).toTimeString().slice(0, 5)
            : appointmentTime.toString().slice(0, 5);

        const repCheck = validatePatientReputationForSlot(patient, timeString);
        if (!repCheck.allowed) {
            return res.status(403).json({
                message: repCheck.message,
                reputationScore: patient.reputationScore
            });
        }

        // Combine date and time
        const targetDateTime = new Date(`${appointmentDate.split("T")[0]}T${timeString}:00`);

        // B. Check for Double-Booking / Overlapping Appointments
        const overlapCheck = await checkOverlappingAppointments(doctorId, patientId, targetDateTime, duration);
        if (overlapCheck.conflict) {
            const alternativeSlots = await suggestAlternativeSlots(doctorId, appointmentDate, duration);
            return res.status(409).json({
                message: overlapCheck.reason || "The requested time slot conflicts with an existing appointment.",
                conflict: true,
                suggestedAlternativeSlots: alternativeSlots
            });
        }

        // C. Calculate Dynamic Patient Risk Score (Section 3.C.4)
        const riskResult = await calculatePatientRiskScore(patientId, urgencyLevel);
        const patientRiskScore = riskResult.riskScore;

        // D. Calculate Doctor Workload Index (Section 3.C.1)
        const { balanceScore } = await calculateDoctorWorkloadIndex(doctorId, targetDateTime);

        // E. Compute Multi-Factor Priority Score (Section 3.C.1)
        const priorityScore = computePriorityScore({
            patientRiskScore,
            urgencyLevel,
            doctorWorkloadBalance: balanceScore,
            targetDateTime
        });

        // F. Commit Appointment Transaction
        const appointment = await prisma.$transaction(async (tx) => {
            const created = await tx.appointment.create({
                data: {
                    patientId,
                    doctorId,
                    appointmentDate: new Date(appointmentDate),
                    appointmentTime: targetDateTime,
                    duration: parseInt(duration),
                    type,
                    urgencyLevel,
                    priorityScore,
                    status: "REQUESTED",
                    reason: reason || null,
                    symptoms: symptoms || null,
                    notes: notes || null
                },
                include: {
                    doctor: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            specialization: true,
                            consultationFee: true
                        }
                    },
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            riskScore: true,
                            reputationScore: true
                        }
                    }
                }
            });

            // Log initial FSM state creation in history
            await tx.appointmentStatusHistory.create({
                data: {
                    appointmentId: created.id,
                    previousStatus: null,
                    newStatus: "REQUESTED",
                    changedBy: `${req.user.role} (${patient.firstName} ${patient.lastName})`,
                    reason: "Initial appointment booking request submitted"
                }
            });

            return created;
        });

        // G. Trigger Notification Workflow
        try {
            await sendAppointmentConfirmation(appointment, patient, doctor);
        } catch (mailErr) {
            console.error("Email notification note:", mailErr.message);
        }

        res.status(201).json({
            message: "Appointment successfully requested",
            appointment,
            algorithmicMetrics: {
                patientRiskScore,
                riskClassification: riskResult.classification,
                doctorWorkloadBalance: balanceScore,
                priorityScore
            }
        });
    } catch (error) {
        console.error("Create Appointment Error:", error);
        res.status(500).json({ message: "Failed to create appointment", error: error.message });
    }
};

// 2. Get User Appointments (Patient, Doctor, or Admin)
export const getMyAppointments = async (req, res) => {
    try {
        const { role, id } = req.user;
        const { status, page = 1, limit = 20 } = req.query;

        const where = {};
        if (status) {
            where.status = status;
        }

        if (role === "PATIENT") {
            const patient = await prisma.patient.findUnique({ where: { userId: id } });
            if (!patient) return res.status(404).json({ message: "Patient profile not found" });
            where.patientId = patient.id;
        } else if (role === "DOCTOR") {
            const doctor = await prisma.doctor.findUnique({ where: { userId: id } });
            if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
            where.doctorId = doctor.id;
        }
        // If ADMIN, sees all appointments

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [appointments, total] = await Promise.all([
            prisma.appointment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: [
                    { priorityScore: "desc" },
                    { appointmentDate: "desc" }
                ],
                include: {
                    doctor: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            specialization: true,
                            consultationFee: true,
                            profilePicture: true
                        }
                    },
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            bloodGroup: true,
                            riskScore: true,
                            reputationScore: true,
                            dateOfBirth: true
                        }
                    },
                    statusHistory: {
                        orderBy: { timestamp: "desc" },
                        take: 5
                    },
                    medicalRecord: true,
                    prescription: true
                }
            }),
            prisma.appointment.count({ where })
        ]);

        res.json({
            appointments,
            pagination: {
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error("Get Appointments Error:", error);
        res.status(500).json({ message: "Failed to load appointments", error: error.message });
    }
};

// 3. Get Appointment Details by ID
export const getAppointmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: {
                doctor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        specialization: true,
                        consultationFee: true,
                        rating: true,
                        phoneNumber: true
                    }
                },
                patient: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        dateOfBirth: true,
                        gender: true,
                        bloodGroup: true,
                        phoneNumber: true,
                        riskScore: true,
                        reputationScore: true,
                        allergies: true
                    }
                },
                statusHistory: {
                    orderBy: { timestamp: "asc" }
                },
                medicalRecord: true,
                prescription: true
            }
        });

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        res.json({ appointment });
    } catch (error) {
        console.error("Get Appointment By ID Error:", error);
        res.status(500).json({ message: "Failed to retrieve appointment", error: error.message });
    }
};

// 4. Finite State Machine Transition Endpoint (Section 3.C.2)
export const transitionAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { targetState, reason } = req.body;

        if (!targetState) {
            return res.status(400).json({ message: "targetState is required" });
        }

        const updated = await transitionState({
            appointmentId: id,
            targetState,
            actorRole: req.user.role,
            actorId: req.user.id,
            reason
        });

        res.json({
            message: `Appointment state successfully transitioned to ${targetState}`,
            appointment: updated
        });
    } catch (error) {
        console.error("Transition State Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// 5. Cancel Appointment
export const cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const updated = await transitionState({
            appointmentId: id,
            targetState: "CANCELLED",
            actorRole: req.user.role,
            actorId: req.user.id,
            reason: reason || "User requested cancellation"
        });

        res.json({
            message: "Appointment cancelled successfully",
            appointment: updated
        });
    } catch (error) {
        console.error("Cancel Appointment Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// 6. Get Suggested Alternative Slots for Doctor
export const getDoctorSuggestedSlots = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date, duration = 30 } = req.query;

        if (!date) {
            return res.status(400).json({ message: "date query parameter (YYYY-MM-DD) is required" });
        }

        const suggestions = await suggestAlternativeSlots(doctorId, date, parseInt(duration));
        res.json({ suggestedSlots: suggestions });
    } catch (error) {
        console.error("Suggested Slots Error:", error);
        res.status(500).json({ message: "Failed to retrieve suggested slots", error: error.message });
    }
};

