import { prisma } from '../config';
import { logger } from '../utils';

/**
 * Runtime schema reconciliation.
 *
 * This project does not require `prisma migrate deploy` on boot; the durable
 * queue already self-heals its table (`queue.service.ts#initQueue`). Because
 * Prisma selects every scalar column by default, any column the generated
 * client expects but the database lacks will fail the whole request (P2022).
 *
 * These statements are idempotent and additive only: they never drop data and
 * never modify existing columns. They exist so a schema change can ship safely
 * alongside a running database, and so a database that was migrated out-of-band
 * is brought to the same shape the migrations define.
 *
 * Index creation is separated out (`ensureIndexes`) because it is performance
 * work that must never block the server from serving traffic.
 */

interface ColumnSpec {
  table: string;
  column: string;
  /** Idempotent DDL. Static strings only — never interpolate user input. */
  ddl: string;
}

const REQUIRED_COLUMNS: ColumnSpec[] = [
  {
    table: 'Repository',
    column: 'indexingStats',
    ddl: `ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "indexingStats" JSONB`,
  },
  {
    table: 'Repository',
    column: 'commitSha',
    ddl: `ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "commitSha" TEXT`,
  },
];

interface IndexSpec {
  name: string;
  /** Idempotent DDL. Static strings only. */
  ddl: string;
}

const REQUIRED_INDEXES: IndexSpec[] = [
  {
    name: 'CodeChunk_embedding_hnsw_idx',
    ddl: `CREATE INDEX IF NOT EXISTS "CodeChunk_embedding_hnsw_idx" ON "CodeChunk" USING hnsw ("embedding" vector_cosine_ops)`,
  },
  {
    name: 'CodeChunk_repositoryId_filePath_idx',
    ddl: `CREATE INDEX IF NOT EXISTS "CodeChunk_repositoryId_filePath_idx" ON "CodeChunk" ("repositoryId", "filePath")`,
  },
  {
    name: 'ChatMessage_repositoryId_createdAt_idx',
    ddl: `CREATE INDEX IF NOT EXISTS "ChatMessage_repositoryId_createdAt_idx" ON "ChatMessage" ("repositoryId", "createdAt")`,
  },
  {
    name: 'Repository_userId_updatedAt_idx',
    ddl: `CREATE INDEX IF NOT EXISTS "Repository_userId_updatedAt_idx" ON "Repository" ("userId", "updatedAt")`,
  },
];

/** Redundant single-column indexes superseded by composite prefixes. */
const REDUNDANT_INDEXES = [
  'CodeChunk_repositoryId_idx',
  'ChatMessage_repositoryId_idx',
  'Repository_userId_idx',
];

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = ${column}
    ) AS "exists"
  `;
  return rows[0]?.exists === true;
}

async function getEmbeddingType(): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ formatted_type: string | null }>>`
    SELECT format_type(a.atttypid, a.atttypmod) AS formatted_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'CodeChunk' AND a.attname = 'embedding'
  `;
  return rows[0]?.formatted_type ?? null;
}

/**
 * Ensures the embedding column is vector(512). Safe against data: if a
 * differently-dimensioned column already holds vectors it is left alone and an
 * actionable error is logged (re-indexing is required to change dimension).
 */
async function ensureEmbeddingDimension(): Promise<void> {
  const type = await getEmbeddingType();
  if (!type || type === 'vector(512)') return;

  const rows = await prisma.$queryRaw<Array<{ has_data: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM "CodeChunk" WHERE embedding IS NOT NULL) AS "has_data"
  `;
  if (rows[0]?.has_data) {
    logger.error(
      `CodeChunk.embedding is ${type} but contains vectors; expected vector(512). Re-index affected repositories to rebuild embeddings.`
    );
    return;
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE "CodeChunk" ALTER COLUMN "embedding" TYPE vector(512)`);
  logger.info(`Database schema reconciled: CodeChunk.embedding ${type} -> vector(512)`);
}

/** Adds any missing columns. Must complete before the server serves requests. */
export async function ensureDatabaseSchema(): Promise<void> {
  for (const spec of REQUIRED_COLUMNS) {
    const exists = await columnExists(spec.table, spec.column);
    if (exists) continue;
    await prisma.$executeRawUnsafe(spec.ddl);
    logger.info(`Database schema reconciled: added ${spec.table}.${spec.column}`);
  }
  await ensureEmbeddingDimension();
}

/**
 * Creates performance indexes and removes redundant ones. Best-effort and
 * non-fatal: index work must never prevent the server from serving traffic.
 */
export async function ensureIndexes(): Promise<void> {
  for (const spec of REQUIRED_INDEXES) {
    try {
      await prisma.$executeRawUnsafe(spec.ddl);
    } catch (err: any) {
      logger.warn(`Index reconcile skipped for ${spec.name}: ${err.message}`);
    }
  }
  for (const name of REDUNDANT_INDEXES) {
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name}"`);
    } catch (err: any) {
      logger.warn(`Failed to drop redundant index ${name}: ${err.message}`);
    }
  }
  logger.info('Database indexes reconciled (HNSW + composites).');
}
