import { prisma } from '../config';
import crypto from 'crypto';

export interface IndexingJobPayload {
  force?: boolean;
  zipPath?: string;
  isNewAnalysis?: boolean;
  /** Record a re-index entitlement even when not force-rebuilding (incremental). */
  recordReindex?: boolean;
}

export type JobHandler = (job: {
  id: string;
  repositoryId: string;
  userId: string;
  payload: IndexingJobPayload;
  attempts: number;
}) => Promise<void>;

export class QueueService {
  private workerId: string;
  private handlers: Map<string, JobHandler> = new Map();
  private isRunning: boolean = false;
  private pollTimeout: NodeJS.Timeout | null = null;
  private activeJobsCount: number = 0;
  private maxConcurrency: number = 2;
  private leaseDurationMs: number = 60_000; // 60 seconds
  private heartbeatIntervalMs: number = 15_000; // 15 seconds
  private pollIntervalMs: number = 2_000; // 2 seconds

  constructor() {
    this.workerId = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Registers a job execution handler for a specific jobType.
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  /**
   * Ensures the IndexingJob table and necessary indexes exist (self-healing DDL).
   */
  async initQueue(): Promise<void> {
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "IndexingJob" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "repositoryId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "jobType" TEXT NOT NULL DEFAULT 'VECTOR_INDEX',
          "status" TEXT NOT NULL DEFAULT 'pending',
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "maxAttempts" INTEGER NOT NULL DEFAULT 3,
          "payload" JSONB,
          "lastError" TEXT,
          "lockedAt" TIMESTAMP(3),
          "lockedBy" TEXT,
          "leaseExpiresAt" TIMESTAMP(3),
          "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "IndexingJob_status_nextRunAt_idx" ON "IndexingJob"("status", "nextRunAt")`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "IndexingJob_repositoryId_idx" ON "IndexingJob"("repositoryId")`;
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "IndexingJob_leaseExpiresAt_idx" ON "IndexingJob"("leaseExpiresAt")`;
    } catch (err: any) {
      console.warn('[Queue] Warning initializing IndexingJob table:', err.message);
    }

    // Recover any orphaned jobs from previous crashes
    await this.recoverStaleJobs();
  }

  /**
   * Idempotently enqueues an indexing job for a repository.
   * If an active job (pending or processing with valid lease) already exists, returns it without creating a duplicate.
   */
  async enqueue(
    repositoryId: string,
    userId: string,
    payload: IndexingJobPayload = {},
    jobType = 'VECTOR_INDEX'
  ): Promise<{ jobId: string; status: string; isDuplicate: boolean }> {
    // Check for existing pending or active jobs for this repository
    const existingJob = await prisma.indexingJob.findFirst({
      where: {
        repositoryId,
        status: { in: ['pending', 'processing'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingJob) {
      // Check if lease expired on an in-progress job
      const isStale =
        existingJob.status === 'processing' &&
        existingJob.leaseExpiresAt &&
        new Date(existingJob.leaseExpiresAt).getTime() < Date.now();

      if (!isStale) {
        return {
          jobId: existingJob.id,
          status: existingJob.status,
          isDuplicate: true
        };
      }

      // Mark stale job failed before re-enqueueing
      await prisma.indexingJob.update({
        where: { id: existingJob.id },
        data: {
          status: 'failed',
          lastError: 'Job lease expired and was superseded by a new request.'
        }
      });
    }

    const newJob = await prisma.indexingJob.create({
      data: {
        repositoryId,
        userId,
        jobType,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        payload: payload as any,
        nextRunAt: new Date()
      }
    });

    // Notify worker to check immediately if running
    if (this.isRunning) {
      setImmediate(() => {
        this.pollAndProcess().catch(() => {});
      });
    }

    return {
      jobId: newJob.id,
      status: newJob.status,
      isDuplicate: false
    };
  }

  /**
   * Atomically claims the next pending job ready to run using SELECT ... FOR UPDATE SKIP LOCKED.
   */
  async claimJob(workerId: string = this.workerId, leaseDurationMs: number = this.leaseDurationMs): Promise<any | null> {
    const claimedJob = await prisma.$transaction(async (tx: any) => {
      // PostgreSQL FOR UPDATE SKIP LOCKED ensures exactly 1 worker locks the row without contention
      const candidates = (await tx.$queryRaw`
        SELECT id FROM "IndexingJob"
        WHERE status = 'pending'
          AND "nextRunAt" <= NOW()
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `) as Array<{ id: string }>;

      if (!candidates || candidates.length === 0) {
        return null;
      }

      const jobId = candidates[0].id;
      const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

      const job = await tx.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'processing',
          lockedAt: new Date(),
          lockedBy: workerId,
          leaseExpiresAt,
          attempts: { increment: 1 }
        }
      });

      return job;
    });

    return claimedJob;
  }

  /**
   * Extends the heartbeat lease timestamp for an in-flight job.
   */
  async heartbeat(jobId: string, workerId: string = this.workerId, leaseDurationMs: number = this.leaseDurationMs): Promise<boolean> {
    const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);
    const result = await prisma.indexingJob.updateMany({
      where: {
        id: jobId,
        lockedBy: workerId,
        status: 'processing'
      },
      data: {
        leaseExpiresAt
      }
    });
    return result.count > 0;
  }

  /**
   * Marks a job as successfully completed.
   */
  async completeJob(jobId: string): Promise<void> {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        lockedBy: null,
        leaseExpiresAt: null,
        lastError: null
      }
    });
  }

  /**
   * Handles job failure: computes exponential backoff retry if attempts < maxAttempts,
   * or transitions to failed state and updates repository record.
   */
  async failJob(jobId: string, error: any): Promise<{ willRetry: boolean; nextRunAt?: Date }> {
    const job = await prisma.indexingJob.findUnique({ where: { id: jobId } });
    if (!job) return { willRetry: false };

    const errorMessage = error?.message || String(error);

    // Deterministic client errors (404 not found, 400 bad request, …) can never
    // succeed on retry — only 408 (timeout) and 429 (rate limit) are worth
    // re-attempting. This prevents e.g. a bad repository URL from being fetched
    // three times.
    const statusCode: number | undefined = error?.statusCode ?? error?.response?.status;
    const isDeterministicClientError =
      typeof statusCode === 'number' &&
      statusCode >= 400 &&
      statusCode < 500 &&
      statusCode !== 408 &&
      statusCode !== 429;

    if (job.attempts < job.maxAttempts && !isDeterministicClientError) {
      // Exponential backoff: 2s, 4s, 8s (capped at 60s)
      const delayMs = Math.min(60_000, 2000 * Math.pow(2, job.attempts - 1));
      const nextRunAt = new Date(Date.now() + delayMs);

      await prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'pending',
          lockedBy: null,
          leaseExpiresAt: null,
          nextRunAt,
          lastError: errorMessage
        }
      });

      // Update repo progress to inform user of retry
      await prisma.repository.update({
        where: { id: job.repositoryId },
        data: {
          indexingProgress: `Indexing attempt ${job.attempts} failed (${errorMessage}). Retrying in ${(delayMs / 1000).toFixed(0)}s...`
        }
      }).catch(() => {});

      console.warn(`[Queue] Job ${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}). Retrying in ${delayMs}ms.`);
      return { willRetry: true, nextRunAt };
    }

    // Exhausted retries: mark as failed
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        lockedBy: null,
        leaseExpiresAt: null,
        lastError: errorMessage
      }
    });

    // Mark repository status failed
    await prisma.repository.update({
      where: { id: job.repositoryId },
      data: {
        indexingStatus: 'failed',
        indexingProgress: `Error: ${errorMessage}`
      }
    }).catch(() => {});

    console.error(`[Queue] Job ${jobId} permanently failed after ${job.attempts} attempts. Error:`, errorMessage);
    return { willRetry: false };
  }

  /**
   * Detects orphaned jobs left by crashed worker processes (where lease has expired).
   * Requeues if under maxAttempts, otherwise marks failed.
   */
  async recoverStaleJobs(): Promise<number> {
    try {
      const now = new Date();
      const staleJobs = await prisma.indexingJob.findMany({
        where: {
          status: 'processing',
          leaseExpiresAt: { lt: now }
        }
      });

      if (staleJobs.length === 0) return 0;

      console.log(`[Queue] Found ${staleJobs.length} stale job(s) from crashed or expired workers. Recovering...`);

      for (const job of staleJobs) {
        if (job.attempts < job.maxAttempts) {
          await prisma.indexingJob.update({
            where: { id: job.id },
            data: {
              status: 'pending',
              lockedBy: null,
              leaseExpiresAt: null,
              nextRunAt: now,
              lastError: 'Worker lease expired; recovered for retry.'
            }
          });
          console.log(`[Queue] Requeued stale job ${job.id} for repo ${job.repositoryId}`);
        } else {
          await prisma.indexingJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              lockedBy: null,
              leaseExpiresAt: null,
              lastError: 'Job lease expired and exceeded max retry attempts.'
            }
          });
          await prisma.repository.update({
            where: { id: job.repositoryId },
            data: {
              indexingStatus: 'failed',
              indexingProgress: 'Error: Indexing worker process stopped responding.'
            }
          }).catch(() => {});
        }
      }

      return staleJobs.length;
    } catch (err: any) {
      console.error('[Queue] Error in recoverStaleJobs:', err.message);
      return 0;
    }
  }

  /**
   * Starts the background queue worker.
   */
  startWorker(options?: {
    concurrency?: number;
    pollIntervalMs?: number;
    leaseDurationMs?: number;
  }): void {
    if (this.isRunning) return;
    this.isRunning = true;
    if (options?.concurrency) this.maxConcurrency = options.concurrency;
    if (options?.pollIntervalMs) this.pollIntervalMs = options.pollIntervalMs;
    if (options?.leaseDurationMs) this.leaseDurationMs = options.leaseDurationMs;

    console.log(`[Queue] Background worker started [id: ${this.workerId}, concurrency: ${this.maxConcurrency}]`);
    this.scheduleNextPoll(0);
  }

  /**
   * Gracefully stops the queue worker.
   */
  async stopWorker(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    // Wait up to 5 seconds for in-flight jobs to finish
    const start = Date.now();
    while (this.activeJobsCount > 0 && Date.now() - start < 5000) {
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`[Queue] Background worker stopped.`);
  }

  private scheduleNextPoll(delayMs: number = this.pollIntervalMs): void {
    if (!this.isRunning) return;
    if (this.pollTimeout) clearTimeout(this.pollTimeout);
    this.pollTimeout = setTimeout(() => {
      this.pollAndProcess();
    }, delayMs);
  }

  /**
   * Worker loop: claims available jobs and processes them with heartbeats.
   */
  private async pollAndProcess(): Promise<void> {
    if (!this.isRunning) return;

    if (this.activeJobsCount >= this.maxConcurrency) {
      this.scheduleNextPoll();
      return;
    }

    try {
      // Periodically recover stale jobs
      await this.recoverStaleJobs();

      const job = await this.claimJob();
      if (!job) {
        // No jobs available; sleep until next poll
        this.scheduleNextPoll();
        return;
      }

      // Execute job in background
      this.activeJobsCount++;
      this.processJob(job).finally(() => {
        this.activeJobsCount--;
        // Immediately look for more work
        if (this.isRunning) {
          setImmediate(() => this.pollAndProcess());
        }
      });

      // If concurrency allows, immediately attempt to claim another job
      if (this.activeJobsCount < this.maxConcurrency) {
        setImmediate(() => this.pollAndProcess());
      }
    } catch (err: any) {
      console.error('[Queue] Error polling for jobs:', err.message);
      this.scheduleNextPoll();
    }
  }

  private async processJob(job: any): Promise<void> {
    const handler = this.handlers.get(job.jobType);
    if (!handler) {
      console.error(`[Queue] No handler registered for jobType "${job.jobType}". Failing job ${job.id}.`);
      await this.failJob(job.id, new Error(`Unrecognized jobType: ${job.jobType}`));
      return;
    }

    // Start heartbeat interval
    const heartbeatTimer = setInterval(async () => {
      try {
        await this.heartbeat(job.id);
      } catch (hbErr: any) {
        console.warn(`[Queue] Heartbeat failed for job ${job.id}:`, hbErr.message);
      }
    }, this.heartbeatIntervalMs);

    try {
      console.log(`[Queue] Processing job ${job.id} (repo: ${job.repositoryId}, attempt ${job.attempts}/${job.maxAttempts})...`);
      const payload: IndexingJobPayload =
        typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload || {};

      await handler({
        id: job.id,
        repositoryId: job.repositoryId,
        userId: job.userId,
        payload,
        attempts: job.attempts
      });

      await this.completeJob(job.id);
      console.log(`[Queue] ✅ Job ${job.id} completed successfully.`);
    } catch (jobErr: any) {
      console.error(`[Queue] ❌ Job ${job.id} execution failed:`, jobErr.message);
      await this.failJob(job.id, jobErr);
    } finally {
      clearInterval(heartbeatTimer);
    }
  }
}

export const queueService = new QueueService();
export default queueService;
