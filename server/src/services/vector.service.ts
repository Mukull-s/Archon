import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config';
import { embeddingService } from './embedding.service';

class VectorService {
  async getEmbedding(text: string): Promise<number[]> {
    return embeddingService.getEmbedding(text);
  }

  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    return embeddingService.getEmbeddingsBatch(texts);
  }

  async searchSimilarChunks(repositoryId: string, queryVector: number[], limit = 6) {
    const vectorStr = `[${queryVector.join(',')}]`;

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
      const vectorStr = `[${c.embedding.join(',')}]`;
      return Prisma.sql`(${chunkId}, ${repositoryId}, ${c.filePath}, ${startIndex + i}, ${c.content}, ${c.startLine}, ${c.endLine}, ${c.symbolName ?? null}, ${vectorStr}::vector)`;
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
