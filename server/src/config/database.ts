import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Prisma Client Singleton (Prisma v7)
 * 
 * Uses the PostgreSQL driver adapter for direct database connection.
 * Singleton pattern prevents multiple connections during hot-reloading.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPgPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Create a pg Pool with SSL for Neon, configured for scale
  return new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,                          // Increase pool size (default is 10)
    idleTimeoutMillis: 30000,         // Close idle connections after 30 seconds
    connectionTimeoutMillis: 5000,    // 5 seconds connection checkout timeout
  });
}

function createPrismaClient(pool: pg.Pool): PrismaClient {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const pool = createPgPool();
export const prisma = globalForPrisma.prisma ?? createPrismaClient(pool);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
