import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    calculateUrgencyScore,
    calculateTemporalProximityScore,
    computePriorityScore
} from "../src/services/schedulingAlgorithmService.js";
import { validatePatientReputationForSlot } from "../src/services/reputationIncentiveService.js";

describe("Adaptive Scheduling & Priority Algorithm Tests", () => {
    test("Urgency score mapping adheres to severity levels", () => {
        assert.equal(calculateUrgencyScore("EMERGENCY"), 100);
        assert.equal(calculateUrgencyScore("HIGH"), 75);
        assert.equal(calculateUrgencyScore("MEDIUM"), 45);
        assert.equal(calculateUrgencyScore("LOW"), 20);
    });

    test("Priority score formula correctly weighs risk, urgency, doctor workload, and temporal proximity", () => {
        // Formula: 0.45*PatientRisk + 0.30*Urgency + 0.15*DoctorWorkloadBalance + 0.10*TemporalProximity
        const patientRiskScore = 80; // High risk patient
        const urgencyLevel = "HIGH"; // Urgency score = 75
        const doctorWorkloadBalance = 80;
        const targetDateTime = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours away -> score = 90

        const score = computePriorityScore({
            patientRiskScore,
            urgencyLevel,
            doctorWorkloadBalance,
            targetDateTime
        });

        const expected = parseFloat((
            (0.45 * 80) +
            (0.30 * 75) +
            (0.15 * 80) +
            (0.10 * 90)
        ).toFixed(2));

        assert.equal(score, expected);
        assert.ok(score >= 70, "High risk and high urgency should yield high priority");
    });

    test("Reputation-aware access control blocks low-reputation patients from peak-hour slots", () => {
        const lowReputationPatient = { reputationScore: 40.0 };
        const peakTime = "10:00"; // Within 09:00 - 11:00 peak hours

        const result = validatePatientReputationForSlot(lowReputationPatient, peakTime);
        assert.equal(result.allowed, false, "Should block booking during peak hour");
        assert.ok(result.message.includes("Peak-hour slots"));

        const highReputationPatient = { reputationScore: 85.0 };
        const okResult = validatePatientReputationForSlot(highReputationPatient, peakTime);
        assert.equal(okResult.allowed, true, "High reputation patients must be permitted");
    });
});

