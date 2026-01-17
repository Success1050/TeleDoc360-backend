-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('REQUESTED', 'APPROVED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "public"."AppointmentType" AS ENUM ('CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'ROUTINE_CHECKUP');

-- CreateEnum
CREATE TYPE "public"."SlotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER', 'APPOINTMENT_CANCELLATION', 'APPOINTMENT_RESCHEDULED', 'VERIFICATION_EMAIL', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."patients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "emergencyContact" TEXT,
    "bloodGroup" TEXT,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."doctors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "gender" "public"."Gender" NOT NULL,
    "specialization" TEXT NOT NULL,
    "qualifications" TEXT[],
    "licenseNumber" TEXT NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL,
    "consultationFee" DECIMAL(10,2) NOT NULL,
    "bio" TEXT,
    "profilePicture" TEXT,
    "rating" DECIMAL(3,2),
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "isAvailableForBooking" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "appointmentTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "type" "public"."AppointmentType" NOT NULL DEFAULT 'CONSULTATION',
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "symptoms" TEXT,
    "notes" TEXT,
    "consultationNotes" TEXT,
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_status_history" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "previousStatus" "public"."AppointmentStatus",
    "newStatus" "public"."AppointmentStatus" NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."availability_slots" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "status" "public"."SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medical_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "diagnosis" TEXT NOT NULL,
    "symptoms" TEXT[],
    "vitalSigns" JSONB,
    "labResults" TEXT,
    "notes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."allergies" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reaction" TEXT,
    "diagnosedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prescriptions" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "medications" JSONB NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_recommendations" (
    "id" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "patientAge" INTEGER NOT NULL,
    "patientGender" "public"."Gender" NOT NULL,
    "symptoms" TEXT[],
    "contraindications" TEXT[],
    "recommendations" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_verification_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "patients_userId_key" ON "public"."patients"("userId");

-- CreateIndex
CREATE INDEX "patients_userId_idx" ON "public"."patients"("userId");

-- CreateIndex
CREATE INDEX "patients_lastName_firstName_idx" ON "public"."patients"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_userId_key" ON "public"."doctors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_licenseNumber_key" ON "public"."doctors"("licenseNumber");

-- CreateIndex
CREATE INDEX "doctors_userId_idx" ON "public"."doctors"("userId");

-- CreateIndex
CREATE INDEX "doctors_specialization_idx" ON "public"."doctors"("specialization");

-- CreateIndex
CREATE INDEX "doctors_licenseNumber_idx" ON "public"."doctors"("licenseNumber");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "public"."appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_doctorId_idx" ON "public"."appointments"("doctorId");

-- CreateIndex
CREATE INDEX "appointments_appointmentDate_idx" ON "public"."appointments"("appointmentDate");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "public"."appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_appointmentDate_appointmentTime_idx" ON "public"."appointments"("appointmentDate", "appointmentTime");

-- CreateIndex
CREATE INDEX "appointment_status_history_appointmentId_idx" ON "public"."appointment_status_history"("appointmentId");

-- CreateIndex
CREATE INDEX "appointment_status_history_timestamp_idx" ON "public"."appointment_status_history"("timestamp");

-- CreateIndex
CREATE INDEX "availability_slots_doctorId_idx" ON "public"."availability_slots"("doctorId");

-- CreateIndex
CREATE INDEX "availability_slots_dayOfWeek_idx" ON "public"."availability_slots"("dayOfWeek");

-- CreateIndex
CREATE INDEX "availability_slots_date_idx" ON "public"."availability_slots"("date");

-- CreateIndex
CREATE INDEX "availability_slots_status_idx" ON "public"."availability_slots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_appointmentId_key" ON "public"."medical_records"("appointmentId");

-- CreateIndex
CREATE INDEX "medical_records_patientId_idx" ON "public"."medical_records"("patientId");

-- CreateIndex
CREATE INDEX "medical_records_doctorId_idx" ON "public"."medical_records"("doctorId");

-- CreateIndex
CREATE INDEX "medical_records_appointmentId_idx" ON "public"."medical_records"("appointmentId");

-- CreateIndex
CREATE INDEX "medical_records_createdAt_idx" ON "public"."medical_records"("createdAt");

-- CreateIndex
CREATE INDEX "allergies_patientId_idx" ON "public"."allergies"("patientId");

-- CreateIndex
CREATE INDEX "allergies_allergen_idx" ON "public"."allergies"("allergen");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_appointmentId_key" ON "public"."prescriptions"("appointmentId");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_idx" ON "public"."prescriptions"("patientId");

-- CreateIndex
CREATE INDEX "prescriptions_doctorId_idx" ON "public"."prescriptions"("doctorId");

-- CreateIndex
CREATE INDEX "prescriptions_appointmentId_idx" ON "public"."prescriptions"("appointmentId");

-- CreateIndex
CREATE INDEX "prescriptions_createdAt_idx" ON "public"."prescriptions"("createdAt");

-- CreateIndex
CREATE INDEX "ai_recommendations_diagnosis_idx" ON "public"."ai_recommendations"("diagnosis");

-- CreateIndex
CREATE INDEX "ai_recommendations_createdAt_idx" ON "public"."ai_recommendations"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "public"."notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "public"."notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "public"."notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "public"."notifications"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "public"."audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "public"."audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "public"."system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_key_idx" ON "public"."system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "public"."password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_idx" ON "public"."password_reset_tokens"("email");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "public"."password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "public"."password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "public"."email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_email_idx" ON "public"."email_verification_tokens"("email");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "public"."email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expiresAt_idx" ON "public"."email_verification_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."doctors" ADD CONSTRAINT "doctors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."availability_slots" ADD CONSTRAINT "availability_slots_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medical_records" ADD CONSTRAINT "medical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medical_records" ADD CONSTRAINT "medical_records_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medical_records" ADD CONSTRAINT "medical_records_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."allergies" ADD CONSTRAINT "allergies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prescriptions" ADD CONSTRAINT "prescriptions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
