import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config';
import { embeddingService, EmbeddingMetricsTracker } from './embedding.service';

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

class VectorService {
  async getEmbedding(text: string, tracker?: EmbeddingMetricsTracker): Promise<number[]> {
    return embeddingService.getEmbedding(text, tracker);
  }

  async getEmbeddingsBatch(texts: string[], tracker?: EmbeddingMetricsTracker): Promise<number[][]> {
    return embeddingService.getEmbeddingsBatch(texts, tracker);
  }

  async searchSimilarChunks(repositoryId: string, queryVector: number[], limit = 6) {
    const vectorStr = toVectorLiteral(queryVector);

    // Query database for similar chunks using pgvector cosine distance (<=>) safely parameterized
    const results = await prisma.$queryRaw<any[]>`
      SELECT id, "filePath", "content", "startLine", "endLine", "symbolName",
             (embedding <=> ${vectorStr}::vector) as distance
      FROM "CodeChunk"
      WHERE "repositoryId" = ${repositoryId}
      ORDER BY distance ASC
      LIMIT ${limit}
    `;
    return results;
  }

  async bulkInsertChunks(repositoryId: string, chunks: any[], startIndex: number): Promise<void> {
    if (chunks.length === 0) return;
    const t0 = Date.now();

    const rowQueries = chunks.map((c, i) => {
      const chunkId = crypto.randomUUID();
      return Prisma.sql`(${chunkId}, ${repositoryId}, ${c.filePath}, ${startIndex + i}, ${c.content}, ${c.startLine}, ${c.endLine}, ${c.symbolName ?? null}, ${toVectorLiteral(c.embedding)}::vector)`;
    });

    await prisma.$executeRaw`
      INSERT INTO "CodeChunk" (id, "repositoryId", "filePath", "chunkIndex", "content", "startLine", "endLine", "symbolName", embedding)
      VALUES ${Prisma.join(rowQueries)}
    `;
    console.log(`[DB] Inserted ${chunks.length} chunks in ${Date.now() - t0}ms`);
  }
}

export const vectorService = new VectorService();
export default vectorService;
