import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// 1. Create a pg Pool instance using your DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Pass the pool to the PrismaPg driver adapter
const adapter = new PrismaPg(pool);

// 3. Prevent duplicate instances during Next.js Hot Module Replacement (HMR)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
