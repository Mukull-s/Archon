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
import { prisma } from '../src/config/index';
import { EntitlementService } from '../src/services/entitlement.service';
import { AppError } from '../src/utils/AppError';

async function runEntitlementConcurrencyTests() {
  console.log('====================================================');
  console.log('RUNNING ARCHON ENTITLEMENT CONCURRENCY & QUOTA TESTS');
  console.log('====================================================\n');

  // Create an isolated instance of EntitlementService for testing
  const entitlementService = new EntitlementService();

  // Test state simulation to model atomic DB behavior
  let simulatedDbUser = {
    id: 'test-user-concurrency',
    email: 'test@archon.ai',
    plan: 'free',
    lifetimeAnalysesUsed: 0,
    monthlyAiQuestionsUsed: 49, // 1 remaining out of 50
    monthlyReindexesUsed: 0,
    createdAt: new Date(),
    repositories: []
  };

  // Mock getUserUsageAndLimits to use simulated state
  (entitlementService as any).getUserUsageAndLimits = async (userId: string) => {
    return {
      plan: simulatedDbUser.plan as any,
      limits: {
        maxCodebases: 1,
        lifetimeAnalyses: 3,
        monthlyAiQuestions: 50,
        monthlyReindexes: 2,
        advancedAnalysis: false,
        maxFilesPerRepo: 500,
        maxRepoSizeBytes: 10 * 1024 * 1024,
        displayName: 'Free'
      },
      usage: {
        activeCodebases: 0,
        lifetimeAnalysesUsed: simulatedDbUser.lifetimeAnalysesUsed,
        monthlyAiQuestionsUsed: simulatedDbUser.monthlyAiQuestionsUsed,
        monthlyReindexesUsed: simulatedDbUser.monthlyReindexesUsed
      },
      remaining: {
        codebases: 1,
        lifetimeAnalyses: 3 - simulatedDbUser.lifetimeAnalysesUsed,
        monthlyAiQuestions: 50 - simulatedDbUser.monthlyAiQuestionsUsed,
        monthlyReindexes: 2 - simulatedDbUser.monthlyReindexesUsed
      }
    };
  };

  // Mock prisma.user.updateMany to simulate PostgreSQL atomic UPDATE ... WHERE condition
  // In Postgres, row-level locks serialize concurrent updates.
  let isUpdating = false;
  (prisma.user as any).updateMany = async (args: any) => {
    const { where, data } = args;

    // Simulate concurrency serialization
    while (isUpdating) {
      await new Promise(r => setTimeout(r, 1));
    }
    isUpdating = true;
    try {
      if (data?.monthlyAiQuestionsUsed?.increment) {
        const ltLimit = where?.monthlyAiQuestionsUsed?.lt;
        if (ltLimit === undefined || simulatedDbUser.monthlyAiQuestionsUsed < ltLimit) {
          simulatedDbUser.monthlyAiQuestionsUsed += 1;
          return { count: 1 };
        }
        return { count: 0 };
      }

      if (data?.monthlyAiQuestionsUsed?.decrement) {
        const gtLimit = where?.monthlyAiQuestionsUsed?.gt ?? 0;
        if (simulatedDbUser.monthlyAiQuestionsUsed > gtLimit) {
          simulatedDbUser.monthlyAiQuestionsUsed -= 1;
          return { count: 1 };
        }
        return { count: 0 };
      }

      return { count: 0 };
    } finally {
      isUpdating = false;
    }
  };

  // --- Scenario 1: 1 remaining -> 1 request = allowed ---
  console.log('-> Running Test 1: Single request with 1 remaining quota');
  simulatedDbUser.monthlyAiQuestionsUsed = 49; // 1 remaining out of 50
  let test1Error = null;
  try {
    await entitlementService.recordAiQuestion('test-user-concurrency');
  } catch (err) {
    test1Error = err;
  }
  assert.equal(test1Error, null, 'Single request with 1 remaining must succeed');
  assert.equal(simulatedDbUser.monthlyAiQuestionsUsed, 50, 'Usage count should have reached 50');
  console.log('   [PASS] Test 1: 1 remaining -> 1 request successfully allowed & recorded.\n');

  // --- Scenario 2: 0 remaining -> request = rejected ---
  console.log('-> Running Test 2: Request with 0 remaining quota (already at limit)');
  let test2Rejected = false;
  let test2ErrorCode = '';
  try {
    await entitlementService.recordAiQuestion('test-user-concurrency');
  } catch (err: any) {
    test2Rejected = true;
    test2ErrorCode = err.code || '';
  }
  assert.equal(test2Rejected, true, 'Request with 0 quota remaining must be rejected');
  assert.equal(test2ErrorCode, 'AI_LIMIT_REACHED', 'Should throw AI_LIMIT_REACHED');
  assert.equal(simulatedDbUser.monthlyAiQuestionsUsed, 50, 'Usage count must not exceed 50');
  console.log('   [PASS] Test 2: 0 remaining -> request rejected with AI_LIMIT_REACHED.\n');

  // --- Scenario 3: 1 remaining -> 2 concurrent requests = exactly 1 allowed ---
  console.log('-> Running Test 3: 2 concurrent requests with only 1 remaining quota');
  simulatedDbUser.monthlyAiQuestionsUsed = 49; // reset to 1 remaining

  // Launch two concurrent recordAiQuestion requests simultaneously
  const results = await Promise.allSettled([
    entitlementService.recordAiQuestion('test-user-concurrency'),
    entitlementService.recordAiQuestion('test-user-concurrency')
  ]);

  const fulfilledCount = results.filter(r => r.status === 'fulfilled').length;
  const rejectedCount = results.filter(r => r.status === 'rejected').length;

  assert.equal(fulfilledCount, 1, 'Exactly 1 concurrent request must succeed');
  assert.equal(rejectedCount, 1, 'Exactly 1 concurrent request must be rejected');
  assert.equal(simulatedDbUser.monthlyAiQuestionsUsed, 50, 'Final usage must not exceed limit of 50');

  const rejectedResult = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal((rejectedResult.reason as AppError).code, 'AI_LIMIT_REACHED', 'Rejected request must have AI_LIMIT_REACHED');
  console.log('   [PASS] Test 3: 1 remaining -> 2 concurrent requests: exactly 1 allowed, 1 rejected.\n');

  // --- Scenario 4: Quota refund allows a subsequent request ---
  console.log('-> Running Test 4: Quota refund rollback');
  // Currently at 50 (0 remaining)
  await entitlementService.refundAiQuestion('test-user-concurrency');
  assert.equal(simulatedDbUser.monthlyAiQuestionsUsed, 49, 'Usage should be decremented to 49 after refund');

  let test4Error = null;
  try {
    await entitlementService.recordAiQuestion('test-user-concurrency');
  } catch (err) {
    test4Error = err;
  }
  assert.equal(test4Error, null, 'Request after refund must succeed');
  assert.equal(simulatedDbUser.monthlyAiQuestionsUsed, 50, 'Usage should return to 50');
  console.log('   [PASS] Test 4: Refund successfully restored 1 slot and allowed subsequent request.\n');

  console.log('====================================================');
  console.log('ALL 4 ENTITLEMENT CONCURRENCY TESTS PASSED!');
  console.log('====================================================');
}

runEntitlementConcurrencyTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
