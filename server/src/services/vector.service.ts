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

    // Query Neon database for similar chunks using pgvector cosine distance (<=>)
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "filePath", "content", "startLine", "endLine", "symbolName",
              (embedding <=> $1::vector) as distance
       FROM "CodeChunk"
       WHERE "repositoryId" = $2
       ORDER BY distance ASC
       LIMIT $3`,
      vectorStr,
      repositoryId,
      limit
    );
    return results;
  }

  async bulkInsertChunks(repositoryId: string, chunks: any[], startIndex: number): Promise<void> {
    if (chunks.length === 0) return;
    const t0 = Date.now();
    const valuesSql: string[] = [];
    const params: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const vectorStr = `[${c.embedding.join(',')}]`;
      const chunkId = require('crypto').randomUUID();
      const baseIdx = i * 9;

      valuesSql.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}::vector)`);

      params.push(
        chunkId,
        repositoryId,
        c.filePath,
        startIndex + i,
        c.content,
        c.startLine,
        c.endLine,
        c.symbolName,
        vectorStr
      );
    }

    const query = `INSERT INTO "CodeChunk" (id, "repositoryId", "filePath", "chunkIndex", "content", "startLine", "endLine", "symbolName", embedding) VALUES ${valuesSql.join(', ')}`;
    await prisma.$executeRawUnsafe(query, ...params);
    console.log(`[DB] Inserted ${chunks.length} chunks in ${Date.now() - t0}ms`);
  }
}

export const vectorService = new VectorService();
export default vectorService;
