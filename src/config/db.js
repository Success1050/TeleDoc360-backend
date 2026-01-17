import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const connectdb = async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error("Database connection failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

const disconnectdb = async () => {
  await prisma.$disconnect();
};

export { prisma, connectdb, disconnectdb };
