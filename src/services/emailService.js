import nodemailer from "nodemailer";
import { prisma } from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === "465",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Core sendEmail function with automatic DB notification audit logging
 */
export const sendEmail = async ({
    to,
    subject,
    html,
    text,
    type = "APPOINTMENT_CONFIRMATION",
    userId = null,
    metadata = null,
}) => {
    let notificationRecord = null;

    try {
        // 1. Create PENDING notification record in DB if user is provided or find by email
        let targetUserId = userId;
        if (!targetUserId) {
            const user = await prisma.user.findUnique({ where: { email: to } });
            if (user) targetUserId = user.id;
        }

        if (targetUserId) {
            notificationRecord = await prisma.notification.create({
                data: {
                    userId: targetUserId,
                    type,
                    status: "PENDING",
                    recipient: to,
                    subject,
                    message: text || subject,
                    metadata: metadata ? metadata : undefined,
                },
            });
        }

        // 2. Dispatch email via Nodemailer
        const mailOptions = {
            from: process.env.FROM_EMAIL || `"TeleDoc360" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Message sent to ${to}: ${info.messageId}`);

        // 3. Mark as SENT in DB
        if (notificationRecord) {
            await prisma.notification.update({
                where: { id: notificationRecord.id },
                data: {
                    status: "SENT",
                    sentAt: new Date(),
                },
            });
        }

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[EmailService] Failed to send email to ${to}:`, error.message);

        // Mark as FAILED in DB
        if (notificationRecord) {
            await prisma.notification.update({
                where: { id: notificationRecord.id },
                data: {
                    status: "FAILED",
                    failedAt: new Date(),
                    errorMessage: error.message,
                },
            });
        }

        // Return error object without crashing the calling workflow
        return { success: false, error: error.message };
    }
};

/**
 * Template: Appointment Confirmation
 */
export const sendAppointmentConfirmation = async (appointment, patient, doctor) => {
    const dateFormatted = new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg: 8px;">
            <h2 style="color: #2563eb;">Appointment Confirmed - TeleDoc360</h2>
            <p>Dear ${patient.firstName} ${patient.lastName},</p>
            <p>Your appointment with <strong>Dr. ${doctor.firstName} ${doctor.lastName}</strong> (${doctor.specialization}) has been scheduled.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Date:</strong> ${dateFormatted}</p>
                <p style="margin: 5px 0;"><strong>Duration:</strong> ${appointment.duration} minutes</p>
                <p style="margin: 5px 0;"><strong>Type:</strong> ${appointment.type}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> ${appointment.status}</p>
            </div>
            <p>Please log in to your TeleDoc360 dashboard prior to the scheduled time.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">TeleDoc360 Healthcare System</p>
        </div>
    `;

    return sendEmail({
        to: patient.user?.email || patient.email,
        subject: `Appointment Confirmed with Dr. ${doctor.lastName}`,
        html,
        text: `Your appointment with Dr. ${doctor.lastName} on ${dateFormatted} is confirmed.`,
        type: "APPOINTMENT_CONFIRMATION",
        userId: patient.userId,
        metadata: { appointmentId: appointment.id },
    });
};

/**
 * Template: Appointment Cancellation
 */
export const sendAppointmentCancellation = async (appointment, recipientEmail, recipientUserId, reason) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #dc2626;">Appointment Cancelled</h2>
            <p>We are notifying you that the following appointment has been cancelled:</p>
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${appointment.id}</p>
                <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason || "No reason specified"}</p>
            </div>
            <p>You can schedule a new consultation via your TeleDoc360 dashboard at any time.</p>
        </div>
    `;

    return sendEmail({
        to: recipientEmail,
        subject: "Appointment Cancellation Notification",
        html,
        text: `Your appointment has been cancelled. Reason: ${reason || "Not specified"}`,
        type: "APPOINTMENT_CANCELLATION",
        userId: recipientUserId,
        metadata: { appointmentId: appointment.id, reason },
    });
};
