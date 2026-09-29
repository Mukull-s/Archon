import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Prisma Client Singleton (Prisma v7)
 * 
 * Uses the PostgreSQL driver adapter for direct database connection.
 * The raw `pg` pool is also exported so bulk paths (binary COPY) can use the
 * native PostgreSQL COPY protocol, which Prisma's query engine cannot express.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function createPgPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
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

const pool = globalForPrisma.pgPool ?? createPgPool();
const prismaClient = globalForPrisma.prisma ?? createPrismaClient(pool);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient;
  globalForPrisma.pgPool = pool;
}

export const prisma = prismaClient;
/** Raw pg pool. Use only for operations Prisma cannot express (e.g. COPY). */
export const pgPool = pool;
