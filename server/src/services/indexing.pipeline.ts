import { AsyncSemaphore } from './concurrency';

/**
 * Bounded, order-preserving pipeline for embedding + persistence.
 *
 * Two properties matter here:
 *
 * 1. **Bounded embedding concurrency.** Outbound Voyage requests are capped by
 *    a semaphore so we never exceed the provider's rate limits.
 *
 * 2. **Persistence is decoupled from the embedding slot.** A batch's database
 *    insert runs *after* the embedding slot is released, so while batch N is
 *    being written, batch N+1 can already be embedding. The original design
 *    held the slot across both operations, which put DB latency on the critical
 *    path and roughly doubled wall-clock time.
 *
 * Chunk indices are assigned by the caller *before* submission, so concurrent
 * inserts are order-independent.
 *
 * A batch whose embedding call fails is *quarantined* (surfaced via
 * `onEmbedError`) rather than silently dropped, so the caller can retry it
 * through a narrower path before declaring the run incomplete.
 */

export interface BatchPipelineOptions<T> {
  /** Maximum simultaneous embedding calls. */
  concurrency: number;
  /** Maximum outstanding (embedding + insert) batches before back-pressure. */
  maxOutstanding?: number;
  embed: (texts: string[]) => Promise<number[][]>;
  insert: (items: T[], embeddings: number[][], startIndex: number) => Promise<void>;
  /** Embedding failed for this batch — caller should quarantine it for retry. */
  onEmbedError?: (err: unknown, batch: PipelineBatch<T>) => void;
  /** Persistence failed for this batch — this is a terminal failure. */
  onInsertError?: (err: unknown, batch: PipelineBatch<T>) => void;
  /** A batch was embedded and fully persisted. */
  onBatchResolved?: (batch: PipelineBatch<T>) => void;
}

export interface PipelineBatch<T> {
  items: T[];
  texts: string[];
  startIndex: number;
}

export class BatchPipeline<T> {
  private readonly embedLimiter: AsyncSemaphore;
  private readonly maxOutstanding: number;
  private inFlight: Promise<void>[] = [];

  private _peakEmbedConcurrency = 0;
  private _embedMs = 0;
  private _dbMs = 0;
  private _batches = 0;
  private _embeddedItems = 0;
  private _insertedItems = 0;
  private _resolvedBatches = 0;
  private _failedBatches = 0;

  constructor(private readonly options: BatchPipelineOptions<T>) {
    this.embedLimiter = new AsyncSemaphore(options.concurrency);
    this.maxOutstanding = Math.max(1, options.maxOutstanding ?? options.concurrency + 2);
  }

  get peakEmbedConcurrency(): number { return this._peakEmbedConcurrency; }
  get embedMs(): number { return this._embedMs; }
  get dbMs(): number { return this._dbMs; }
  get batchCount(): number { return this._batches; }
  get embeddedItems(): number { return this._embeddedItems; }
  get insertedItems(): number { return this._insertedItems; }
  /** Batches that were embedded and persisted successfully. */
  get resolvedBatches(): number { return this._resolvedBatches; }
  /** Batches that terminally failed to persist. */
  get failedBatches(): number { return this._failedBatches; }

  /** Number of batches submitted but not yet fully persisted. */
  get outstanding(): number {
    return this.inFlight.length;
  }

  /**
   * Applies back-pressure: resolves once fewer than `maxOutstanding` batches
   * are pending. Call before `submit` to bound memory.
   */
  async waitForCapacity(): Promise<void> {
    while (this.inFlight.length >= this.maxOutstanding) {
      await Promise.race(this.inFlight);
    }
  }

  submit(batch: PipelineBatch<T>): void {
    this._batches += 1;

    const task = this.runBatch(batch).catch((err) => {
      // runBatch isolates its own errors, so reaching here means an unexpected
      // failure (e.g. in a callback). Surface it rather than losing the batch.
      this._failedBatches += 1;
      this.options.onInsertError?.(err, batch);
    });

    this.inFlight.push(task);
    void task.finally(() => {
      const idx = this.inFlight.indexOf(task);
      if (idx >= 0) this.inFlight.splice(idx, 1);
    });
  }

  private async runBatch(batch: PipelineBatch<T>): Promise<void> {
    const embedStart = Date.now();
    let embeddings: number[][];
    try {
      embeddings = await this.embedLimiter.run(() => {
        this._peakEmbedConcurrency = Math.max(this._peakEmbedConcurrency, this.embedLimiter.active);
        return this.options.embed(batch.texts);
      });
      this._embedMs += Date.now() - embedStart;
      this._embeddedItems += batch.items.length;
    } catch (err) {
      this._embedMs += Date.now() - embedStart;
      // Not counted as failed yet: the caller may recover this batch.
      this.options.onEmbedError?.(err, batch);
      return;
    }

    // Runs outside the embedding slot: persistence overlaps the next embed.
    const dbStart = Date.now();
    try {
      await this.options.insert(batch.items, embeddings, batch.startIndex);
      this._dbMs += Date.now() - dbStart;
      this._insertedItems += batch.items.length;
      this._resolvedBatches += 1;
      this.options.onBatchResolved?.(batch);
    } catch (err) {
      this._dbMs += Date.now() - dbStart;
      this._failedBatches += 1;
      this.options.onInsertError?.(err, batch);
    }
  }

  async drain(): Promise<void> {
    while (this.inFlight.length > 0) {
      await Promise.all(this.inFlight.slice());
    }
  }
}
