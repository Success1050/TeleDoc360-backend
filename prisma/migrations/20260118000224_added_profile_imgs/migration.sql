/*
  Warnings:

  - You are about to drop the column `profileImage` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."doctors" ADD COLUMN     "profileImage" TEXT;

-- AlterTable
ALTER TABLE "public"."patients" ADD COLUMN     "profileImage" TEXT;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "profileImage";
