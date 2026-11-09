import { prisma } from "../config/db.js";

/**
 * Reputation-Aware Access Control & Incentive Mechanism System (Section 3.C.5 & 3.C.6)
 */

// 1. Peak-Hour Verification for Patient Booking
export const validatePatientReputationForSlot = (patient, appointmentTimeStr) => {
    // Peak hours: 09:00 - 11:00 and 14:00 - 16:00
    if (!appointmentTimeStr) return { allowed: true };

    const hours = parseInt(appointmentTimeStr.split(":")[0], 10);
    const isPeakHour = (hours >= 9 && hours < 11) || (hours >= 14 && hours < 16);

    const minReputationForPeak = 50.0;
    if (isPeakHour && (patient.reputationScore || 100) < minReputationForPeak) {
        return {
            allowed: false,
            message: `Peak-hour slots (${appointmentTimeStr}) require a reputation score of at least ${minReputationForPeak}. Your current score is ${patient.reputationScore}. Please select an off-peak slot or attend upcoming consultations to rebuild reputation.`
        };
    }

    return { allowed: true };
};

// 2. Doctor Approval Check for Sensitive Operations
export const validateDoctorApproval = (doctor) => {
    if (!doctor.isApproved) {
        return {
            allowed: false,
            message: "Doctor profile is pending administrative verification. Sensitive medical actions are restricted."
        };
    }
    return { allowed: true };
};

// 3. Post-Consultation Patient Incentive & Reputation Adjustment
export const handlePatientAppointmentCompletion = async (patientId, attended = true) => {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return;

    if (attended) {
        // Attendance points: Base 15 points
        const newRewardPoints = (patient.rewardPoints || 0) + 15;
        // Boost reputation slightly (up to 100 max)
        const newReputation = Math.min((patient.reputationScore || 100) + 2.5, 100);

        // Update attendance rate
        const totalAppointments = (await prisma.appointment.count({ where: { patientId } })) || 1;
        const missed = patient.missedAppointments || 0;
        const newAttendanceRate = Math.max(0, Math.min(100, ((totalAppointments - missed) / totalAppointments) * 100));

        await prisma.patient.update({
            where: { id: patientId },
            data: {
                rewardPoints: newRewardPoints,
                reputationScore: parseFloat(newReputation.toFixed(2)),
                attendanceRate: parseFloat(newAttendanceRate.toFixed(2))
            }
        });
    } else {
        // No-Show penalty
        const missed = (patient.missedAppointments || 0) + 1;
        // Significant reputation drop on unexcused absence
        const newReputation = Math.max((patient.reputationScore || 100) - 15.0, 0);

        const totalAppointments = (await prisma.appointment.count({ where: { patientId } })) || 1;
        const newAttendanceRate = Math.max(0, Math.min(100, ((totalAppointments - missed) / totalAppointments) * 100));

        await prisma.patient.update({
            where: { id: patientId },
            data: {
                missedAppointments: missed,
                reputationScore: parseFloat(newReputation.toFixed(2)),
                attendanceRate: parseFloat(newAttendanceRate.toFixed(2))
            }
        });
    }
};

// 4. Doctor Incentive Calculation on Completed Consultation
export const handleDoctorAppointmentCompletion = async (doctorId, consultationDurationMin = 30) => {
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) return;

    // Doctor receives 20 incentive reward points per completed consultation
    const newRewardPoints = (doctor.rewardPoints || 0) + 20;
    const newReputation = Math.min((doctor.reputationScore || 100) + 1.5, 100);

    await prisma.doctor.update({
        where: { id: doctorId },
        data: {
            rewardPoints: newRewardPoints,
            reputationScore: parseFloat(newReputation.toFixed(2))
        }
    });
};

