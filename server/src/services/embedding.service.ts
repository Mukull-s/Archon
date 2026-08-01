import { VoyageAIClient } from 'voyageai';
import { env } from '../config';

export interface EmbeddingMetrics {
  successfulCalls: number;
  failedCalls: number;
  retries: number;
  rateLimitResponses: number;
  totalBackoffMs: number;
  totalLatencyMs: number;
}

export interface IEmbeddingService {
  getEmbedding(text: string): Promise<number[]>;
  getEmbeddingsBatch(texts: string[]): Promise<number[][]>;
  getAndResetMetrics(): EmbeddingMetrics;
}

class EmbeddingService implements IEmbeddingService {
  private client: VoyageAIClient;
  private readonly model = 'voyage-code-3';
  private readonly dimension = 512;

  private metrics: EmbeddingMetrics = {
    successfulCalls: 0,
    failedCalls: 0,
    retries: 0,
    rateLimitResponses: 0,
    totalBackoffMs: 0,
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

  getAndResetMetrics(): EmbeddingMetrics {
    const current = { ...this.metrics };
    this.metrics = {
      successfulCalls: 0,
      failedCalls: 0,
      retries: 0,
      rateLimitResponses: 0,
      totalBackoffMs: 0,
      totalLatencyMs: 0
    };
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
    console.log(`[Embedding] Starting Voyage AI embedding pipeline. Total Chunks: ${sanitized.length} | Batches: ${batches.length}`);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`[Embedding] Processing Batch ${batchIdx + 1}/${batches.length} containing ${batch.length} chunks.`);
      
      const embeddings = await this.getEmbeddingsBatchWithRetry(batch, batches.length, batchIdx + 1);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  private async getEmbeddingsBatchWithRetry(
    texts: string[],
    totalBatches: number,
    currentBatchIdx: number,
    retries = 5,
    delayMs = 1000
  ): Promise<number[][]> {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (attempt > 1) {
        this.metrics.retries += 1;
      }
      const t0 = Date.now();
      try {
        const response = await this.client.embed({
          input: texts,
          model: this.model,
          outputDimension: this.dimension
        });

        // Record metrics on success
        this.metrics.successfulCalls += 1;
        this.metrics.totalLatencyMs += (Date.now() - t0);

        const usage = response.usage as any;
        const promptTokens = usage?.prompt_tokens || usage?.promptTokens || usage?.totalTokens || Math.round(texts.reduce((acc, t) => acc + t.length, 0) / 4);
        console.log(`[Embedding] Batch ${currentBatchIdx}/${totalBatches} completed successfully. Chunks: ${texts.length} | Tokens: ${promptTokens} | Latency: ${Date.now() - t0}ms`);

        if (response.data) {
          // Sort by index to preserve order
          const sorted = response.data.sort((a: any, b: any) => a.index - b.index);
          return sorted.map((item: any) => item.embedding);
        }
        throw new Error('Voyage API response missing data block');
      } catch (err: any) {
        lastError = err;
        const statusCode = err.status || err.response?.status;
        const isRateLimit = statusCode === 429 || 
                            (err.message && err.message.includes('429')) || 
                            (err.response?.data && JSON.stringify(err.response.data).includes('429'));
        
        if (isRateLimit) {
          this.metrics.rateLimitResponses += 1;
        }
        console.warn(`[Embedding] Voyage API attempt ${attempt}/${retries} failed. Status: ${statusCode || 'unknown'} | Error: ${err.message}`);

        // Extract error payload details
        const errorBody = err.response?.data || err.data || '';
        const errorString = typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody);
        
        // Fail-fast if on a restricted free tier (3 RPM) and the repository requires multiple batches
        const isFreeTierMessage = errorString.includes('You have not yet added your payment method') || 
                                  errorString.includes('reduced rate limits');
        
        if (isRateLimit && isFreeTierMessage && totalBatches > 3) {
          console.error(`[Embedding] Rate limits are too low on this unpaid Voyage AI account to realistically index a repository of this size (requires ${totalBatches} batches). Aborting early to save time.`);
          throw new Error('Voyage AI free tier rate limit (3 RPM) is too low for this repository. Please add a billing method in the Voyage AI console (it remains free up to 200M tokens) to increase rate limits.');
        }

        if (attempt < retries) {
          // Respect provider's Retry-After header if present
          const retryAfterHeader = err.headers?.['retry-after'] || err.response?.headers?.['retry-after'];
          let backoff = 0;
          
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds)) {
              backoff = parsedSeconds * 1000;
              console.log(`[Embedding] Respecting provider's Retry-After header. Waiting ${parsedSeconds}s...`);
            }
          }
          
          if (backoff === 0) {
            // Default 20-second backoff for 429 rate limits, otherwise exponential backoff with jitter
            backoff = isRateLimit 
              ? (20000 + Math.random() * 2000) 
              : (delayMs * Math.pow(2, attempt) * (0.5 + Math.random()));
          }
          
          this.metrics.totalBackoffMs += backoff;
          console.log(`[Embedding] Backing off for ${Math.round(backoff / 1000)}s (Total backoff: ${Math.round(this.metrics.totalBackoffMs / 1000)}s)...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }
    
    this.metrics.failedCalls += 1;
    throw lastError || new Error('Failed to generate embeddings from Voyage AI');
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;
