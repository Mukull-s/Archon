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
