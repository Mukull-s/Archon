import 'dotenv/config';

/**
 * Reconciles additive schema changes and proves the exact call path that
 * previously crashed (`Repository.findUnique` selecting all scalar columns, and
 * the status `update`) now works. The update is wrapped in a transaction that
 * is deliberately rolled back, so no repository data is modified.
 */
async function main() {
  const { ensureDatabaseSchema } = await import('../src/services/schema.service');
  const { prisma } = await import('../src/config');

  await ensureDatabaseSchema();

  const column = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'Repository' AND column_name = 'indexingStats'
  `;
  console.log('1. indexingStats column:', column.length ? JSON.stringify(column[0]) : 'MISSING');

  const sample = await prisma.repository.findFirst({ select: { id: true } });
  if (!sample) {
    console.log('2. No repository rows to exercise (skipping exact-path proof).');
    await prisma.$disconnect();
    return;
  }

  // This is the exact call that threw P2022: Prisma selects every scalar column.
  const full = await prisma.repository.findUnique({ where: { id: sample.id } });
  console.log(
    `2. repository.findUnique(full row) OK — indexingStats = ${JSON.stringify((full as any)?.indexingStats ?? null)}`
  );

  // The finalize/failure write path that also threw. Rolled back on purpose.
  let rolledBack = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.repository.update({
        where: { id: sample.id },
        data: { indexingStats: { files: 0, chunks: 0 }, indexingProgress: '__schema_probe__' },
      });
      throw new Error('__ROLLBACK__');
    });
  } catch (err: any) {
    if (err.message === '__ROLLBACK__') rolledBack = true;
    else throw err;
  }
  console.log('3. repository.update(indexingStats) path OK and rolled back:', rolledBack);

  const after = await prisma.repository.findUnique({ where: { id: sample.id }, select: { indexingProgress: true } });
  console.log('4. no residual write:', after?.indexingProgress !== '__schema_probe__');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Schema verification FAILED:', e);
  process.exit(1);
});
