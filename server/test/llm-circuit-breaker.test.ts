import assert from 'node:assert/strict';
import { llmService, ModelCircuitBreaker } from '../src/services/llm.service';

async function runCircuitBreakerTests() {
  console.log('===========================================================');
  console.log('RUNNING ARCHON LLM CIRCUIT BREAKER & FALLBACK TESTS (P1-6)');
  console.log('===========================================================\n');

  // Test 1: Fallback Queue Includes Paid Fallback Model
  console.log('-> Running Test 1: Fallback queue contains configured paid fallback model');
  const queue = llmService.getModelsQueue('cohere/north-mini-code:free');
  assert.ok(queue.length >= 2, 'Fallback queue must have multiple models');
  assert.equal(queue[0], 'cohere/north-mini-code:free', 'Requested model must be first in queue');

  const hasPaidFallback = queue.some(m => m.includes('deepseek') || m.includes('gpt') || m.includes('claude'));
  assert.ok(hasPaidFallback, 'Queue must contain a paid or tier-1 fallback model');
  console.log(`   [PASS] Test 1: Queue generated with ${queue.length} models including paid fallback.\n`);

  // Test 2: Circuit Breaker Trips Open After Consecutive Failures
  console.log('-> Running Test 2: Circuit breaker trips OPEN after 2 failures and excludes model');
  const testBreaker = new ModelCircuitBreaker(2, 60000); // 2 failures, 60s cooldown

  const targetModel = 'unstable-free-model:free';
  assert.equal(testBreaker.isAvailable(targetModel), true, 'Model should initially be available');

  testBreaker.recordFailure(targetModel, new Error('503 Service Unavailable'));
  assert.equal(testBreaker.isAvailable(targetModel), true, 'Model should remain available after 1 failure');

  testBreaker.recordFailure(targetModel, new Error('503 Service Unavailable'));
  assert.equal(testBreaker.isAvailable(targetModel), false, 'Model must trip OPEN after 2 failures');
  assert.ok(testBreaker.getTrippedModels().includes(targetModel), 'Target model must appear in tripped list');
  console.log('   [PASS] Test 2: Circuit breaker tripped OPEN after 2 consecutive failures.\n');

  // Test 3: LLMService Filters Out Tripped Models
  console.log('-> Running Test 3: LLMService.getModelsQueue skips tripped models');
  llmService.circuitBreaker.reset();
  const trippedFreeModel = 'poolside/laguna-s-2.1:free';

  // Trip poolside
  llmService.circuitBreaker.trip(trippedFreeModel, 60000);
  const filteredQueue = llmService.getModelsQueue('cohere/north-mini-code:free');

  assert.ok(!filteredQueue.includes(trippedFreeModel), 'Tripped model must be skipped from fallback queue');
  console.log('   [PASS] Test 3: Tripped model was automatically excluded from models queue.\n');

  // Test 4: Success Clears Circuit Breaker State
  console.log('-> Running Test 4: Successful call clears failure history and restores model');
  llmService.circuitBreaker.recordSuccess(trippedFreeModel);
  const restoredQueue = llmService.getModelsQueue('cohere/north-mini-code:free');

  assert.ok(restoredQueue.includes(trippedFreeModel), 'Model must be restored to queue after success');
  assert.equal(llmService.circuitBreaker.isAvailable(trippedFreeModel), true, 'Model must be available');
  console.log('   [PASS] Test 4: Model circuit breaker successfully closed upon successful response.\n');

  // Test 5: Fallback Safety When All Models Are Tripped
  console.log('-> Running Test 5: Queue gracefully falls back to base list if all models are tripped');
  const isolatedBreakerService = Object.create(llmService);
  const strictBreaker = new ModelCircuitBreaker(1, 60000);

  // Trip all known models
  for (const m of queue) {
    strictBreaker.trip(m, 60000);
  }

  // Replace circuit breaker temporarily
  (llmService as any).circuitBreaker = strictBreaker;
  const emergencyQueue = llmService.getModelsQueue('cohere/north-mini-code:free');

  assert.ok(emergencyQueue.length > 0, 'Emergency fallback must not be empty even if all models tripped');
  llmService.circuitBreaker.reset();
  console.log('   [PASS] Test 5: Safe emergency fallback preserved.\n');

  console.log('===========================================================');
  console.log('ALL 5 LLM CIRCUIT BREAKER TESTS (P1-6) PASSED CLEANLY!');
  console.log('===========================================================');
}

runCircuitBreakerTests().catch((err) => {
  console.error('[FAIL] LLM Circuit Breaker test failed:', err);
  process.exit(1);
});
