import { prisma } from '../config';
import { logger } from '../utils';



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

export async function ensureDatabaseSchema(): Promise<void> {
  for (const spec of REQUIRED_COLUMNS) {
    const exists = await columnExists(spec.table, spec.column);
    if (exists) continue;
    await prisma.$executeRawUnsafe(spec.ddl);
    logger.info(`Database schema reconciled: added ${spec.table}.${spec.column}`);
  }
}
