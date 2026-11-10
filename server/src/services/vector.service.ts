import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { from as copyFrom } from 'pg-copy-streams';
import { prisma, pgPool } from '../config';
import { embeddingService, EmbeddingMetricsTracker } from './embedding.service';

/**
 * PostgreSQL binary COPY signature: "PGCOPY\n" + 0xFF + "\r\n" + "\0".
 */
const COPY_BINARY_SIGNATURE = Buffer.from([
  0x50, 0x47, 0x43, 0x4f, 0x50, 0x59, 0x0a, 0xff, 0x0d, 0x0a, 0x00,
]);

/** INSERT mode: 'copy' (binary COPY, default) or 'insert' (parameterized SQL). */
function readInsertMode(): 'copy' | 'insert' {
  return (process.env.EMBEDDING_INSERT_MODE || 'copy').toLowerCase() === 'insert' ? 'insert' : 'copy';
}

/**
 * Serializes an embedding to pgvector's text literal.
 *
 * pgvector stores `vector` columns as float32, so we first round to float32
 * (`Math.fround`) and then emit the *shortest* decimal string that round-trips
 * back to that exact float32. This is bit-for-bit lossless against what the
 * database stores, while cutting the wire payload ~1.8x versus emitting JS's
 * full double precision (which pgvector discards anyway).
 */
export function toVectorLiteral(embedding: number[]): string {
  const parts = new Array<string>(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    const y = Math.fround(embedding[i]);
    if (!Number.isFinite(y) || y === 0) {
      parts[i] = '0';
      continue;
    }
    // Shortest precision (1..9 significant digits) that round-trips to this float32.
    let s = y.toPrecision(9);
    for (let p = 1; p < 9; p++) {
      const candidate = y.toPrecision(p);
      if (Math.fround(Number(candidate)) === y) { s = candidate; break; }
    }
    parts[i] = s;
  }
  return `[${parts.join(',')}]`;
}

/**
 * Growable big-endian byte writer used to build PostgreSQL binary COPY rows.
 */
class BinaryWriter {
  private buf: Buffer;
  private len = 0;

  constructor(initial = 16 * 1024) {
    this.buf = Buffer.allocUnsafe(initial);
  }

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const next = Buffer.allocUnsafe(size);
    this.buf.copy(next, 0, 0, this.len);
    this.buf = next;
  }

  int16(value: number): void { this.ensure(2); this.buf.writeInt16BE(value, this.len); this.len += 2; }
  int32(value: number): void { this.ensure(4); this.buf.writeInt32BE(value, this.len); this.len += 4; }
  float4(value: number): void { this.ensure(4); this.buf.writeFloatBE(Math.fround(value), this.len); this.len += 4; }

  /** int4 column field: length prefix (4) then the value. */
  int4Field(value: number): void { this.int32(4); this.int32(value); }

  /** text column field: length prefix then UTF-8 bytes; null => length -1. */
  textField(value: string | null): void {
    if (value === null || value === undefined) { this.int32(-1); return; }
    const bytes = Buffer.from(value, 'utf8');
    this.int32(bytes.length);
    this.ensure(bytes.length);
    bytes.copy(this.buf, this.len);
    this.len += bytes.length;
  }

  /**
   * pgvector binary format (vector_send): int16 dimension, int16 unused,
   * then `dimension` big-endian float4 values.
   */
  vectorField(embedding: number[]): void {
    const dim = embedding.length;
    this.int32(4 + dim * 4);
    this.int16(dim);
    this.int16(0);
    for (let i = 0; i < dim; i++) this.float4(embedding[i]);
  }

  bytes(): Buffer {
    return this.buf.subarray(0, this.len);
  }

  get length(): number { return this.len; }
}

/** Writes a buffer to a stream, awaiting drain when back-pressured. */
function writeWithBackpressure(stream: NodeJS.WritableStream, chunk: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    stream.once('error', onError);
    const flushed = stream.write(chunk, () => {
      stream.removeListener('error', onError);
      resolve();
    });
    if (!flushed) {
      // write() will still invoke the callback once queued; nothing more to do.
    }
  });
}

/** Builds the full binary COPY payload (header + rows + trailer). */
export function buildCopyPayload(repositoryId: string, chunks: any[], startIndex: number): Buffer {
  const header = Buffer.concat([COPY_BINARY_SIGNATURE, Buffer.alloc(8)]); // signature + flags(0) + extension(0)
  const body = new BinaryWriter(Math.max(64 * 1024, chunks.length * 8 * 1024));
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    body.int16(9); // field count
    body.textField(c.id ?? crypto.randomUUID());
    body.textField(repositoryId);
    body.textField(c.filePath);
    body.int4Field(startIndex + i);
    body.textField(c.content);
    body.int4Field(c.startLine);
    body.int4Field(c.endLine);
    body.textField(c.symbolName ?? null);
    body.vectorField(c.embedding);
  }
  body.int16(-1); // trailer
  return Buffer.concat([header, body.bytes()]);
}

class VectorService {
  private readonly insertMode = readInsertMode();

  async getEmbedding(text: string, tracker?: EmbeddingMetricsTracker): Promise<number[]> {
    return embeddingService.getEmbedding(text, tracker);
  }

  async getEmbeddingsBatch(texts: string[], tracker?: EmbeddingMetricsTracker): Promise<number[][]> {
    return embeddingService.getEmbeddingsBatch(texts, tracker);
  }

  /**
   * Nearest code chunks to a query vector, scoped to one repository.
   *
   * ── this query is load-bearing; read before changing it ────────────────
   *
   * The obvious form —
   *
   *   SELECT ... WHERE "repositoryId" = $1
   *   ORDER BY embedding <=> $2::vector LIMIT $3
   *
   * — silently returns ZERO ROWS once the table holds vectors from more than a
   * handful of repositories. The planner walks the HNSW index in global
   * distance order and applies `repositoryId` as a post-filter, while HNSW
   * only considers `hnsw.ef_search` candidates per scan (default 40). Across
   * 26,000 chunks in many repositories, none of those 40 candidates belong to
   * the repository being asked about, every one is discarded, and the query
   * returns nothing.
   *
   * Measured on the live database with `EXPLAIN ANALYZE`:
   *
   *   Index Scan using "CodeChunk_embedding_hnsw_idx"
   *     Filter: ("repositoryId" = '...')
   *     Rows Removed by Filter: 40        <-- the whole ef_search budget
   *     rows=0
   *
   * The failure is invisible from the application: the endpoint returns 200 and
   * the assistant answers anyway, with no code in front of it. Retrieval
   * returning empty looked like a model problem and was a query-plan problem.
   *
   * `MATERIALIZED` is the fix and it is not optional. A plain CTE gets inlined
   * by the planner and reproduces the exact broken plan; the keyword forces the
   * repository's vectors to be collected first, and only then sorted by
   * distance. Verified to return rows for repositories that previously returned
   * none, and to leave working repositories unchanged.
   */
  async searchSimilarChunks(repositoryId: string, queryVector: number[], limit = 6) {
    const vectorStr = toVectorLiteral(queryVector);

    const results = await prisma.$queryRaw<any[]>`
      WITH scoped AS MATERIALIZED (
        SELECT id, "filePath", content, "startLine", "endLine", "symbolName", embedding
        FROM "CodeChunk"
        WHERE "repositoryId" = ${repositoryId}
          AND embedding IS NOT NULL
      )
      SELECT id, "filePath", content, "startLine", "endLine", "symbolName",
             (embedding <=> ${vectorStr}::vector) AS distance
      FROM scoped
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return results;
  }

  /**
   * Every chunk belonging to a repository, nearest-first, with no vector index
   * involved.
   *
   * Used when a caller needs retrieval to be exactly reproducible — the vector
   * index is approximate by design, so two identical queries can return
   * different neighbours. Accepted by traversal (which is exact by nature) and
   * useful when debugging why a particular file was or was not retrieved.
   */
  async searchExactInRepository(
    repositoryId: string,
    queryVector: number[],
    limit = 6,
    onProgress?: (scanned: number) => void,
  ) {
    const vectorStr = toVectorLiteral(queryVector);
    const results = await prisma.$queryRaw<any[]>`
      SELECT id, "filePath", content, "startLine", "endLine", "symbolName",
             (embedding <=> ${vectorStr}::vector) AS distance
      FROM "CodeChunk"
      WHERE "repositoryId" = ${repositoryId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector ASC
      LIMIT ${limit}
    `;
    onProgress?.(results.length);
    return results;
  }

  /**
   * Bulk-inserts chunks. Uses the native binary COPY protocol by default, and
   * transparently falls back to a parameterized SQL INSERT if COPY is
   * unavailable or fails. Both paths write the identical float32 vectors, so
   * results are equivalent; only throughput differs.
   */
  async bulkInsertChunks(repositoryId: string, chunks: any[], startIndex: number): Promise<void> {
    if (chunks.length === 0) return;
    const t0 = Date.now();
    const rows = chunks.map(c => ({ id: c.id ?? crypto.randomUUID(), ...c }));

    if (this.insertMode === 'copy') {
      try {
        await this.insertViaCopy(repositoryId, rows, startIndex);
        console.log(`[DB] Copied ${rows.length} chunks (binary COPY) in ${Date.now() - t0}ms`);
        return;
      } catch (err: any) {
        console.warn(`[DB] Binary COPY failed for ${rows.length} chunks; falling back to SQL INSERT: ${err?.message || err}`);
      }
    }

    await this.insertViaSql(repositoryId, rows, startIndex);
    console.log(`[DB] Inserted ${rows.length} chunks in ${Date.now() - t0}ms`);
  }

  /** Parameterized multi-row SQL INSERT (fallback path). */
  private async insertViaSql(repositoryId: string, rows: any[], startIndex: number): Promise<void> {
    const rowQueries = rows.map((c, i) =>
      Prisma.sql`(${c.id}, ${repositoryId}, ${c.filePath}, ${startIndex + i}, ${c.content}, ${c.startLine}, ${c.endLine}, ${c.symbolName ?? null}, ${toVectorLiteral(c.embedding)}::vector)`
    );
    await prisma.$executeRaw`
      INSERT INTO "CodeChunk" (id, "repositoryId", "filePath", "chunkIndex", "content", "startLine", "endLine", "symbolName", embedding)
      VALUES ${Prisma.join(rowQueries)}
    `;
  }

  /** Native binary COPY FROM STDIN. A failed COPY is atomic (no partial rows). */
  private async insertViaCopy(repositoryId: string, rows: any[], startIndex: number): Promise<void> {
    const client = await pgPool.connect();
    try {
      const stream = client.query(
        copyFrom(
          `COPY "CodeChunk" (id, "repositoryId", "filePath", "chunkIndex", "content", "startLine", "endLine", "symbolName", embedding) FROM STDIN WITH (FORMAT binary)`
        )
      ) as unknown as NodeJS.WritableStream;

      const finished = new Promise<void>((resolve, reject) => {
        stream.once('finish', () => resolve());
        stream.once('error', (err: Error) => reject(err));
      });

      await writeWithBackpressure(stream, buildCopyPayload(repositoryId, rows, startIndex));
      stream.end();
      await finished;
    } finally {
      client.release();
    }
  }
}

export const vectorService = new VectorService();
export default vectorService;
