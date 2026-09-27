import assert from 'node:assert/strict';
import express, { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../src/routes/repo.routes';

async function runRateLimitingTests() {
  console.log('====================================================');
  console.log('RUNNING ARCHON USER-BASED RATE LIMITING TESTS (P1-7)');
  console.log('====================================================\n');

  // Test 1: userOrIpKeyGenerator distinguishes users vs fallback to IP
  console.log('-> Running Test 1: userOrIpKeyGenerator keys on userId when authenticated');
  const authenticatedReq = {
    user: { userId: 'usr_enterprise_99', email: 'dev@company.com', provider: 'github' },
    ip: '198.51.100.1'
  } as any;

  const authKey = userOrIpKeyGenerator(authenticatedReq);
  assert.equal(authKey, 'user:usr_enterprise_99', 'Key generator must key on userId for authenticated users');
  console.log('   [PASS] Test 1: Authenticated request keyed by userId.\n');

  console.log('-> Running Test 2: userOrIpKeyGenerator falls back to normalized IP when unauthenticated');
  const unauthenticatedReq = {
    user: undefined,
    ip: '198.51.100.1',
    headers: {}
  } as any;

  const ipKey = userOrIpKeyGenerator(unauthenticatedReq);
  assert.ok(ipKey && ipKey.length > 0, 'Key generator must produce valid IP key');
  assert.notEqual(ipKey, authKey, 'IP key must differ from user key');
  console.log(`   [PASS] Test 2: Unauthenticated request fell back to IP (${ipKey}).\n`);

  console.log('-> Running Test 3: Two distinct users sharing the SAME IP have isolated rate limit buckets');
  // Build a test express app with a low rate limit (max 3 requests)
  const app = express();
  const testLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    keyGenerator: userOrIpKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit reached' }
  });

  app.get('/test-endpoint', testLimiter, (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Simulated in-memory dispatch helper
  const simulateRequest = async (userId: string, sharedIp: string) => {
    return new Promise<{ status: number; body?: any }>((resolve) => {
      const mockReq = {
        method: 'GET',
        url: '/test-endpoint',
        path: '/test-endpoint',
        ip: sharedIp,
        headers: { 'x-forwarded-for': sharedIp },
        user: { userId }
      } as any;

      let statusCode = 200;
      const mockRes = {
        setHeader: () => {},
        getHeader: () => undefined,
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        send: (body: any) => resolve({ status: statusCode, body }),
        json: (body: any) => resolve({ status: statusCode, body })
      } as any;

      testLimiter(mockReq, mockRes, () => {
        resolve({ status: 200, body: { status: 'ok' } });
      });
    });
  };

  const sharedCorporateIp = '203.0.113.50';

  // User A makes 3 requests (hits limit)
  for (let i = 1; i <= 3; i++) {
    const res = await simulateRequest('user_Alice', sharedCorporateIp);
    assert.equal(res.status, 200, `Alice request ${i} should succeed`);
  }

  // User A makes 4th request -> throttled with 429
  const aliceThrottled = await simulateRequest('user_Alice', sharedCorporateIp);
  assert.equal(aliceThrottled.status, 429, 'Alice should be throttled after exceeding limit');
  console.log('   [PASS] Alice successfully throttled after 3 requests.');

  // User B makes request from the EXACT SAME IP -> should succeed with 200 OK!
  const bobFirstRequest = await simulateRequest('user_Bob', sharedCorporateIp);
  assert.equal(bobFirstRequest.status, 200, 'Bob should NOT be throttled by Alice even on identical IP/NAT');
  console.log('   [PASS] Bob on the same corporate NAT/IP is unaffected and succeeds with 200 OK.\n');

  console.log('====================================================');
  console.log('ALL 3 USER RATE LIMITING TESTS (P1-7) PASSED CLEANLY!');
  console.log('====================================================');
}

runRateLimitingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Rate limiting test failed:', err);
    process.exit(1);
  });
