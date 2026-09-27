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
import {
  getRepoDetails,
  deleteRepo,
  analyzeImpact,
  buildVectorIndex,
  getChatHistory,
  getRepoInsights,
  getRepoStory,
  getRepoOnboarding,
  generateRepoSummaryEndpoint,
  performVectorIndexing
} from '../src/controllers/repo.controller';
import { AppError } from '../src/utils';

async function runIdorAuthorizationTests() {
  console.log('====================================================');
  console.log('RUNNING ARCHON IDOR REPOSITORY AUTHORIZATION TESTS');
  console.log('====================================================\n');

  // Set up mock repository data
  const repoOwnerUser = 'user-owner-123';
  const attackerUser = 'user-attacker-456';
  const victimRepoId = 'repo-victim-789';

  // Mock prisma.repository.findFirst to simulate ownership
  const originalFindFirst = prisma.repository.findFirst;
  const originalFindUnique = prisma.repository.findUnique;

  // Simulate DB: repo belongs to repoOwnerUser
  (prisma.repository as any).findFirst = async (args: any) => {
    const { where } = args;
    if (where.id === victimRepoId && where.userId === repoOwnerUser) {
      return {
        id: victimRepoId,
        userId: repoOwnerUser,
        name: 'victim-repo',
        owner: 'victim-owner',
        isLocal: false,
        framework: 'Express',
        languages: ['TypeScript'],
        fileCount: 10,
        totalSize: 5000,
        confidence: 90,
        entryPoints: ['src/server.ts'],
        indexingStatus: 'completed',
        indexingProgress: '100%',
        aiSummary: null,
        scannedFiles: '[]',
        astMetadata: '{}',
        dependencyGraph: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
        reindexCount: 0
      };
    }
    // If querying by attackerUser or without matching userId, return null
    return null;
  };

  (prisma.repository as any).findUnique = async (args: any) => {
    if (args.where.id === victimRepoId) {
      return {
        id: victimRepoId,
        userId: repoOwnerUser,
        name: 'victim-repo',
        indexingStatus: 'completed',
        user: { id: repoOwnerUser }
      };
    }
    return null;
  };

  // Helper to simulate express request / response
  function createMockReqRes(userId: string | undefined, repoId: string, body: any = {}) {
    const req: any = {
      user: userId ? { userId } : undefined,
      params: { id: repoId },
      body,
      query: {}
    };
    let responseStatus: number = 200;
    let responseData: any = null;
    const res: any = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      }
    };
    let caughtError: any = null;
    const next = (err?: any) => {
      caughtError = err;
    };
    return {
      req,
      res,
      next,
      getStatus: () => responseStatus,
      getData: () => responseData,
      getError: () => caughtError
    };
  }

  try {
    // --- Test 1: getRepoDetails rejects unauthorized user ---
    console.log('-> Running Test 1: getRepoDetails rejects attacker trying to read victim repo');
    const t1 = createMockReqRes(attackerUser, victimRepoId);
    await getRepoDetails(t1.req, t1.res, t1.next);
    assert.ok(t1.getError() instanceof AppError, 'Must pass AppError to next()');
    assert.equal(t1.getError().statusCode, 404, 'Must return 404 to avoid enumeration');
    assert.equal(t1.getError().message, 'Repository not found or access denied.');
    console.log('   [PASS] Test 1: Attacker cannot access victim repo details.\n');

    // --- Test 2: deleteRepo rejects unauthorized user ---
    console.log('-> Running Test 2: deleteRepo rejects attacker trying to delete victim repo');
    const t2 = createMockReqRes(attackerUser, victimRepoId);
    await deleteRepo(t2.req, t2.res, t2.next);
    assert.ok(t2.getError() instanceof AppError);
    assert.equal(t2.getError().statusCode, 404);
    assert.equal(t2.getError().message, 'Repository not found or access denied.');
    console.log('   [PASS] Test 2: Attacker cannot delete victim repository.\n');

    // --- Test 3: analyzeImpact rejects unauthorized user ---
    console.log('-> Running Test 3: analyzeImpact rejects attacker trying to analyze victim repo');
    const t3 = createMockReqRes(attackerUser, victimRepoId, { filePath: 'src/index.ts' });
    await analyzeImpact(t3.req, t3.res, t3.next);
    assert.ok(t3.getError() instanceof AppError);
    assert.equal(t3.getError().statusCode, 404);
    assert.equal(t3.getError().message, 'Repository not found or access denied.');
    console.log('   [PASS] Test 3: Attacker cannot run impact analysis on victim repo.\n');

    // --- Test 4: buildVectorIndex rejects unauthorized user ---
    console.log('-> Running Test 4: buildVectorIndex rejects attacker trying to re-index victim repo');
    const t4 = createMockReqRes(attackerUser, victimRepoId, { force: true });
    await buildVectorIndex(t4.req, t4.res, t4.next);
    assert.ok(t4.getError() instanceof AppError);
    assert.equal(t4.getError().statusCode, 404);
    assert.equal(t4.getError().message, 'Repository not found or access denied.');
    console.log('   [PASS] Test 4: Attacker cannot trigger vector reindexing on victim repo.\n');

    // --- Test 5: getChatHistory rejects unauthorized user ---
    console.log('-> Running Test 5: getChatHistory rejects attacker trying to read chat history');
    const t5 = createMockReqRes(attackerUser, victimRepoId);
    await getChatHistory(t5.req, t5.res, t5.next);
    assert.ok(t5.getError() instanceof AppError);
    assert.equal(t5.getError().statusCode, 404);
    assert.equal(t5.getError().message, 'Repository not found or access denied.');
    console.log('   [PASS] Test 5: Attacker cannot read chat history of victim repo.\n');

    // --- Test 6: performVectorIndexing rejects unauthorized user ---
    console.log('-> Running Test 6: performVectorIndexing rejects execution if userId does not match repo owner');
    let rejectedAsExpected = false;
    try {
      await performVectorIndexing(victimRepoId, false, { userId: attackerUser });
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 404 && err.message === 'Repository not found or access denied.') {
        rejectedAsExpected = true;
      }
    }
    assert.ok(rejectedAsExpected, 'performVectorIndexing must reject mismatched userId with 404');
    console.log('   [PASS] Test 6: performVectorIndexing enforces repo owner validation.\n');

    // --- Test 7: Legitimate owner passes authorization ---
    console.log('-> Running Test 7: Legitimate owner passes getRepoDetails check');
    const t7 = createMockReqRes(repoOwnerUser, victimRepoId);
    t7.req.query.lite = 'true';
    await getRepoDetails(t7.req, t7.res, t7.next);
    assert.equal(t7.getError(), null, 'Owner must not receive error');
    assert.equal(t7.getStatus(), 200, 'Owner receives 200 OK');
    assert.equal(t7.getData().data.name, 'victim-repo');
    console.log('   [PASS] Test 7: Legitimate owner successfully accesses repository.\n');

    console.log('====================================================');
    console.log('ALL 7 IDOR AUTHORIZATION TESTS PASSED CLEANLY!');
    console.log('====================================================');
  } finally {
    // Restore mocks
    (prisma.repository as any).findFirst = originalFindFirst;
    (prisma.repository as any).findUnique = originalFindUnique;
  }
}

runIdorAuthorizationTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('IDOR Test Suite Failed:', err);
    process.exit(1);
  });
