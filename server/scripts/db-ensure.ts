import 'dotenv/config';

/**
 * Reconciles additive schema changes and indexes, then proves the exact call
 * paths work. Writes are wrapped in transactions that are deliberately rolled
 * back, so no data is modified.
 */
async function main() {
  const { ensureDatabaseSchema, ensureIndexes } = await import('../src/services/schema.service');
  const { prisma, pgPool } = await import('../src/config');

  await ensureDatabaseSchema();
  await ensureIndexes();

  // 1. Required columns.
  const cols = await prisma.$queryRaw<Array<{ column_name: string; formatted_type: string }>>`
    SELECT c.column_name, format_type(a.atttypid, a.atttypmod) AS formatted_type
    FROM information_schema.columns c
    JOIN pg_attribute a ON a.attname = c.column_name
      AND a.attrelid = (quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass
    WHERE c.table_name = 'Repository' AND c.column_name IN ('indexingStats','commitSha')
    ORDER BY c.column_name
  `;
  const colMap = new Map(cols.map(c => [c.column_name, c.formatted_type]));
  console.log('1. columns: indexingStats =', colMap.get('indexingStats') ?? 'MISSING', '| commitSha =', colMap.get('commitSha') ?? 'MISSING');

  // 2. Embedding dimension.
  const dim = await prisma.$queryRaw<Array<{ formatted_type: string }>>`
    SELECT format_type(a.atttypid, a.atttypmod) AS formatted_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='CodeChunk' AND a.attname='embedding'
  `;
  console.log('2. CodeChunk.embedding =', dim[0]?.formatted_type ?? 'MISSING');

  // 3. Indexes.
  const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname
  `;
  const names = new Set(idx.map(r => r.indexname));
  const required = [
    'CodeChunk_embedding_hnsw_idx',
    'CodeChunk_repositoryId_filePath_idx',
    'ChatMessage_repositoryId_createdAt_idx',
    'Repository_userId_updatedAt_idx',
  ];
  for (const n of required) console.log(`3. index ${n}: ${names.has(n) ? 'present' : 'MISSING'}`);
  const redundant = ['CodeChunk_repositoryId_idx', 'ChatMessage_repositoryId_idx', 'Repository_userId_idx'];
  for (const n of redundant) console.log(`4. redundant ${n}: ${names.has(n) ? 'STILL PRESENT' : 'dropped'}`);

  // 5. Exact call path: findUnique selects every scalar column (incl. commitSha).
  const sample = await prisma.repository.findFirst({ select: { id: true } });
  if (!sample) { console.log('5. no repository rows to exercise.'); }
  else {
    const full = await prisma.repository.findUnique({ where: { id: sample.id } });
    console.log(`5. repository.findUnique(full row) OK — commitSha=${JSON.stringify(full?.commitSha ?? null)}`);
    let rolledBack = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.repository.update({ where: { id: sample.id }, data: { commitSha: '__probe__', indexingStats: { files: 0 } } });
        throw new Error('__ROLLBACK__');
      });
    } catch (err: any) {
      if (err.message === '__ROLLBACK__') rolledBack = true; else throw err;
    }
    console.log('6. repository.update(commitSha, indexingStats) OK and rolled back:', rolledBack);
  }

  await prisma.$disconnect();
  await pgPool.end();
}

main().catch((e) => {
  console.error('Schema verification FAILED:', e);
  process.exit(1);
});
