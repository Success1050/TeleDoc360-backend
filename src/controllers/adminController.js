import { prisma } from "../config/db.js";
import { getDoctorOnboardingData } from "./userController.js";

/**
 * Administrator Controller
 */

// 1. Get System Statistics
export const getAdminStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalPatients,
            totalDoctors,
            pendingDoctors,
            totalAppointments,
            completedAppointments,
            highRiskPatients
        ] = await Promise.all([
            prisma.user.count(),
            prisma.patient.count(),
            prisma.doctor.count(),
            prisma.doctor.count({ where: { isApproved: false } }),
            prisma.appointment.count(),
            prisma.appointment.count({ where: { status: "COMPLETED" } }),
            prisma.patient.count({ where: { riskScore: { gte: 61.0 } } })
        ]);

        res.json({
            stats: {
                totalUsers,
                totalPatients,
                totalDoctors,
                pendingDoctors,
                totalAppointments,
                completedAppointments,
                highRiskPatients
            }
        });
    } catch (error) {
        console.error("Admin Stats Error:", error);
        res.status(500).json({ message: "Failed to load admin stats", error: error.message });
    }
};

// 2. Approve or Reject Doctor Profile & Onboarding Application
export const setDoctorApprovalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isApproved, adminNotes, status } = req.body;

        if (isApproved === undefined) {
            return res.status(400).json({ message: "isApproved boolean is required" });
        }

        const doctor = await prisma.doctor.update({
            where: { id },
            data: { isApproved: Boolean(isApproved) }
        });

        // Update onboarding status in SystemSetting if present
        const existingOnboarding = await getDoctorOnboardingData(id);
        const updatedOnboarding = {
            ...(existingOnboarding || { onboardingCompleted: Boolean(isApproved) }),
            status: isApproved ? "APPROVED" : (status || "REJECTED"),
            adminReviewNotes: adminNotes !== undefined ? adminNotes : (existingOnboarding?.adminReviewNotes || ""),
            reviewedAt: new Date().toISOString()
        };

        await prisma.systemSetting.upsert({
            where: { key: `doctor_onboarding:${id}` },
            update: {
                value: JSON.stringify(updatedOnboarding)
            },
            create: {
                key: `doctor_onboarding:${id}`,
                value: JSON.stringify(updatedOnboarding),
                description: `Doctor Onboarding & Credentialing Application for Dr. ${doctor.firstName} ${doctor.lastName}`,
                isEditable: true
            }
        });

        // Audit Log entry
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: isApproved ? "APPROVE_DOCTOR" : "REJECT_OR_REVOKE_DOCTOR",
                entity: "Doctor",
                entityId: id,
                changes: {
                    isApproved: Boolean(isApproved),
                    status: updatedOnboarding.status,
                    adminReviewNotes: updatedOnboarding.adminReviewNotes
                }
            }
        });

        res.json({
            message: isApproved
                ? `Dr. ${doctor.firstName} ${doctor.lastName} has been verified and approved!`
                : `Dr. ${doctor.firstName} ${doctor.lastName} status updated to ${updatedOnboarding.status === "REJECTED" ? "Changes Requested / Rejected" : "Pending Approval"}`,
            doctor: {
                ...doctor,
                onboarding: updatedOnboarding
            }
        });
    } catch (error) {
        console.error("Doctor Approval Error:", error);
        res.status(500).json({ message: "Failed to update doctor approval status", error: error.message });
    }
};

// 3. View System Audit Logs
export const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                skip,
                take: parseInt(limit),
                orderBy: { timestamp: "desc" },
                include: {
                    user: {
                        select: { email: true, role: true }
                    }
                }
            }),
            prisma.auditLog.count()
        ]);

        res.json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error("Get Audit Logs Error:", error);
        res.status(500).json({ message: "Failed to load audit logs", error: error.message });
    }
};
