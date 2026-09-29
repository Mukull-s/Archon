import 'dotenv/config';

/**
 * Proves the Phase 0 indexes are actually usable by the planner.
 *
 * Small tables can make PostgreSQL prefer a sequential scan even when a usable
 * index exists, so when the default plan is a seq scan the check is repeated
 * with `enable_seqscan = off` (in a rolled-back transaction) to confirm the
 * index is a valid plan the planner can choose. Read-only.
 */
async function main() {
  const { pgPool } = await import('../src/config');

  async function planOf(sql: string, params: any[], seqscanOff = false): Promise<string> {
    if (seqscanOff) await pgPool.query('BEGIN');
    try {
      if (seqscanOff) await pgPool.query('SET LOCAL enable_seqscan = off');
      const res = await pgPool.query(`EXPLAIN ${sql}`, params);
      return res.rows.map((r: any) => r['QUERY PLAN']).join('\n');
    } finally {
      if (seqscanOff) await pgPool.query('ROLLBACK');
    }
  }

  async function check(label: string, indexName: string, sql: string, params: any[] = []) {
    const def = await planOf(sql, params, false);
    const usedByDefault = def.includes(indexName);
    let usable = usedByDefault;
    let forced = '';
    if (!usedByDefault) {
      forced = await planOf(sql, params, true);
      usable = forced.includes(indexName);
    }
    console.log(`\n=== ${label} ===`);
    console.log(`  index: ${indexName}`);
    console.log(`  used by default : ${usedByDefault ? 'YES' : 'no (seq scan is cheaper on a small table)'}`);
    console.log(`  usable by planner: ${usable ? 'YES' : 'NO'}`);
    const source = usedByDefault ? def : forced;
    const line = source.split('\n').find(l => l.includes(indexName)) ?? '(no index line)';
    console.log(`  plan:${line.trim()}`);
    return { usedByDefault, usable };
  }

  const vec = '[' + Array.from({ length: 512 }, (_, i) => ((i % 7) - 3) / 9).join(',') + ']';
  const miss = '00000000-0000-0000-0000-000000000000';

  const results = [
    await check(
      'HNSW cosine search',
      'CodeChunk_embedding_hnsw_idx',
      `SELECT id FROM "CodeChunk" ORDER BY embedding <=> $1::vector LIMIT 6`,
      [vec]
    ),
    await check(
      'Chunk invalidation by repo + file',
      'CodeChunk_repositoryId_filePath_idx',
      `SELECT id FROM "CodeChunk" WHERE "repositoryId" = $1 AND "filePath" IN ($2)`,
      [miss, 'src/index.ts']
    ),
    await check(
      'Chat history by repo, newest first',
      'ChatMessage_repositoryId_createdAt_idx',
      `SELECT id FROM "ChatMessage" WHERE "repositoryId" = $1 ORDER BY "createdAt" DESC LIMIT 8`,
      [miss]
    ),
    await check(
      'User repositories, most recent first',
      'Repository_userId_updatedAt_idx',
      `SELECT id FROM "Repository" WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 20`,
      [miss]
    ),
    await check(
      'Incremental progress stage update',
      'Repository_pkey',
      `UPDATE "Repository" SET "indexingProgress" = 'x' WHERE id = $1`,
      [miss]
    ),
  ];

  const allUsable = results.every(r => r.usable);
  console.log(`\nRESULT: ${allUsable ? '✅ all indexes usable' : '❌ some indexes unusable'}`);
  await pgPool.end();
  process.exit(allUsable ? 0 : 1);
}
main().catch(e => { console.error('explain failed:', e.message); process.exit(1); });
