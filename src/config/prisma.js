import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Reuse a single PrismaClient across hot reloads in dev.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: env.isProd ? ['error'] : ['warn', 'error'],
  });

if (!env.isProd) globalForPrisma.__prisma = prisma;
