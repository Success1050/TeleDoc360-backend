import { getAIClinicalRecommendations } from "../services/aiRecommendationService.js";
import { calculatePatientRiskScore } from "../services/riskScoringService.js";
import { prisma } from "../config/db.js";

/**
 * AI & Clinical Decision Support Controller
 */

export const getMedicationRecommendations = async (req, res) => {
    try {
        const {
            patientId,
            diagnosis,
            symptoms,
            patientAge,
            patientGender
        } = req.body;

        if (!diagnosis) {
            return res.status(400).json({ message: "diagnosis is required" });
        }

        let resolvedAge = patientAge;
        let resolvedGender = patientGender;

        // If patientId is provided, pull age and gender from DB if not passed
        if (patientId && (!resolvedAge || !resolvedGender)) {
            const patient = await prisma.patient.findUnique({ where: { id: patientId } });
            if (patient) {
                if (!resolvedAge && patient.dateOfBirth) {
                    resolvedAge = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();
                }
                if (!resolvedGender && patient.gender) {
                    resolvedGender = patient.gender;
                }
            }
        }

        const result = await getAIClinicalRecommendations({
            patientId,
            diagnosis,
            symptoms: symptoms || [],
            patientAge: resolvedAge || 30,
            patientGender: resolvedGender || "PREFER_NOT_TO_SAY"
        });

        res.json({
            message: "Clinical recommendations generated successfully",
            data: result
        });
    } catch (error) {
        console.error("AI Recommendation Error:", error);
        res.status(500).json({ message: "Failed to generate recommendations", error: error.message });
    }
};

export const evaluatePatientRisk = async (req, res) => {
    try {
        const { patientId, severity = "MEDIUM" } = req.body;

        if (!patientId) {
            return res.status(400).json({ message: "patientId is required" });
        }

        const riskData = await calculatePatientRiskScore(patientId, severity);

        res.json({
            message: "Patient dynamic risk score evaluated successfully",
            riskData
        });
    } catch (error) {
        console.error("Evaluate Risk Error:", error);
        res.status(500).json({ message: "Failed to evaluate patient risk", error: error.message });
    }
};

