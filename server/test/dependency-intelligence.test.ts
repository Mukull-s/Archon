import assert from 'node:assert/strict';
import { dependencyIntelligenceService } from '../src/services/dependency-intelligence.service.ts';
import { plannerService } from '../src/services/planner.service.ts';
import { llmService } from '../src/services/llm.service.ts';

// Mock Repository Fixture
const mockScannedFiles = [
  { path: 'src/services/auth.service.ts' },
  { path: 'src/utils/token.ts' },
  { path: 'src/routes/api.routes.ts' },
  { path: 'src/controllers/payment.controller.ts' },
  { path: 'src/config/db.ts' },
  { path: 'server/config.ts' },
  { path: 'client/config.ts' },
  { path: 'package.json' }
];

const mockDependencyGraph: Record<string, string[]> = {
  'src/routes/api.routes.ts': ['src/services/auth.service.ts'],
  'src/services/auth.service.ts': ['src/utils/token.ts'],
  'src/utils/token.ts': ['src/config/db.ts'],
  'src/controllers/payment.controller.ts': ['src/config/db.ts'],
  'server/config.ts': ['src/config/db.ts'],
  'client/config.ts': []
};

const mockAstMetadata: Record<string, any> = {
  'src/routes/api.routes.ts': {
    imports: [
      { source: '../services/auth.service', specifiers: ['AuthService'], isTypeOnly: false }
    ]
  },
  'src/services/auth.service.ts': {
    imports: [
      { source: '../utils/token', specifiers: ['generateToken', 'verifyToken'], isTypeOnly: false }
    ]
  },
  'src/utils/token.ts': {
    imports: [
      { source: '../config/db', specifiers: ['dbClient'], isTypeOnly: false }
    ]
  }
};

const mockCodeChunks = [
  {
    filePath: 'src/services/auth.service.ts',
    startLine: 1,
    endLine: 25,
    content: `import { generateToken, verifyToken } from '../utils/token';\n\nexport class AuthService {\n  async login(user: any) {\n    return generateToken(user.id);\n  }\n}`
  },
  {
    filePath: 'src/routes/api.routes.ts',
    startLine: 1,
    endLine: 20,
    content: `import { AuthService } from '../services/auth.service';\nimport { Router } from 'express';\n\nconst router = Router();`
  },
  {
    filePath: 'src/controllers/payment.controller.ts',
    startLine: 1,
    endLine: 30,
    content: `import { dbClient } from '../config/db';\n\nexport class PaymentController {}`
  },
  {
    filePath: 'package.json',
    startLine: 1,
    endLine: 20,
    content: `{\n  "name": "mock-repo",\n  "dependencies": {\n    "jsonwebtoken": "^9.0.0"\n  }\n}`
  }
];

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING ARCHON AST DEPENDENCY INTELLIGENCE TESTS');
  console.log('====================================================\n');

  // TEST A: Direct Dependency Query
  console.log('-> Running Test A: Direct Dependency Query ("Does auth.service.ts depend on token.ts?")');
  const resultA = dependencyIntelligenceService.analyzeDependencies({
    queryText: 'Does auth.service.ts depend on token.ts?',
    scannedFiles: mockScannedFiles,
    dependencyGraph: mockDependencyGraph,
    astMetadata: mockAstMetadata,
    codeChunks: mockCodeChunks
  });

  assert.equal(resultA.relationship, 'DIRECT_DEPENDENCY');
  assert.equal(resultA.hops, 1);
  assert.deepEqual(resultA.path, ['src/services/auth.service.ts', 'src/utils/token.ts']);
  assert.ok(resultA.evidence.length > 0, 'Should have source evidence');
  assert.ok(resultA.evidence[0].statement.includes('generateToken'), 'Evidence should cite actual import');
  assert.ok(resultA.executedSteps.some(s => s.includes('direct dependency confirmed')), 'Steps should include direct confirmation');
  console.log('   [PASS] Test A: Direct dependency verified with exact source evidence & 1 hop.\n');

  // TEST B: No Dependency Query
  console.log('-> Running Test B: No Dependency Query ("Does auth.service.ts depend on payment.controller.ts?")');
  const resultB = dependencyIntelligenceService.analyzeDependencies({
    queryText: 'Does auth.service.ts depend on payment.controller.ts?',
    scannedFiles: mockScannedFiles,
    dependencyGraph: mockDependencyGraph,
    astMetadata: mockAstMetadata,
    codeChunks: mockCodeChunks
  });

  assert.equal(resultB.relationship, 'NO_DEPENDENCY');
  assert.equal(resultB.hops, undefined);
  assert.ok(resultB.evidence.length === 0, 'No evidence for non-existent dependency');
  assert.ok(resultB.executedSteps.some(s => s.includes('No dependency path found')), 'Steps must confirm no path found');
  console.log('   [PASS] Test B: Non-existent dependency verified as NO_DEPENDENCY.\n');

  // TEST C: Transitive Dependency Query
  console.log('-> Running Test C: Transitive Dependency Query ("Does api.routes.ts depend on token.ts?")');
  const resultC = dependencyIntelligenceService.analyzeDependencies({
    queryText: 'Does api.routes.ts depend on token.ts?',
    scannedFiles: mockScannedFiles,
    dependencyGraph: mockDependencyGraph,
    astMetadata: mockAstMetadata,
    codeChunks: mockCodeChunks
  });

  assert.equal(resultC.relationship, 'TRANSITIVE_DEPENDENCY');
  assert.equal(resultC.hops, 2);
  assert.deepEqual(resultC.path, ['src/routes/api.routes.ts', 'src/services/auth.service.ts', 'src/utils/token.ts']);
  assert.ok(resultC.executedSteps.some(s => s.includes('Transitive dependency confirmed (2 hops)')), 'Steps should record 2 hops');
  console.log('   [PASS] Test C: Transitive BFS path identified across 2 hops.\n');

  // TEST D: Reverse Dependency Query
  console.log('-> Running Test D: Reverse Dependency Query ("Does token.ts depend on auth.service.ts?")');
  const resultD = dependencyIntelligenceService.analyzeDependencies({
    queryText: 'Does token.ts depend on auth.service.ts?',
    scannedFiles: mockScannedFiles,
    dependencyGraph: mockDependencyGraph,
    astMetadata: mockAstMetadata,
    codeChunks: mockCodeChunks
  });

  assert.equal(resultD.relationship, 'REVERSE_DEPENDENCY');
  assert.ok(resultD.executedSteps.some(s => s.includes('Reverse dependency detected')), 'Steps should state reverse dependency');
  console.log('   [PASS] Test D: Reverse dependency correctly differentiated from forward dependency.\n');

  // TEST E: Ambiguous Entity Resolution
  console.log('-> Running Test E: Ambiguous Entity ("Does config.ts depend on db.ts?")');
  const resultE = dependencyIntelligenceService.analyzeDependencies({
    queryText: 'Does config.ts depend on db.ts?',
    scannedFiles: mockScannedFiles,
    dependencyGraph: mockDependencyGraph,
    astMetadata: mockAstMetadata,
    codeChunks: mockCodeChunks
  });

  assert.equal(resultE.relationship, 'AMBIGUOUS_ENTITY');
  assert.ok(resultE.executedSteps.some(s => s.includes('Ambiguous entity match')), 'Steps must state ambiguity');
  assert.ok(resultE.executedSteps.some(s => s.includes('server/config.ts') && s.includes('client/config.ts')), 'Steps must list candidates');
  console.log('   [PASS] Test E: Ambiguous files detected; prompt requires clarification without silent guessing.\n');

  // TEST F: Package.json Isolation
  console.log('-> Running Test F: Package.json Query Isolation');
  const planF = plannerService.planQuery('Does auth.service.ts depend on token.ts?', {
    scannedFiles: mockScannedFiles,
    dependencyGraph: mockDependencyGraph,
    astMetadata: mockAstMetadata
  });

  assert.equal(planF.intent, 'DEPENDENCY');
  assert.equal(planF.useVector, false);
  assert.ok(planF.dependencyAnalysis, 'Plan should contain dependencyAnalysis');
  assert.notEqual(planF.dependencyAnalysis?.sourceFile, 'package.json');
  assert.notEqual(planF.dependencyAnalysis?.targetFile, 'package.json');
  for (const step of planF.steps) {
    assert.ok(!step.toLowerCase().includes('package.json'), `Step "${step}" must not mention package.json for code dependencies`);
  }
  console.log('   [PASS] Test F: package.json is 100% isolated and never used for code dependency questions.\n');

  // TEST G: LLM System Prompt Structural Truth Enforcement
  console.log('-> Running Test G: LLM System Prompt Structural Truth Block');
  const systemPromptG = (llmService as any).buildSystemPrompt(
    [],
    { name: 'TestRepo', fileCount: 8, totalSize: 1000, fileTree: '' },
    [],
    resultA
  );

  assert.ok(systemPromptG.includes('## VERIFIED ARCHON STRUCTURAL EVIDENCE'), 'Prompt must contain structural evidence block');
  assert.ok(systemPromptG.includes('FACT:'), 'Prompt must state FACT');
  assert.ok(systemPromptG.includes('DIRECT_DEPENDENCY'), 'Prompt must state DIRECT_DEPENDENCY');
  assert.ok(systemPromptG.includes('CRITICAL DIRECTIVE ON STRUCTURAL TRUTH:'), 'Prompt must enforce truth directive');
  assert.ok(systemPromptG.includes('You MUST NOT contradict or invent dependency relationships'), 'Prompt must forbid hallucinations');
  console.log('   [PASS] Test G: LLM system prompt forcefully constrains output to verified AST facts.\n');

  console.log('====================================================');
  console.log('ALL 7 ARCHON AST DEPENDENCY INTELLIGENCE TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
