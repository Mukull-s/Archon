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
import { encryptToken, decryptToken, getPlaintextToken, isEncryptedToken } from '../src/utils/crypto';
import { authService } from '../src/services/auth.service';

async function runAuthSecurityTests() {
  console.log('====================================================');
  console.log('RUNNING ARCHON AUTH & TOKEN SECURITY TESTS');
  console.log('====================================================\n');

  // --- Test 1: JWT Payload Excludes githubToken ---
  console.log('-> Running Test 1: Verify JWT payload excludes githubToken');
  const token = authService.generateJWT('user-123', 'user@test.com', 'github');
  const payload = authService.verifyJWT(token);

  assert.equal(payload.userId, 'user-123');
  assert.equal(payload.email, 'user@test.com');
  assert.equal(payload.provider, 'github');
  assert.equal((payload as any).githubToken, undefined, 'JWT payload MUST NOT include githubToken');
  console.log('   [PASS] Test 1: JWT payload contains no sensitive OAuth token.\n');

  // --- Test 2: AES-256-GCM Token Encryption ---
  console.log('-> Running Test 2: Encrypt GitHub OAuth token at rest');
  const rawToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
  const encrypted = encryptToken(rawToken);

  assert.notEqual(encrypted, rawToken, 'Encrypted token must differ from raw token');
  assert.equal(encrypted.includes('gho_'), false, 'Ciphertext must not leak token prefix');
  assert.equal(isEncryptedToken(encrypted), true, 'isEncryptedToken returns true for encrypted token');
  console.log('   [PASS] Test 2: GitHub token encrypted using AES-256-GCM.\n');

  // --- Test 3: Token Decryption ---
  console.log('-> Running Test 3: Decrypt encrypted token');
  const decrypted = decryptToken(encrypted);
  assert.equal(decrypted, rawToken, 'Decrypted token must match original plaintext');
  console.log('   [PASS] Test 3: Token decrypted cleanly back to original token.\n');

  // --- Test 4: Legacy Plaintext Token Graceful Handling ---
  console.log('-> Running Test 4: Backward compatibility with legacy plaintext tokens');
  const legacyToken = 'gho_legacyPlaintextToken1234567890';
  const resolvedLegacy = getPlaintextToken(legacyToken);
  assert.equal(resolvedLegacy, legacyToken, 'getPlaintextToken returns legacy plaintext token as-is');

  const resolvedEncrypted = getPlaintextToken(encrypted);
  assert.equal(resolvedEncrypted, rawToken, 'getPlaintextToken decrypts encrypted token');

  assert.equal(getPlaintextToken(null), null, 'null token returns null');
  assert.equal(getPlaintextToken(undefined), null, 'undefined token returns null');
  console.log('   [PASS] Test 4: Backward compatibility verified for legacy and null tokens.\n');

  // --- Test 5: GitHub OAuth scope is least-privilege ---
  console.log('-> Running Test 5: GitHub OAuth URL requests minimal scope (no `repo`)');
  process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'test_client_id';
  const ghUrl = authService.getGitHubAuthUrl('nonce-123');
  const ghScope = new URL(ghUrl).searchParams.get('scope') || '';
  assert.equal(ghScope, 'read:user user:email', 'GitHub OAuth scope must be read:user user:email');
  assert.equal(/\brepo\b/.test(ghScope), false, 'GitHub OAuth scope must NOT include `repo`');
  console.log('   [PASS] Test 5: GitHub OAuth scope is read:user user:email (no repo).\n');

  // --- Test 6: OAuth state is signed and verified ---
  console.log('-> Running Test 6: OAuth state HMAC signing + verification');
  const state = authService.createOAuthState('github', 'nonce-abc');
  const verified = authService.verifyOAuthState(state, 'github');
  assert.equal(verified.provider, 'github');
  assert.equal(verified.nonce, 'nonce-abc', 'state must carry the client nonce');

  // Missing state must be rejected (this is the previously-exploitable case).
  assert.throws(() => authService.verifyOAuthState(undefined, 'github'), (e: any) => e.statusCode === 403);
  assert.throws(() => authService.verifyOAuthState('', 'github'), (e: any) => e.statusCode === 403);
  // Tampered signature / payload.
  assert.throws(() => authService.verifyOAuthState(state.slice(0, -1) + 'x', 'github'), (e: any) => e.statusCode === 403);
  assert.throws(() => authService.verifyOAuthState('github:nonce-abc:1:deadbeef', 'github'), (e: any) => e.statusCode === 403);
  // Provider mismatch.
  assert.throws(() => authService.verifyOAuthState(state, 'google'), (e: any) => e.statusCode === 403);
  // Expired.
  assert.throws(
    () => authService.verifyOAuthState(state, 'github', -1),
    (e: any) => e.statusCode === 403 && e.code === 'OAUTH_STATE_EXPIRED'
  );
  console.log('   [PASS] Test 6: OAuth state verified; missing/tampered/mismatched/expired all 403.\n');

  console.log('====================================================');
  console.log('ALL 6 AUTH & TOKEN SECURITY TESTS PASSED!');
  console.log('====================================================');
}

runAuthSecurityTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
