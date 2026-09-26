import { VoyageAIClient } from 'voyageai';
import { env } from '../config';
import { AsyncSemaphore } from './concurrency';
import {
  TokenBatchOptions,
  buildTokenAwareBatches,
  clampInputChars,
  classifyEmbeddingError,
  estimateTokens,
  readBatchOptionsFromEnv,
  readPositiveIntEnv
} from './embedding.batching';

// Re-exported for backward compatibility; the implementation lives in concurrency.ts.
export { AsyncSemaphore } from './concurrency';

// Hard ceiling for a single outbound embedding request. The Voyage SDK also
// enforces its own timeout, but we pass an AbortSignal so a hung socket can
// never pin a worker indefinitely.
const EMBEDDING_REQUEST_TIMEOUT_MS = readPositiveIntEnv('EMBEDDING_REQUEST_TIMEOUT_MS', 30_000);

export interface EmbeddingMetrics {
  successfulCalls: number;
  failedCalls: number;
  retries: number;
  rateLimitResponses: number;
  timeoutResponses: number;
  totalBackoffMs: number;
  totalLatencyMs: number;
}

export class EmbeddingMetricsTracker {
  private metrics: EmbeddingMetrics = {
    successfulCalls: 0,
    failedCalls: 0,
    retries: 0,
    rateLimitResponses: 0,
    timeoutResponses: 0,
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

  recordTimeout() {
    this.metrics.timeoutResponses += 1;
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
      timeoutResponses: 0,
      totalBackoffMs: 0,
      totalLatencyMs: 0
    };
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
  private readonly baseConcurrency: number;
  private successStreak = 0;
  private backoffUntil = 0;
  private readonly batchOptions: TokenBatchOptions = readBatchOptionsFromEnv();

  constructor(clientOverride?: VoyageAIClient, maxConcurrency = 3) {
    if (clientOverride) {
      this.client = clientOverride;
    } else {
      if (!env.VOYAGE_API_KEY) {
        throw new Error('VOYAGE_API_KEY environment variable is missing.');
      }
      // Initialize Voyage AI Client using official SDK.
      // maxRetries: 0 — retries are owned entirely by this service so backoff
      // and fail-fast semantics are deterministic and observable.
      this.client = new VoyageAIClient({
        apiKey: env.VOYAGE_API_KEY,
        maxRetries: 0,
        timeoutInSeconds: Math.ceil(EMBEDDING_REQUEST_TIMEOUT_MS / 1000)
      });
    }

    const concurrency = readPositiveIntEnv('VOYAGE_MAX_CONCURRENCY', maxConcurrency);
    this.baseConcurrency = concurrency;
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

    // Clamp pathological inputs so no single chunk can blow the token budget.
    const clamped = sanitized.map(t => clampInputChars(t, this.batchOptions.maxCharsPerInput));
    const truncatedCount = clamped.reduce((acc, c) => acc + (c.truncated ? 1 : 0), 0);
    if (truncatedCount > 0) {
      console.warn(
        `[Embedding] Clamped ${truncatedCount} oversized input(s) to ${this.batchOptions.maxCharsPerInput} chars.`
      );
    }

    // Token-aware batching: pack inputs so each request stays within both the
    // provider's token ceiling and the input-count ceiling.
    const prepared = clamped.map(c => c.text);
    const batches = buildTokenAwareBatches(prepared, this.batchOptions);
    const estimatedTokens = prepared.reduce((acc, t) => acc + estimateTokens(t), 0);
    console.log(
      `[Embedding] Voyage token-aware pipeline. Chunks: ${sanitized.length} | Batches: ${batches.length} | Est tokens: ${estimatedTokens} | Budget/request: ${this.batchOptions.maxTokensPerRequest} tokens, ${this.batchOptions.maxInputsPerRequest} inputs`
    );

    const allEmbeddings: number[][] = [];
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const batchTokens = batch.reduce((acc, t) => acc + estimateTokens(t), 0);
      console.log(
        `[Embedding] Processing Batch ${batchIdx + 1}/${batches.length} containing ${batch.length} chunks (~${batchTokens} est tokens).`
      );

      const embeddings = await this.embedBatchWithSplitRecovery(batch, {
        totalBatches: batches.length,
        currentBatchIdx: batchIdx + 1,
        tracker
      });
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  /**
   * Runs one token-budgeted batch. If the provider still rejects it as too
   * large (e.g. our estimate under-counted), split it in half and retry
   * instead of failing the whole repository. A single-input batch that is
   * rejected propagates the error so the orchestrator can degrade gracefully.
   */
  private async embedBatchWithSplitRecovery(
    batch: string[],
    ctx: { totalBatches: number; currentBatchIdx: number; tracker?: EmbeddingMetricsTracker }
  ): Promise<number[][]> {
    try {
      return await this.getEmbeddingsBatchWithRetry(
        batch,
        ctx.totalBatches,
        ctx.currentBatchIdx,
        ctx.tracker
      );
    } catch (err: any) {
      const info = classifyEmbeddingError(err);
      if (info.isTooLarge && batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        console.warn(
          `[Embedding] Batch ${ctx.currentBatchIdx}/${ctx.totalBatches} rejected as too large (${batch.length} inputs, reason: ${info.reason}). Splitting into ${mid} + ${batch.length - mid} and retrying.`
        );
        const left = await this.embedBatchWithSplitRecovery(batch.slice(0, mid), ctx);
        const right = await this.embedBatchWithSplitRecovery(batch.slice(mid), ctx);
        return [...left, ...right];
      }
      throw err;
    }
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

        const response = await this.client.embed(
          {
            input: texts,
            model: this.model,
            outputDimension: this.dimension
          },
          // Hard abort so a stalled socket cannot pin a worker forever.
          { abortSignal: AbortSignal.timeout(EMBEDDING_REQUEST_TIMEOUT_MS), maxRetries: 0 }
        );

        // Record metrics on success
        const latency = Date.now() - t0;
        this.globalTracker.recordSuccess(latency);
        tracker?.recordSuccess(latency);

        // Adaptive throttle: restore full concurrency after a healthy streak.
        this.successStreak++;
        if (this.successStreak >= 5 && this.semaphore.maxConcurrency < this.baseConcurrency) {
          this.semaphore.setMaxConcurrency(this.baseConcurrency);
          this.successStreak = 0;
          console.log(`[Embedding] Restoring outbound concurrency to ${this.baseConcurrency} after sustained success.`);
        }

        const usage = response.usage as any;
        const promptTokens = usage?.prompt_tokens || usage?.promptTokens || usage?.totalTokens || Math.round(texts.reduce((acc, t) => acc + t.length, 0) / 4);
        console.log(`[Embedding] Batch ${currentBatchIdx}/${totalBatches} completed. Inputs: ${texts.length} | ServerTokens: ${promptTokens} | Latency: ${latency}ms | Attempt: ${attempt}`);

        if (response.data) {
          // Sort by index to preserve order
          const sorted = response.data.sort((a: any, b: any) => a.index - b.index);
          return sorted.map((item: any) => item.embedding);
        }
        throw new Error('Voyage API response missing data block');
      } catch (err: any) {
        lastError = err;
        const info = classifyEmbeddingError(err);
        const isTimeout =
          err?.name === 'VoyageAITimeoutError' ||
          err?.name === 'TimeoutError' ||
          err?.name === 'AbortError' ||
          /timed out|timeout|aborted/i.test(err?.message || '');

        if (info.isRateLimit) {
          this.globalTracker.recordRateLimit();
          tracker?.recordRateLimit();
          this.successStreak = 0;
          // Adaptive throttle: halve outbound concurrency on 429.
          const reduced = Math.max(1, Math.floor(this.semaphore.maxConcurrency / 2));
          if (reduced < this.semaphore.maxConcurrency) {
            this.semaphore.setMaxConcurrency(reduced);
            console.warn(`[Embedding] Rate limited: reducing outbound concurrency to ${reduced}.`);
          }
        }
        if (isTimeout && !info.isRateLimit) {
          this.globalTracker.recordTimeout();
          tracker?.recordTimeout();
        }
        console.warn(
          `[Embedding] Voyage API attempt ${attempt}/${retries} failed. Reason: ${info.reason} | Status: ${info.statusCode ?? 'unknown'} | Error: ${err?.message}`
        );

        // Extract error payload details for the free-tier heuristic
        const errorBody = err.body ?? err.response?.data ?? err.data ?? '';
        const errorString = typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody);
        const isFreeTierMessage =
          errorString.includes('You have not yet added your payment method') ||
          errorString.includes('reduced rate limits');

        // Fail-fast if on a restricted free tier (3 RPM) and the repository requires multiple batches
        if (info.isRateLimit && isFreeTierMessage && totalBatches > 3) {
          console.error(`[Embedding] Rate limits are too low on this unpaid Voyage AI account to realistically index a repository of this size (requires ${totalBatches} batches). Aborting early to save time.`);
          this.globalTracker.recordFailure();
          tracker?.recordFailure();
          throw new Error('Voyage AI free tier rate limit (3 RPM) is too low for this repository. Please add a billing method in the Voyage AI console (it remains free up to 200M tokens) to increase rate limits.');
        }

        // Deterministic 4xx (too-large / invalid request) must never be retried:
        // it can never succeed and the retry loop would just burn wall-clock.
        if (!info.retryable) {
          console.error(
            `[Embedding] Non-retryable embedding error (${info.reason}, status ${info.statusCode ?? 'n/a'}) on batch ${currentBatchIdx}/${totalBatches}. Failing fast without retry.`
          );
          this.globalTracker.recordFailure();
          tracker?.recordFailure();
          throw err;
        }

        if (attempt < retries) {
          // Respect provider's Retry-After header if present, but cap it so a
          // huge header value cannot stall the whole job.
          const retryAfterHeader = err.headers?.['retry-after'] || err.response?.headers?.['retry-after'];
          let retryAfterMs = 0;
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(String(retryAfterHeader), 10);
            if (!isNaN(parsedSeconds)) {
              retryAfterMs = parsedSeconds * 1000;
              console.log(`[Embedding] Respecting provider's Retry-After header (${parsedSeconds}s, capped at 8s).`);
            }
          }

          let backoff: number;
          if (info.isRateLimit) {
            // Bounded rate-limit backoff: min(Retry-After, 8s) + jitter.
            backoff = Math.min(retryAfterMs || 8_000, 8_000) + Math.random() * 2_000;
          } else if (retryAfterMs > 0) {
            backoff = Math.min(retryAfterMs, 8_000) + Math.random() * 2_000;
          } else {
            // Exponential backoff with jitter, capped at 15s.
            backoff = Math.min(delayMs * Math.pow(2, attempt) * (0.5 + Math.random()), 15_000);
          }

          // Coordinate cool-down across all concurrent callers
          if (info.isRateLimit) {
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
