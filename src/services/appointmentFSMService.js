import { prisma } from "../config/db.js";
import { handlePatientAppointmentCompletion, handleDoctorAppointmentCompletion } from "./reputationIncentiveService.js";
import { sendAppointmentCancellation } from "./emailService.js";

/**
 * Appointment Lifecycle Finite State Machine (Section 3.C.2)
 *
 * Formal Transitions Matrix:
 * REQUESTED   -> APPROVED, CANCELLED
 * APPROVED    -> CONFIRMED, CANCELLED, RESCHEDULED
 * CONFIRMED   -> IN_PROGRESS, CANCELLED, NO_SHOW, RESCHEDULED
 * IN_PROGRESS -> COMPLETED, CANCELLED
 * Terminal: CANCELLED, NO_SHOW, COMPLETED, RESCHEDULED
 */

const VALID_TRANSITIONS = {
    REQUESTED: ["APPROVED", "CANCELLED"],
    APPROVED: ["CONFIRMED", "CANCELLED", "RESCHEDULED"],
    CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW", "RESCHEDULED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
    RESCHEDULED: []
};

// Role permissions per transition
const ROLE_PERMISSIONS = {
    APPROVED: ["DOCTOR", "ADMIN"],
    CONFIRMED: ["PATIENT", "DOCTOR", "ADMIN"],
    IN_PROGRESS: ["DOCTOR", "ADMIN"],
    COMPLETED: ["DOCTOR", "ADMIN"],
    NO_SHOW: ["DOCTOR", "ADMIN"],
    CANCELLED: ["PATIENT", "DOCTOR", "ADMIN"],
    RESCHEDULED: ["PATIENT", "DOCTOR", "ADMIN"]
};

export const transitionState = async ({
    appointmentId,
    targetState,
    actorRole,
    actorId,
    reason = ""
}) => {
    // 1. Fetch current appointment state
    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            patient: { include: { user: true } },
            doctor: { include: { user: true } }
        }
    });

    if (!appointment) {
        throw new Error("Appointment not found");
    }

    const currentState = appointment.status;

    // 2. Validate transition against state matrix
    const allowedTargets = VALID_TRANSITIONS[currentState] || [];
    if (!allowedTargets.includes(targetState)) {
        throw new Error(
            `Illegal state transition from '${currentState}' to '${targetState}'. Permitted transitions: [${allowedTargets.join(", ") || "None - Terminal State"}]`
        );
    }

    // 3. Validate actor permissions
    const permittedRoles = ROLE_PERMISSIONS[targetState] || [];
    if (!permittedRoles.includes(actorRole)) {
        throw new Error(
            `Role '${actorRole}' is not authorized to transition appointment to '${targetState}'. Allowed: [${permittedRoles.join(", ")}]`
        );
    }

    // 4. Pre-transition context validation
    if (targetState === "CANCELLED" && !reason) {
        throw new Error("Cancellation reason is required when transitioning to CANCELLED state.");
    }

    // 5. Execute state update and audit log in a transaction
    const updatedAppointment = await prisma.$transaction(async (tx) => {
        const updateData = { status: targetState };

        if (targetState === "APPROVED") {
            updateData.approvedAt = new Date();
        } else if (targetState === "COMPLETED") {
            updateData.completedAt = new Date();
        } else if (targetState === "CANCELLED") {
            updateData.cancelledAt = new Date();
            updateData.cancelledBy = actorRole;
            updateData.cancellationReason = reason;
        }

        const appt = await tx.appointment.update({
            where: { id: appointmentId },
            data: updateData
        });

        // Create formal status history audit log
        await tx.appointmentStatusHistory.create({
            data: {
                appointmentId,
                previousStatus: currentState,
                newStatus: targetState,
                changedBy: `${actorRole} (${actorId || "System"})`,
                reason: reason || `Transitioned to ${targetState}`
            }
        });

        return appt;
    });

    // 6. Post-transition side effects (Incentive & Reputation updates)
    try {
        if (targetState === "COMPLETED") {
            await handlePatientAppointmentCompletion(appointment.patientId, true);
            await handleDoctorAppointmentCompletion(appointment.doctorId, appointment.duration || 30);
        } else if (targetState === "NO_SHOW") {
            await handlePatientAppointmentCompletion(appointment.patientId, false);
        } else if (targetState === "CANCELLED") {
            const recipientEmail = actorRole === "PATIENT"
                ? appointment.doctor.user?.email
                : appointment.patient.user?.email;
            const recipientUserId = actorRole === "PATIENT"
                ? appointment.doctor.userId
                : appointment.patient.userId;

            if (recipientEmail) {
                await sendAppointmentCancellation(appointment, recipientEmail, recipientUserId, reason);
            }
        }
    } catch (sideEffectError) {
        console.error("Post-transition hook execution note:", sideEffectError.message);
    }

    return updatedAppointment;
};

