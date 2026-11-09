import { prisma } from "../config/db.js";

/**
 * Adaptive Intelligent Appointment Scheduling Algorithm (Section 3.C.1)
 * Multi-factor priority score calculation:
 * PriorityScore = (0.45 * PatientRiskScore) +
 *                 (0.30 * UrgencyLevelScore) +
 *                 (0.15 * DoctorWorkloadBalance) +
 *                 (0.10 * TemporalProximity)
 */

export const calculateUrgencyScore = (urgencyLevel) => {
    switch ((urgencyLevel || "MEDIUM").toUpperCase()) {
        case "EMERGENCY": return 100;
        case "HIGH": return 75;
        case "MEDIUM": return 45;
        case "LOW": return 20;
        default: return 40;
    }
};

export const calculateTemporalProximityScore = (targetDateTime) => {
    const diffHours = (new Date(targetDateTime).getTime() - Date.now()) / (1000 * 60 * 60);
    if (diffHours <= 0) return 100;
    if (diffHours <= 12) return 90;
    if (diffHours <= 24) return 80;
    if (diffHours <= 72) return 60;
    if (diffHours <= 168) return 40; // 1 week
    return 20;
};

export const calculateDoctorWorkloadIndex = async (doctorId, targetDate) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const activeAppointmentsCount = await prisma.appointment.count({
        where: {
            doctorId,
            appointmentDate: {
                gte: startOfDay,
                lte: endOfDay
            },
            status: {
                in: ["REQUESTED", "APPROVED", "CONFIRMED", "IN_PROGRESS"]
            }
        }
    });

    // Inverse load balance score: lighter workload gives higher balance score (0 - 100)
    // E.g. 0 appointments = 100, 8 appointments = 20, >10 = 5
    const balanceScore = Math.max(10, 100 - (activeAppointmentsCount * 10));
    return { activeAppointmentsCount, balanceScore };
};

export const computePriorityScore = ({
    patientRiskScore,
    urgencyLevel,
    doctorWorkloadBalance,
    targetDateTime
}) => {
    const urgencyScore = calculateUrgencyScore(urgencyLevel);
    const temporalProximityScore = calculateTemporalProximityScore(targetDateTime);

    const raw = (
        (0.45 * (patientRiskScore || 20)) +
        (0.30 * urgencyScore) +
        (0.15 * doctorWorkloadBalance) +
        (0.10 * temporalProximityScore)
    );

    return parseFloat(raw.toFixed(2));
};

/**
 * Check for overlapping appointments for this doctor and patient
 */
export const checkOverlappingAppointments = async (doctorId, patientId, startDateTime, durationMinutes = 30) => {
    const requestedStart = new Date(startDateTime);
    const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60 * 1000);

    const startOfDay = new Date(requestedStart);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedStart);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all non-cancelled appointments for this doctor on this day
    const doctorAppointments = await prisma.appointment.findMany({
        where: {
            doctorId,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { in: ["REQUESTED", "APPROVED", "CONFIRMED", "IN_PROGRESS"] }
        }
    });

    for (const appt of doctorAppointments) {
        const apptStart = new Date(appt.appointmentTime || appt.appointmentDate);
        const apptEnd = new Date(apptStart.getTime() + (appt.duration || 30) * 60 * 1000);

        if (requestedStart < apptEnd && requestedEnd > apptStart) {
            return {
                conflict: true,
                conflictingAppointment: appt,
                reason: `Doctor has an existing ${appt.status} appointment from ${apptStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${apptEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            };
        }
    }

    // Check if patient also has overlapping appointment anywhere
    const patientAppointments = await prisma.appointment.findMany({
        where: {
            patientId,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { in: ["REQUESTED", "APPROVED", "CONFIRMED", "IN_PROGRESS"] }
        }
    });

    for (const appt of patientAppointments) {
        const apptStart = new Date(appt.appointmentTime || appt.appointmentDate);
        const apptEnd = new Date(apptStart.getTime() + (appt.duration || 30) * 60 * 1000);

        if (requestedStart < apptEnd && requestedEnd > apptStart) {
            return {
                conflict: true,
                conflictingAppointment: appt,
                reason: `Patient already has a consultation scheduled during this time window.`
            };
        }
    }

    return { conflict: false };
};

/**
 * Suggest Ranked Alternative Slots if Conflict Occurs
 */
export const suggestAlternativeSlots = async (doctorId, dateStr, duration = 30) => {
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay();

    const slots = await prisma.availabilitySlot.findMany({
        where: {
            doctorId,
            OR: [
                { date: targetDate },
                { dayOfWeek, isRecurring: true }
            ],
            status: "AVAILABLE"
        }
    });

    const suggestions = [];
    for (const slot of slots) {
        const [startH, startM] = slot.startTime.split(":").map(Number);
        const [endH, endM] = slot.endTime.split(":").map(Number);

        const slotStart = new Date(targetDate);
        slotStart.setHours(startH, startM, 0, 0);

        const slotEnd = new Date(targetDate);
        slotEnd.setHours(endH, endM, 0, 0);

        let current = new Date(slotStart);
        while (current.getTime() + duration * 60000 <= slotEnd.getTime()) {
            const overlap = await checkOverlappingAppointments(doctorId, "NONE", current, duration);
            if (!overlap.conflict) {
                const timeStr = current.toTimeString().slice(0, 5);
                suggestions.push({
                    time: timeStr,
                    dateTime: new Date(current),
                    suitabilityScore: 90
                });
            }
            // Move in 30 min increments
            current = new Date(current.getTime() + 30 * 60000);
        }
    }

    return suggestions.slice(0, 5);
};

