/**
 * Small concurrency primitives shared by the indexing pipeline.
 *
 * `AsyncSemaphore` bounds how many async tasks may run at once. `active` and
 * `waiting` are exposed so the orchestrator can log real concurrency instead of
 * guessing. Pure and dependency-free for straightforward unit testing.
 */

export class AsyncSemaphore {
  private activeCount = 0;
  private queue: (() => void)[] = [];
  private max: number;

  constructor(maxConcurrency: number) {
    if (!Number.isFinite(maxConcurrency) || maxConcurrency < 1) {
      throw new Error(`AsyncSemaphore requires maxConcurrency >= 1 (received ${maxConcurrency})`);
    }
    this.max = Math.floor(maxConcurrency);
  }

  get maxConcurrency(): number {
    return this.max;
  }

  /**
   * Resizes the concurrency ceiling at runtime. Raising it immediately admits
   * queued waiters; lowering it lets in-flight tasks finish naturally.
   */
  setMaxConcurrency(next: number): void {
    if (!Number.isFinite(next)) return;
    this.max = Math.max(1, Math.floor(next));
    while (this.activeCount < this.max && this.queue.length > 0) {
      this.activeCount++;
      const admit = this.queue.shift()!;
      admit();
    }
  }

  async acquire(): Promise<() => void> {
    if (this.activeCount < this.max) {
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

  /**
   * Runs `task` once a slot is free, releasing the slot when it settles.
   * The returned promise resolves/rejects with the task's result.
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }
}
