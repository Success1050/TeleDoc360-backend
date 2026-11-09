import { prisma } from "../config/db.js";

/**
 * Dynamic Patient Risk Scoring System (Proposal Section 3.C.4)
 * Evaluates physiological, behavioral, and clinical severity factors.
 * Risk classification:
 *   0 - 30  -> Low Risk
 *   31 - 60 -> Medium Risk
 *   61+     -> High Risk
 */
export const calculatePatientRiskScore = async (patientId, currentSeverity = "MEDIUM") => {
    try {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                medicalRecords: true,
                appointments: {
                    where: {
                        createdAt: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                        }
                    }
                }
            }
        });

        if (!patient) return 20.0; // Default baseline risk

        // 1. Age Factor (Extreme ages have elevated clinical risk)
        let ageFactor = 30;
        if (patient.dateOfBirth) {
            const birthYear = new Date(patient.dateOfBirth).getFullYear();
            const currentYear = new Date().getFullYear();
            const age = currentYear - birthYear;
            if (age < 5 || age > 65) ageFactor = 90;
            else if (age >= 50) ageFactor = 65;
            else if (age >= 18) ageFactor = 30;
            else ageFactor = 20;
        }

        // 2. Chronic / Past Conditions Count
        const uniqueDiagnoses = new Set(
            patient.medicalRecords?.map(r => r.diagnosis?.toLowerCase().trim()).filter(Boolean)
        );
        const conditionCount = uniqueDiagnoses.size;
        const conditionFactor = Math.min(conditionCount * 25, 100);

        // 3. Behavioral Factor: Missed Appointments
        const missedAppointments = patient.missedAppointments || 0;
        const behaviorFactor = Math.min(missedAppointments * 30, 100);

        // 4. Clinical Condition Severity Factor
        let severityFactor = 40;
        const normalizedSeverity = (currentSeverity || "MEDIUM").toUpperCase();
        if (normalizedSeverity === "EMERGENCY") severityFactor = 100;
        else if (normalizedSeverity === "HIGH") severityFactor = 75;
        else if (normalizedSeverity === "MEDIUM") severityFactor = 40;
        else if (normalizedSeverity === "LOW") severityFactor = 15;

        // 5. Recent Activity History (Number of interactions in past 30 days)
        const recentInteractions = patient.appointments?.length || 0;
        const activityFactor = Math.min(recentInteractions * 20, 100);

        // Weights as defined in system architecture
        const AgeWeight = 0.15;
        const ConditionWeight = 0.25;
        const BehaviorWeight = 0.20;
        const SeverityWeight = 0.30;
        const TimeWeight = 0.10;

        const rawScore = (
            (AgeWeight * ageFactor) +
            (ConditionWeight * conditionFactor) +
            (BehaviorWeight * behaviorFactor) +
            (SeverityWeight * severityFactor) +
            (TimeWeight * activityFactor)
        );

        const computedRiskScore = Math.min(Math.max(parseFloat(rawScore.toFixed(2)), 0), 100);

        // Persist computed risk score back to patient record
        await prisma.patient.update({
            where: { id: patientId },
            data: { riskScore: computedRiskScore }
        });

        let classification = "LOW";
        if (computedRiskScore > 60) classification = "HIGH";
        else if (computedRiskScore > 30) classification = "MEDIUM";

        return {
            riskScore: computedRiskScore,
            classification,
            breakdown: {
                ageFactor,
                conditionFactor,
                behaviorFactor,
                severityFactor,
                activityFactor
            }
        };
    } catch (error) {
        console.error("Risk score calculation error:", error);
        return { riskScore: 25.0, classification: "LOW", breakdown: {} };
    }
};

