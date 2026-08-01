import { VoyageAIClient } from 'voyageai';
import { env } from '../config';

export interface IEmbeddingService {
  getEmbedding(text: string): Promise<number[]>;
  getEmbeddingsBatch(texts: string[]): Promise<number[][]>;
  getAndResetMetrics(): { apiCalls: number; totalLatencyMs: number };
}

class EmbeddingService implements IEmbeddingService {
  private client: VoyageAIClient;
  private readonly model = 'voyage-code-3';
  private readonly dimension = 512;

  private metrics = {
    apiCalls: 0,
    totalLatencyMs: 0
  };

  constructor() {
    if (!env.VOYAGE_API_KEY) {
      throw new Error('VOYAGE_API_KEY environment variable is missing.');
    }
    
    // Initialize Voyage AI Client using official SDK
    this.client = new VoyageAIClient({ apiKey: env.VOYAGE_API_KEY });
    
    console.log(`[Embedding] Embedding Provider: Voyage`);
    console.log(`[Embedding] Model: ${this.model}`);
    console.log(`[Embedding] Dimension: ${this.dimension}`);
  }

  getAndResetMetrics() {
    const current = { ...this.metrics };
    this.metrics = { apiCalls: 0, totalLatencyMs: 0 };
    return current;
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

    // Sanitize: replace empty/whitespace-only texts to avoid API 400 errors
    const sanitized = texts.map(t => (t && t.trim().length > 0 ? t : ' '));

    // Batch limit: Voyage AI supports up to 128 inputs per request.
    const VOYAGE_MAX_BATCH_SIZE = 128;
    
    // Split texts into chunks of VOYAGE_MAX_BATCH_SIZE
    const batches: string[][] = [];
    for (let i = 0; i < sanitized.length; i += VOYAGE_MAX_BATCH_SIZE) {
      batches.push(sanitized.slice(i, i + VOYAGE_MAX_BATCH_SIZE));
    }

    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
      const embeddings = await this.getEmbeddingsBatchWithRetry(batch);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  private async getEmbeddingsBatchWithRetry(texts: string[], retries = 5, delayMs = 1000): Promise<number[][]> {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const t0 = Date.now();
      try {
        const response = await this.client.embed({
          input: texts,
          model: this.model,
          outputDimension: this.dimension
        });

        // Record metrics on success
        this.metrics.apiCalls += 1;
        this.metrics.totalLatencyMs += (Date.now() - t0);

        if (response.data) {
          // Sort by index to preserve order
          const sorted = response.data.sort((a: any, b: any) => a.index - b.index);
          return sorted.map((item: any) => item.embedding);
        }
        throw new Error('Voyage API response missing data block');
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err.status === 429 || 
                            (err.message && err.message.includes('429')) || 
                            (err.response?.status === 429) || 
                            (err.response?.data && JSON.stringify(err.response.data).includes('429'));
        
        console.warn(`[Embedding] Voyage API attempt ${attempt}/${retries} failed (${isRateLimit ? 'Rate Limited' : err.message})`);
        
        if (attempt < retries) {
          // If rate limited on the free tier (3 RPM), wait 20 seconds before retrying
          const backoff = isRateLimit 
            ? (20000 + Math.random() * 2000) 
            : (delayMs * Math.pow(2, attempt) * (0.5 + Math.random()));
          
          console.log(`[Embedding] Backing off for ${Math.round(backoff / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }
    throw lastError || new Error('Failed to generate embeddings from Voyage AI');
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;
