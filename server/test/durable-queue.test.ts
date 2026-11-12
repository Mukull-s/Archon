import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/archon_test';
process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'test_client_id';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'test_client_secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_long_enough_12345';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test_resend_api_key';
process.env.VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || 'test_voyage_api_key';
process.env.GITHUB_TOKEN_ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || 'test_encryption_key_32_bytes_long!!';

import assert from 'node:assert/strict';
import { prisma } from '../src/config';
import { QueueService } from '../src/services/queue.service';

async function runDurableQueueTests() {
  console.log('====================================================');
  console.log('RUNNING ARCHON DURABLE POSTGRESQL QUEUE TESTS');
  console.log('====================================================\n');

  // In-memory mock DB store to model transactional PostgreSQL table behavior
  const jobsDb: Map<string, any> = new Map();
  const reposDb: Map<string, any> = new Map();

  // Seed sample repository
  reposDb.set('repo-alpha', {
    id: 'repo-alpha',
    userId: 'user-alice',
    indexingStatus: 'idle',
    indexingProgress: ''
  });

  const originalIndexingJob = prisma.indexingJob;
  const originalRepository = prisma.repository;
  const originalTransaction = prisma.$transaction;
  const originalExecuteRaw = prisma.$executeRaw;

  // Mock prisma.repository
  (prisma as any).repository = {
    update: async ({ where, data }: any) => {
      const r = reposDb.get(where.id);
      if (r) {
        Object.assign(r, data);
        return r;
      }
      return null;
    }
  };

  // Mock prisma.indexingJob
  (prisma as any).indexingJob = {
    findFirst: async ({ where }: any) => {
      for (const job of jobsDb.values()) {
        if (where.repositoryId && job.repositoryId !== where.repositoryId) continue;
        if (where.userId && job.userId !== where.userId) continue;
        if (where.status?.in && !where.status.in.includes(job.status)) continue;
        return job;
      }
      return null;
    },
    findUnique: async ({ where }: any) => {
      return jobsDb.get(where.id) || null;
    },
    findMany: async ({ where }: any) => {
      const results: any[] = [];
      for (const job of jobsDb.values()) {
        if (where.status && job.status !== where.status) continue;
        if (where.leaseExpiresAt?.lt) {
          if (!job.leaseExpiresAt || new Date(job.leaseExpiresAt).getTime() >= where.leaseExpiresAt.lt.getTime()) {
            continue;
          }
        }
        results.push(job);
      }
      return results;
    },
    create: async ({ data }: any) => {
      const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newJob = {
        id,
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      jobsDb.set(id, newJob);
      return newJob;
    },
    update: async ({ where, data }: any) => {
      const job = jobsDb.get(where.id);
      if (!job) throw new Error(`Job not found: ${where.id}`);
      if (data.attempts?.increment) {
        job.attempts = (job.attempts || 0) + data.attempts.increment;
        delete data.attempts;
      }
      Object.assign(job, data, { updatedAt: new Date() });
      return job;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const job of jobsDb.values()) {
        if (where.id && job.id !== where.id) continue;
        if (where.lockedBy && job.lockedBy !== where.lockedBy) continue;
        if (where.status && job.status !== where.status) continue;
        Object.assign(job, data, { updatedAt: new Date() });
        count++;
      }
      return { count };
    }
  };

  // Mock prisma.$transaction to simulate FOR UPDATE SKIP LOCKED
  (prisma as any).$transaction = async (fn: any) => {
    const tx = {
      $queryRaw: async (strings: any, ...values: any[]) => {
        // Return first pending job ready to run
        const now = Date.now();
        for (const job of jobsDb.values()) {
          if (job.status === 'pending') {
            const nextRun = job.nextRunAt ? new Date(job.nextRunAt).getTime() : 0;
            if (nextRun <= now) {
              return [{ id: job.id }];
            }
          }
        }
        return [];
      },
      indexingJob: (prisma as any).indexingJob
    };
    return await fn(tx);
  };

  (prisma as any).$executeRaw = async () => 1;

  const queue = new QueueService();

  try {
    // --- Test 1: Enqueue Job & Verify Persistence ---
    console.log('-> Running Test 1: Enqueue job idempotently into PostgreSQL queue');
    const res1 = await queue.enqueue('repo-alpha', 'user-alice', { force: true, isNewAnalysis: true });
    assert.ok(res1.jobId, 'Job ID must be returned');
    assert.equal(res1.status, 'pending');
    assert.equal(res1.isDuplicate, false);

    const stored = jobsDb.get(res1.jobId);
    assert.ok(stored, 'Job must exist in DB store');
    assert.equal(stored.repositoryId, 'repo-alpha');
    assert.equal(stored.userId, 'user-alice');
    assert.equal(stored.attempts, 0);
    console.log('   [PASS] Test 1: Indexing job successfully enqueued with pending status.\n');

    // --- Test 2: Idempotency Check (Duplicate Enqueueing) ---
    console.log('-> Running Test 2: Verify duplicate enqueue returns existing active job');
    const res2 = await queue.enqueue('repo-alpha', 'user-alice', { force: false });
    assert.equal(res2.jobId, res1.jobId, 'Must return same job ID');
    assert.equal(res2.isDuplicate, true, 'isDuplicate flag must be true');
    console.log('   [PASS] Test 2: Idempotent queueing prevented duplicate job creation.\n');

    // --- Test 2b: Cross-user dedup isolation ---
    console.log('-> Running Test 2b: Dedup is scoped per user (no cross-user suppression)');
    const resCross = await queue.enqueue('repo-alpha', 'user-bob', { force: false });
    assert.notEqual(resCross.jobId, res1.jobId, 'Different user must NOT be deduped against another user\u2019s job');
    assert.equal(resCross.isDuplicate, false, 'Cross-user enqueue must create a distinct job');
    assert.equal(jobsDb.get(resCross.jobId)?.userId, 'user-bob', 'New job belongs to the requesting user');
    console.log('   [PASS] Test 2b: Cross-user enqueue created an isolated job (no leak/suppression).\n');

    // Clean up the extra job so later claim tests target res1 deterministically.
    jobsDb.delete(resCross.jobId);

    // --- Test 3: Transactional Claiming with SKIP LOCKED ---
    console.log('-> Running Test 3: Claim job atomically using FOR UPDATE SKIP LOCKED');
    const claimed = await queue.claimJob('worker-node-1', 30000);
    assert.ok(claimed, 'Job must be successfully claimed');
    assert.equal(claimed.id, res1.jobId);
    assert.equal(claimed.status, 'processing');
    assert.equal(claimed.lockedBy, 'worker-node-1');
    assert.equal(claimed.attempts, 1);
    assert.ok(claimed.leaseExpiresAt, 'Lease expiration must be populated');

    // Second worker attempting to claim receives null
    const claimedSecond = await queue.claimJob('worker-node-2', 30000);
    assert.equal(claimedSecond, null, 'Second worker must receive null (no available unlocked jobs)');
    console.log('   [PASS] Test 3: Job claimed atomically with worker lease and lock isolation.\n');

    // --- Test 4: Heartbeat Lease Extension ---
    console.log('-> Running Test 4: Extend lease expiration via periodic heartbeat');
    const oldLease = claimed.leaseExpiresAt.getTime();
    await new Promise(r => setTimeout(r, 20));
    const hbSuccess = await queue.heartbeat(claimed.id, 'worker-node-1', 45000);
    assert.equal(hbSuccess, true, 'Heartbeat must succeed for owning worker');
    const updatedJob = jobsDb.get(claimed.id);
    assert.ok(updatedJob.leaseExpiresAt.getTime() > oldLease, 'Lease expiration must be extended forward');
    console.log('   [PASS] Test 4: Heartbeat extended job lease successfully.\n');

    // --- Test 5: Exponential Backoff Retry on Failure ---
    console.log('-> Running Test 5: Exponential backoff retry when attempts < maxAttempts');
    const failRes1 = await queue.failJob(claimed.id, new Error('Temporary GitHub rate limit 429'));
    assert.equal(failRes1.willRetry, true, 'Job must be marked for retry');
    assert.ok(failRes1.nextRunAt, 'Next run timestamp must be scheduled');
    const retryingJob = jobsDb.get(claimed.id);
    assert.equal(retryingJob.status, 'pending', 'Status resets to pending for next retry attempt');
    assert.equal(retryingJob.lockedBy, null, 'Lock must be released');
    assert.ok(reposDb.get('repo-alpha').indexingProgress.includes('Retrying'), 'Repo progress shows retry details');
    console.log('   [PASS] Test 5: Failure scheduled retry with exponential backoff and updated repo status.\n');

    // --- Test 6: Terminal Failure when Max Attempts Exceeded ---
    console.log('-> Running Test 6: Terminal failure after exhausting maxAttempts');
    // Set attempts to maxAttempts (3)
    retryingJob.attempts = 3;
    const failRes2 = await queue.failJob(claimed.id, new Error('Unrecoverable parsing syntax error'));
    assert.equal(failRes2.willRetry, false, 'No more retries after reaching maxAttempts');
    const failedJob = jobsDb.get(claimed.id);
    assert.equal(failedJob.status, 'failed');
    assert.equal(reposDb.get('repo-alpha').indexingStatus, 'failed');
    assert.ok(reposDb.get('repo-alpha').indexingProgress.includes('Unrecoverable'), 'Repo records user-visible error');
    console.log('   [PASS] Test 6: Permanent failure marked in DB and repository status updated.\n');

    // --- Test 7: Crash Recovery of Orphaned Jobs ---
    console.log('-> Running Test 7: Detect and recover orphaned jobs from crashed workers');
    // Create an orphaned job whose lease expired 10 seconds ago
    const orphanId = 'job-crashed-worker';
    jobsDb.set(orphanId, {
      id: orphanId,
      repositoryId: 'repo-alpha',
      userId: 'user-alice',
      status: 'processing',
      attempts: 1,
      maxAttempts: 3,
      lockedBy: 'worker-dead-pid-9999',
      leaseExpiresAt: new Date(Date.now() - 10000), // expired
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const recoveredCount = await queue.recoverStaleJobs();
    assert.equal(recoveredCount, 1, 'Must recover exactly 1 orphaned job');
    const recoveredJob = jobsDb.get(orphanId);
    assert.equal(recoveredJob.status, 'pending', 'Orphaned job recovered back to pending');
    assert.equal(recoveredJob.lockedBy, null, 'Stale lock cleared');
    console.log('   [PASS] Test 7: Stale job recovered automatically upon crash detection.\n');

    // --- Test 8: Complete Job Cleanly on Success ---
    console.log('-> Running Test 8: Complete job successfully');
    await queue.completeJob(orphanId);
    assert.equal(jobsDb.get(orphanId).status, 'completed');
    assert.equal(jobsDb.get(orphanId).lockedBy, null);
    assert.equal(jobsDb.get(orphanId).leaseExpiresAt, null);
    console.log('   [PASS] Test 8: Completed job updated cleanly in database.\n');

    console.log('====================================================');
    console.log('ALL 9 DURABLE QUEUE TESTS PASSED CLEANLY!');
    console.log('====================================================');
  } finally {
    // Restore mocks
    prisma.indexingJob = originalIndexingJob;
    prisma.repository = originalRepository;
    prisma.$transaction = originalTransaction;
    prisma.$executeRaw = originalExecuteRaw;
  }
}

runDurableQueueTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Queue Test Suite Failed:', err);
    process.exit(1);
  });
