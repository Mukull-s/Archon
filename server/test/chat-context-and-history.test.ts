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
import { prepareChatContext } from '../src/controllers/repo.controller';
import { llmService } from '../src/services/llm.service';

async function runChatContextAndHistoryTests() {
  console.log('====================================================');
  console.log('RUNNING CHAT CONTEXT PIPELINE & HISTORY TESTS (P1-2, P1-3)');
  console.log('====================================================\n');

  const testRepoId = 'repo-chat-test-123';
  const testUserId = 'user-owner-456';
  const victimUserId = 'user-victim-789';

  // Mock repository data in memory
  const mockRepo = {
    id: testRepoId,
    userId: testUserId,
    name: 'archon-chat-demo',
    fileCount: 5,
    totalSize: 12000,
    framework: 'express',
    languages: JSON.stringify(['typescript', 'javascript']),
    entryPoints: JSON.stringify(['src/server.ts']),
    scannedFiles: JSON.stringify([
      { path: 'src/server.ts', size: 1000, lines: 40, hash: 'h1' },
      { path: 'src/routes/auth.ts', size: 1500, lines: 60, hash: 'h2' }
    ]),
    dependencyGraph: JSON.stringify({
      'src/server.ts': ['src/routes/auth.ts']
    }),
    astMetadata: JSON.stringify({
      'src/server.ts': { imports: ['src/routes/auth.ts'], exports: [], functions: ['main'], classes: [] }
    })
  };

  const mockChatHistory = [
    { id: 'm1', repositoryId: testRepoId, sender: 'USER', message: 'What does this project do?', createdAt: new Date('2026-09-24T10:00:00Z') },
    { id: 'm2', repositoryId: testRepoId, sender: 'AI', message: 'It is an AI codebase intelligence platform.', createdAt: new Date('2026-09-24T10:00:05Z') },
    { id: 'm3', repositoryId: testRepoId, sender: 'USER', message: 'Where are the routes defined?', createdAt: new Date('2026-09-24T10:01:00Z') },
    { id: 'm4', repositoryId: testRepoId, sender: 'AI', message: 'Routes are in src/routes/auth.ts.', createdAt: new Date('2026-09-24T10:01:05Z') }
  ];

  const origFindFirst = prisma.repository.findFirst;
  const origFindManyChunks = prisma.codeChunk.findMany;
  const origFindManyMessages = prisma.chatMessage.findMany;
  const origUpdateManyUsers = prisma.user.updateMany;
  const origUserFindUnique = prisma.user.findUnique;
  const origQueryRaw = prisma.$queryRaw;

  (prisma as any).$queryRaw = async () => [
    {
      id: 'chunk-1',
      filePath: 'src/server.ts',
      content: 'import auth from "./routes/auth";\napp.listen(3000);',
      startLine: 1,
      endLine: 20,
      symbolName: 'main',
      distance: 0.05
    }
  ];

  (prisma.repository as any).findFirst = async ({ where }: any) => {
    if (where.id === testRepoId && where.userId === testUserId) {
      return mockRepo;
    }
    return null;
  };

  (prisma.user as any).findUnique = async () => ({
    id: testUserId,
    plan: 'free',
    lifetimeAnalysesUsed: 0,
    monthlyAiQuestionsUsed: 2,
    monthlyReindexesUsed: 0,
    usagePeriodStart: new Date()
  });

  (prisma.user as any).updateMany = async () => ({ count: 1 });

  (prisma.codeChunk as any).findMany = async () => [
    {
      filePath: 'src/server.ts',
      content: 'import auth from "./routes/auth";\napp.listen(3000);',
      startLine: 1,
      endLine: 20,
      symbolName: 'main'
    }
  ];

  (prisma.chatMessage as any).findMany = async () => {
    // Return newest-first like Prisma does with orderBy: { createdAt: 'desc' }
    return [...mockChatHistory].reverse();
  };

  try {
    // --- Test 1: prepareChatContext enforces authorization ---
    console.log('-> Running Test 1: prepareChatContext rejects unauthorized user');
    let rejected = false;
    try {
      await prepareChatContext(testRepoId, victimUserId, 'How do I authenticate?');
    } catch (err: any) {
      assert.equal(err.statusCode, 404);
      assert.equal(err.message, 'Repository not found or access denied.');
      rejected = true;
    }
    assert.ok(rejected, 'Must reject unauthorized user');
    console.log('   [PASS] Test 1: Unauthorized user properly rejected.\n');

    // --- Test 2: prepareChatContext retrieves chronological conversation history ---
    console.log('-> Running Test 2: prepareChatContext loads and chronologically orders prior chat turns (P1-3)');
    const context = await prepareChatContext(testRepoId, testUserId, 'Show me the authentication middleware.');

    assert.ok(context.conversationHistory, 'Conversation history must be present');
    assert.equal(context.conversationHistory.length, 4, 'Must contain 4 prior messages');

    // Verify chronological order: turn 1 user, turn 1 assistant, turn 2 user, turn 2 assistant
    assert.equal(context.conversationHistory[0].role, 'user');
    assert.equal(context.conversationHistory[0].content, 'What does this project do?');
    assert.equal(context.conversationHistory[1].role, 'assistant');
    assert.equal(context.conversationHistory[1].content, 'It is an AI codebase intelligence platform.');
    assert.equal(context.conversationHistory[2].role, 'user');
    assert.equal(context.conversationHistory[2].content, 'Where are the routes defined?');
    assert.equal(context.conversationHistory[3].role, 'assistant');
    assert.equal(context.conversationHistory[3].content, 'Routes are in src/routes/auth.ts.');
    console.log('   [PASS] Test 2: Conversation history loaded and chronologically formatted.\n');

    // --- Test 3: prepareChatContext extracts unified query plan & context chunks (P1-2) ---
    console.log('-> Running Test 3: prepareChatContext consolidates query planning, chunk ranking, and metadata');
    assert.ok(context.plan, 'Plan must be generated');
    assert.ok(context.contextChunks.length > 0, 'Context chunks must be allocated');
    assert.ok(context.repoMetadata.name === 'archon-chat-demo', 'Repo metadata assembled');
    assert.ok(Array.isArray(context.evidenceTraces), 'Evidence traces present');
    console.log('   [PASS] Test 3: Unified context pipeline deduplicated successfully.\n');

    console.log('====================================================');
    console.log('ALL CHAT CONTEXT & HISTORY TESTS (P1-2, P1-3) PASSED!');
    console.log('====================================================');
  } finally {
    prisma.repository.findFirst = origFindFirst;
    prisma.codeChunk.findMany = origFindManyChunks;
    prisma.chatMessage.findMany = origFindManyMessages;
    prisma.user.updateMany = origUpdateManyUsers;
    prisma.user.findUnique = origUserFindUnique;
    prisma.$queryRaw = origQueryRaw;
  }
}

runChatContextAndHistoryTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
