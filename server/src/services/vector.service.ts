import { pipeline } from '@xenova/transformers';
import { prisma } from '../config';
import axios from 'axios';

class VectorService {
  private embedder: any = null;

  async init() {
    if (!this.embedder) {
      // Initialize the Xenova pipeline for feature extraction
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    const results = await this.getEmbeddingsBatch([text]);
    if (results.length === 0) {
      throw new Error('Failed to generate embedding');
    }
    return results[0];
  }

  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // 1. Try Gemini API
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log(`[Embeddings] Generating batch of ${texts.length} using Gemini API...`);
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`;
        
        const requests = texts.map(text => ({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
          outputDimensionality: 384
        }));

        const response = await axios.post(url, { requests }, { timeout: 15000 });
        if (response.data?.embeddings) {
          return response.data.embeddings.map((e: any) => e.values);
        }
      } catch (err: any) {
        console.warn(`[Embeddings] Gemini API failed, trying fallback:`, err.message);
      }
    }

    // 2. Try OpenRouter Embeddings API
    if (process.env.OPENROUTER_API_KEY) {
      try {
        console.log(`[Embeddings] Generating batch of ${texts.length} using OpenRouter API...`);
        const apiKey = process.env.OPENROUTER_API_KEY;
        const url = 'https://openrouter.ai/api/v1/embeddings';

        const response = await axios.post(url, {
          model: 'openai/text-embedding-3-small',
          input: texts,
          dimensions: 384
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        if (response.data?.data) {
          // Sort by index to preserve order
          const sorted = response.data.data.sort((a: any, b: any) => a.index - b.index);
          return sorted.map((item: any) => item.embedding);
        }
      } catch (err: any) {
        console.warn(`[Embeddings] OpenRouter API failed, trying fallback:`, err.message);
      }
    }

    // 3. Fallback to Local ONNX model (CPU-bound, memory intensive)
    if (process.env.RENDER === 'true' || process.env.NODE_ENV === 'production') {
      throw new Error('All remote embedding APIs (Gemini, OpenRouter) failed or are unconfigured. Local ONNX model fallback is disabled in production/Render to prevent server out-of-memory crashes. Please set a valid GEMINI_API_KEY or OPENROUTER_API_KEY in your environment.');
    }

    console.log(`[Embeddings] No API keys available or APIs failed. Falling back to local ONNX model...`);
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
