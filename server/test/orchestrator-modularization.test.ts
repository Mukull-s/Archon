import assert from 'node:assert/strict';
import { repoController, performVectorIndexing, prepareChatContext } from '../src/controllers/repo.controller';
import { performVectorIndexing as indexingFn, hashFile, cleanString } from '../src/services/indexing.orchestrator';
import { chatOrchestrator, prepareChatContext as chatPrepFn, buildFileTreeString } from '../src/services/chat.orchestrator';
import { impactOrchestrator, executeImpactAnalysis } from '../src/services/impact.orchestrator';

async function runOrchestratorModularizationTests() {
  console.log('===========================================================');
  console.log('RUNNING ARCHON ORCHESTRATOR MODULARIZATION TESTS (P1-1)');
  console.log('===========================================================\n');

  // Test 1: IndexingOrchestrator separation
  console.log('-> Running Test 1: IndexingOrchestrator module exports');
  assert.equal(typeof indexingFn, 'function', 'performVectorIndexing must be an exported function');
  assert.equal(typeof hashFile, 'function', 'hashFile must be an exported function');
  assert.equal(typeof cleanString, 'function', 'cleanString must be an exported function');
  assert.equal(cleanString('test\u0000string'), 'teststring', 'cleanString must strip null bytes');
  console.log('   [PASS] Test 1: IndexingOrchestrator exports verified.\n');

  // Test 2: ChatOrchestrator separation
  console.log('-> Running Test 2: ChatOrchestrator module exports');
  assert.equal(typeof chatPrepFn, 'function', 'prepareChatContext must be an exported function');
  assert.equal(typeof chatOrchestrator.executeChatWithRepo, 'function', 'executeChatWithRepo must be a function');
  assert.equal(typeof chatOrchestrator.executeChatWithRepoStream, 'function', 'executeChatWithRepoStream must be a function');
  assert.equal(typeof chatOrchestrator.getChatHistory, 'function', 'getChatHistory must be a function');
  
  const tree = buildFileTreeString([{ path: 'src/b.ts' }, { path: 'src/a.ts' }]);
  assert.equal(tree, '- src/a.ts\n- src/b.ts', 'buildFileTreeString must sort and format paths');
  console.log('   [PASS] Test 2: ChatOrchestrator exports and helpers verified.\n');

  // Test 3: ImpactOrchestrator separation
  console.log('-> Running Test 3: ImpactOrchestrator module exports');
  assert.equal(typeof executeImpactAnalysis, 'function', 'executeImpactAnalysis must be an exported function');
  assert.equal(typeof impactOrchestrator.executeImpactAnalysis, 'function', 'impactOrchestrator.executeImpactAnalysis must be a function');
  console.log('   [PASS] Test 3: ImpactOrchestrator exports verified.\n');

  // Test 4: Backward Compatibility of RepoController
  console.log('-> Running Test 4: RepoController backward compatibility surface');
  assert.equal(typeof performVectorIndexing, 'function', 'performVectorIndexing re-export preserved');
  assert.equal(typeof prepareChatContext, 'function', 'prepareChatContext re-export preserved');

  const requiredControllerHandlers = [
    'scanPublicRepo',
    'scanLocalZip',
    'listUserRepos',
    'getRepoDetails',
    'deleteRepo',
    'archiveRepo',
    'unarchiveRepo',
    'analyzeImpact',
    'buildVectorIndex',
    'chatWithRepo',
    'chatWithRepoStream',
    'getChatHistory',
    'getRepoInsights',
    'getRepoStory',
    'getRepoOnboarding',
    'generateRepoSummaryEndpoint'
  ];

  for (const handler of requiredControllerHandlers) {
    assert.equal(
      typeof (repoController as any)[handler],
      'function',
      `Handler repoController.${handler} must be exported as a valid function`
    );
  }
  console.log(`   [PASS] Test 4: All ${requiredControllerHandlers.length} controller handlers and re-exports verified.\n`);

  console.log('===========================================================');
  console.log('ALL 4 ORCHESTRATOR MODULARIZATION TESTS (P1-1) PASSED CLEANLY!');
  console.log('===========================================================');
}

runOrchestratorModularizationTests().catch((err) => {
  console.error('[FAIL] Orchestrator modularization test failed:', err);
  process.exit(1);
});
