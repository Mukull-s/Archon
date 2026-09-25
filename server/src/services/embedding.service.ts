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

export class EmbeddingMetricsTracker {
  private metrics: EmbeddingMetrics = {
    successfulCalls: 0,
    failedCalls: 0,
    retries: 0,
    rateLimitResponses: 0,
    totalBackoffMs: 0,
    totalLatencyMs: 0
  };

  recordSuccess(latencyMs: number) {
    this.metrics.successfulCalls += 1;
    this.metrics.totalLatencyMs += latencyMs;
  }

  recordFailure() {
    this.metrics.failedCalls += 1;
  }

  recordRetry() {
    this.metrics.retries += 1;
  }

  recordRateLimit() {
    this.metrics.rateLimitResponses += 1;
  }

  recordBackoff(ms: number) {
    this.metrics.totalBackoffMs += ms;
  }

  getMetrics(): EmbeddingMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      successfulCalls: 0,
      failedCalls: 0,
      retries: 0,
      rateLimitResponses: 0,
      totalBackoffMs: 0,
      totalLatencyMs: 0
    };
  }
}

export class AsyncSemaphore {
  private activeCount = 0;
  private queue: (() => void)[] = [];

  constructor(public readonly maxConcurrency: number) {}

  async acquire(): Promise<() => void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  private release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.activeCount--;
    }
  }

  get active(): number {
    return this.activeCount;
  }

  get waiting(): number {
    return this.queue.length;
  }
}

export interface IEmbeddingService {
  getEmbedding(text: string, tracker?: EmbeddingMetricsTracker): Promise<number[]>;
  getEmbeddingsBatch(texts: string[], tracker?: EmbeddingMetricsTracker): Promise<number[][]>;
  createTracker(): EmbeddingMetricsTracker;
  getAndResetMetrics(): EmbeddingMetrics;
  getGlobalMetrics(): EmbeddingMetrics;
}

export class EmbeddingService implements IEmbeddingService {
  private client: VoyageAIClient;
  private readonly model = 'voyage-code-3';
  private readonly dimension = 512;
  private globalTracker = new EmbeddingMetricsTracker();
  private semaphore: AsyncSemaphore;
  private backoffUntil = 0;

  constructor(clientOverride?: VoyageAIClient, maxConcurrency = 2) {
    if (clientOverride) {
      this.client = clientOverride;
    } else {
      if (!env.VOYAGE_API_KEY) {
        throw new Error('VOYAGE_API_KEY environment variable is missing.');
      }
      // Initialize Voyage AI Client using official SDK
      this.client = new VoyageAIClient({ apiKey: env.VOYAGE_API_KEY });
    }

    const envConcurrency = parseInt(process.env.VOYAGE_MAX_CONCURRENCY || '', 10);
    const concurrency = !isNaN(envConcurrency) && envConcurrency > 0 ? envConcurrency : maxConcurrency;
    this.semaphore = new AsyncSemaphore(concurrency);

    console.log(`[Embedding] Embedding Provider: Voyage | Concurrency Limit: ${concurrency}`);
    console.log(`[Embedding] Model: ${this.model}`);
    console.log(`[Embedding] Dimension: ${this.dimension}`);
  }

  createTracker(): EmbeddingMetricsTracker {
    return new EmbeddingMetricsTracker();
  }

  getGlobalMetrics(): EmbeddingMetrics {
    return this.globalTracker.getMetrics();
  }

  getAndResetMetrics(): EmbeddingMetrics {
    const current = this.globalTracker.getMetrics();
    this.globalTracker.reset();
    return current;
  }

  async getEmbedding(text: string, tracker?: EmbeddingMetricsTracker): Promise<number[]> {
    const results = await this.getEmbeddingsBatch([text], tracker);
    if (results.length === 0) {
      throw new Error('Failed to generate embedding');
    }
    return results[0];
  }

  async getEmbeddingsBatch(texts: string[], tracker?: EmbeddingMetricsTracker): Promise<number[][]> {
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
      
      const embeddings = await this.getEmbeddingsBatchWithRetry(batch, batches.length, batchIdx + 1, tracker);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  private async getEmbeddingsBatchWithRetry(
    texts: string[],
    totalBatches: number,
    currentBatchIdx: number,
    tracker?: EmbeddingMetricsTracker,
    retries = 5,
    delayMs = 1000
  ): Promise<number[][]> {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (attempt > 1) {
        this.globalTracker.recordRetry();
        tracker?.recordRetry();
      }

      // Acquire semaphore slot to enforce max concurrent outbound requests
      const release = await this.semaphore.acquire();
      const t0 = Date.now();
      try {
        // Respect coordinated rate limit cool-down window across all concurrent jobs
        const now = Date.now();
        if (this.backoffUntil > now) {
          const waitMs = this.backoffUntil - now;
          console.log(`[Embedding] Coordinated rate limit cool-down active. Waiting ${Math.round(waitMs / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }

        const response = await this.client.embed({
          input: texts,
          model: this.model,
          outputDimension: this.dimension
        });

        // Record metrics on success
        const latency = Date.now() - t0;
        this.globalTracker.recordSuccess(latency);
        tracker?.recordSuccess(latency);

        const usage = response.usage as any;
        const promptTokens = usage?.prompt_tokens || usage?.promptTokens || usage?.totalTokens || Math.round(texts.reduce((acc, t) => acc + t.length, 0) / 4);
        console.log(`[Embedding] Batch ${currentBatchIdx}/${totalBatches} completed successfully. Chunks: ${texts.length} | Tokens: ${promptTokens} | Latency: ${latency}ms`);

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
          this.globalTracker.recordRateLimit();
          tracker?.recordRateLimit();
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
          
          // Coordinate cool-down across all concurrent callers
          if (isRateLimit) {
            this.backoffUntil = Math.max(this.backoffUntil, Date.now() + backoff);
          }

          this.globalTracker.recordBackoff(backoff);
          tracker?.recordBackoff(backoff);

          console.log(`[Embedding] Backing off for ${Math.round(backoff / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      } finally {
        release();
      }
    }
    
    this.globalTracker.recordFailure();
    tracker?.recordFailure();
    throw lastError || new Error('Failed to generate embeddings from Voyage AI');
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;
