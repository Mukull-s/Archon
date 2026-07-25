import { pipeline } from '@xenova/transformers';
import { prisma } from '../config';

class VectorService {
  private embedder: any = null;

  async init() {
    if (!this.embedder) {
      // Initialize the Xenova pipeline for feature extraction
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    await this.init();
    // Generate feature embeddings (average pooled & normalized)
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    await this.init();
    const output = await this.embedder(texts, { pooling: 'mean', normalize: true });
    const result: number[][] = [];
    const dims = 384;
    for (let i = 0; i < texts.length; i++) {
      const start = i * dims;
      const end = start + dims;
      result.push(Array.from(output.data.slice(start, end)));
    }
    return result;
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
  }
}

export const vectorService = new VectorService();
export default vectorService;
