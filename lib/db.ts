import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __impactlensPrisma: PrismaClient | undefined;
}

// Reuse a single PrismaClient across hot reloads in dev; a fresh one in prod.
export const db = global.__impactlensPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__impactlensPrisma = db;
}
