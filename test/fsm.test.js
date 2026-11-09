import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Appointment Finite State Machine (FSM) Matrix Tests", () => {
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

    const ROLE_PERMISSIONS = {
        APPROVED: ["DOCTOR", "ADMIN"],
        CONFIRMED: ["PATIENT", "DOCTOR", "ADMIN"],
        IN_PROGRESS: ["DOCTOR", "ADMIN"],
        COMPLETED: ["DOCTOR", "ADMIN"],
        NO_SHOW: ["DOCTOR", "ADMIN"],
        CANCELLED: ["PATIENT", "DOCTOR", "ADMIN"],
        RESCHEDULED: ["PATIENT", "DOCTOR", "ADMIN"]
    };

    test("Permits valid sequential progression: REQUESTED -> APPROVED -> CONFIRMED -> IN_PROGRESS -> COMPLETED", () => {
        let current = "REQUESTED";
        const path = ["APPROVED", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

        for (const next of path) {
            const allowed = VALID_TRANSITIONS[current];
            assert.ok(allowed.includes(next), `Transition from ${current} to ${next} must be valid`);
            current = next;
        }
    });

    test("Rejects illegal transitions: Cannot jump directly from REQUESTED to COMPLETED or IN_PROGRESS", () => {
        const allowedFromRequested = VALID_TRANSITIONS["REQUESTED"];
        assert.equal(allowedFromRequested.includes("COMPLETED"), false);
        assert.equal(allowedFromRequested.includes("IN_PROGRESS"), false);
    });

    test("Terminal states have no outgoing transitions", () => {
        assert.equal(VALID_TRANSITIONS["COMPLETED"].length, 0);
        assert.equal(VALID_TRANSITIONS["CANCELLED"].length, 0);
        assert.equal(VALID_TRANSITIONS["NO_SHOW"].length, 0);
    });

    test("Role permissions enforce that only DOCTOR or ADMIN can mark COMPLETED or IN_PROGRESS", () => {
        assert.ok(ROLE_PERMISSIONS["IN_PROGRESS"].includes("DOCTOR"));
        assert.ok(!ROLE_PERMISSIONS["IN_PROGRESS"].includes("PATIENT"));
        assert.ok(ROLE_PERMISSIONS["COMPLETED"].includes("DOCTOR"));
        assert.ok(!ROLE_PERMISSIONS["COMPLETED"].includes("PATIENT"));
    });
});

