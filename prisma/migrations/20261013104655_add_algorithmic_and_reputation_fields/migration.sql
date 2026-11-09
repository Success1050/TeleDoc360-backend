-- CreateEnum
CREATE TYPE "public"."UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');

-- AlterTable
ALTER TABLE "public"."appointments" ADD COLUMN     "priorityScore" DOUBLE PRECISION,
ADD COLUMN     "urgencyLevel" "public"."UrgencyLevel" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "public"."doctors" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
ADD COLUMN     "responseTimeMinutes" INTEGER,
ADD COLUMN     "rewardPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."patients" ADD COLUMN     "attendanceRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
ADD COLUMN     "missedAppointments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
ADD COLUMN     "rewardPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- CreateIndex
CREATE INDEX "appointments_priorityScore_idx" ON "public"."appointments"("priorityScore");

-- CreateIndex
CREATE INDEX "doctors_isApproved_idx" ON "public"."doctors"("isApproved");

-- CreateIndex
CREATE INDEX "doctors_reputationScore_idx" ON "public"."doctors"("reputationScore");
