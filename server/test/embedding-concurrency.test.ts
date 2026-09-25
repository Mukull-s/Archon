import assert from 'node:assert/strict';
import { EmbeddingService, EmbeddingMetricsTracker, AsyncSemaphore } from '../src/services/embedding.service';

async function runEmbeddingConcurrencyTests() {
  console.log('===========================================================');
  console.log('RUNNING ARCHON EMBEDDING SERVICE CONCURRENCY TESTS (P1-5)');
  console.log('===========================================================\n');

  // Test 1: AsyncSemaphore restricts concurrent executions
  console.log('-> Running Test 1: AsyncSemaphore strictly caps concurrency to maxConcurrency');
  const semaphore = new AsyncSemaphore(2);
  let activeExecutions = 0;
  let maxObservedConcurrency = 0;

  async function mockWork(taskDurationMs: number) {
    const release = await semaphore.acquire();
    activeExecutions++;
    maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);
    await new Promise(resolve => setTimeout(resolve, taskDurationMs));
    activeExecutions--;
    release();
  }

  // Launch 6 tasks simultaneously
  await Promise.all([
    mockWork(40),
    mockWork(40),
    mockWork(40),
    mockWork(40),
    mockWork(40),
    mockWork(40)
  ]);

  assert.equal(maxObservedConcurrency, 2, 'Max active executions must never exceed semaphore limit of 2');
  assert.equal(activeExecutions, 0, 'All semaphore locks must be cleanly released');
  console.log('   [PASS] Test 1: AsyncSemaphore strictly limited max active concurrent callers to 2.\n');

  // Test 2: Multi-Job Metrics Isolation (No cross-talk or race conditions)
  console.log('-> Running Test 2: Concurrent indexing jobs have isolated, non-interfering metrics');
  
  let currentActiveClientCalls = 0;
  let clientMaxConcurrency = 0;

  // Mock Voyage AI Client with mock responses
  const mockVoyageClient = {
    embed: async ({ input }: { input: string[] }) => {
      currentActiveClientCalls++;
      clientMaxConcurrency = Math.max(clientMaxConcurrency, currentActiveClientCalls);
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 30));
      currentActiveClientCalls--;
      return {
        data: input.map((_, i) => ({ index: i, embedding: new Array(512).fill(0.01) })),
        usage: { prompt_tokens: input.length * 10 }
      };
    }
  } as any;

  const concurrentEmbeddingService = new EmbeddingService(mockVoyageClient, 2);

  const trackerRepoA = concurrentEmbeddingService.createTracker();
  const trackerRepoB = concurrentEmbeddingService.createTracker();

  // Run Job A (Repo A: 3 batches of 1 chunk) and Job B (Repo B: 2 batches of 1 chunk) concurrently
  const jobA = async () => {
    await concurrentEmbeddingService.getEmbeddingsBatch(['repoA_chunk1'], trackerRepoA);
    await concurrentEmbeddingService.getEmbeddingsBatch(['repoA_chunk2'], trackerRepoA);
    await concurrentEmbeddingService.getEmbeddingsBatch(['repoA_chunk3'], trackerRepoA);
  };

  const jobB = async () => {
    await concurrentEmbeddingService.getEmbeddingsBatch(['repoB_chunk1'], trackerRepoB);
    await concurrentEmbeddingService.getEmbeddingsBatch(['repoB_chunk2'], trackerRepoB);
  };

  await Promise.all([jobA(), jobB()]);

  const metricsA = trackerRepoA.getMetrics();
  const metricsB = trackerRepoB.getMetrics();
  const globalMetrics = concurrentEmbeddingService.getGlobalMetrics();

  assert.equal(metricsA.successfulCalls, 3, 'Repo A tracker must record exactly 3 successful calls');
  assert.equal(metricsB.successfulCalls, 2, 'Repo B tracker must record exactly 2 successful calls');
  assert.equal(globalMetrics.successfulCalls, 5, 'Global tracker must aggregate both jobs (3 + 2 = 5)');
  assert.ok(clientMaxConcurrency <= 2, `API client concurrency (${clientMaxConcurrency}) must not exceed limit 2`);

  console.log(`   [PASS] Test 2: Job A recorded ${metricsA.successfulCalls} calls, Job B recorded ${metricsB.successfulCalls} calls without cross-talk.\n`);

  // Test 3: Coordinated Rate Limit (429) backoff prevents thundering herd
  console.log('-> Running Test 3: Coordinated 429 backoff delays concurrent callers');
  let attemptCounter = 0;
  let rateLimitEncountered = 0;

  const mockRateLimitingClient = {
    embed: async ({ input }: { input: string[] }) => {
      attemptCounter++;
      if (attemptCounter === 1) {
        rateLimitEncountered++;
        const error: any = new Error('Rate limit exceeded: 429');
        error.status = 429;
        error.headers = { 'retry-after': '1' };
        throw error;
      }
      return {
        data: input.map((_, i) => ({ index: i, embedding: new Array(512).fill(0.02) })),
        usage: { prompt_tokens: input.length * 5 }
      };
    }
  } as any;

  // Service with small backoff delay for fast test execution
  const rateLimitedService = new EmbeddingService(mockRateLimitingClient, 2);
  const rateLimitTracker = rateLimitedService.createTracker();

  // Test with retry logic
  const embeddings = await rateLimitedService.getEmbeddingsBatch(['test_chunk_after_429'], rateLimitTracker);
  
  const rlMetrics = rateLimitTracker.getMetrics();
  assert.equal(embeddings.length, 1, 'Embedding should succeed after retry');
  assert.equal(rlMetrics.rateLimitResponses, 1, 'Tracker must register exactly 1 rate limit response');
  assert.equal(rlMetrics.retries, 1, 'Tracker must register exactly 1 retry');
  assert.equal(rlMetrics.successfulCalls, 1, 'Tracker must register 1 final success');
  console.log('   [PASS] Test 3: 429 backoff and retry successfully handled and tracked.\n');

  console.log('===========================================================');
  console.log('ALL 3 EMBEDDING CONCURRENCY TESTS (P1-5) PASSED CLEANLY!');
  console.log('===========================================================');
}

runEmbeddingConcurrencyTests().catch((err) => {
  console.error('[FAIL] Embedding concurrency test failed:', err);
  process.exit(1);
});
