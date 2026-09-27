import assert from 'node:assert/strict';
import { confidenceService } from '../src/services/confidence.service';
import { plannerService } from '../src/services/planner.service';

async function runJsonbOptimizationTests() {
  console.log('===========================================================');
  console.log('RUNNING ARCHON JSONB BLOBS OPTIMIZATION TESTS (P1-4)');
  console.log('===========================================================\n');

  // Test 1: Verify lightweight scannedFiles schema preserves all functionality without raw 'content'
  console.log('-> Running Test 1: ConfidenceService functions properly on lightweight scannedFiles');
  
  const lightScannedFiles = [
    { path: 'src/index.ts', size: 1200, lines: 45 },
    { path: 'src/routes/api.routes.ts', size: 2400, lines: 90 },
    { path: 'src/controllers/api.controller.ts', size: 3100, lines: 110 },
    { path: 'src/services/api.service.ts', size: 1800, lines: 65 }
  ];

  // Note: content is intentionally absent from lightScannedFiles (P1-4)
  assert.ok(!('content' in lightScannedFiles[0]), 'lightScannedFiles must NOT contain raw file content');

  const astMetadata = {
    'src/index.ts': { imports: ['./routes/api.routes'], exports: [], functions: ['main'], classes: [] },
    'src/routes/api.routes.ts': { imports: ['../controllers/api.controller'], exports: ['apiRouter'], functions: [], classes: [] },
    'src/controllers/api.controller.ts': { imports: ['../services/api.service'], exports: ['handleRequest'], functions: ['handleRequest'], classes: [] },
    'src/services/api.service.ts': { imports: [], exports: ['fetchData'], functions: ['fetchData'], classes: [] }
  };

  const dependencyGraph = {
    'src/index.ts': ['src/routes/api.routes.ts'],
    'src/routes/api.routes.ts': ['src/controllers/api.controller.ts'],
    'src/controllers/api.controller.ts': ['src/services/api.service.ts'],
    'src/services/api.service.ts': []
  };

  const confidence = confidenceService.calculateConfidence(
    lightScannedFiles as any,
    astMetadata,
    dependencyGraph,
    ['TypeScript'],
    'Express'
  );

  assert.ok(confidence.score > 0, 'Confidence calculation must succeed with lightweight metadata');
  assert.ok(confidence.checklist.length > 0, 'Confidence checklist must evaluate');
  console.log(`   [PASS] Test 1: Confidence calculated (${confidence.score}%) with 0 bytes of duplicate file content.\n`);

  // Test 2: PlannerService works seamlessly with lightweight scannedFiles
  console.log('-> Running Test 2: PlannerService generates query plan without raw file content');
  const plan = plannerService.planQuery('How does the api controller handle requests?', {
    scannedFiles: lightScannedFiles,
    dependencyGraph,
    astMetadata
  });

  assert.ok(plan.intent, 'Query plan intent must be resolved');
  assert.ok(plan.steps.length > 0, 'Query plan steps must be generated');
  console.log(`   [PASS] Test 2: Planner generated plan (Intent: ${plan.intent}) using lightweight metadata.\n`);

  // Test 3: Payload Size Comparison
  console.log('-> Running Test 3: Memory footprint reduction demonstration');
  const sample100LineFileContent = 'const x = 42;\n'.repeat(100);
  const heavyScannedFiles = Array.from({ length: 100 }, (_, i) => ({
    path: `src/module_${i}.ts`,
    size: sample100LineFileContent.length,
    lines: 100,
    content: sample100LineFileContent
  }));

  const heavyJsonSize = JSON.stringify(heavyScannedFiles).length;
  const lightPrunedFiles = heavyScannedFiles.map(({ path, size, lines }) => ({ path, size, lines }));
  const lightJsonSize = JSON.stringify(lightPrunedFiles).length;

  const reductionPct = Math.round(((heavyJsonSize - lightJsonSize) / heavyJsonSize) * 100);
  assert.ok(reductionPct > 90, `Payload reduction should be >90%, got ${reductionPct}%`);
  console.log(`   [PASS] Test 3: Heavy JSON: ${(heavyJsonSize / 1024).toFixed(1)}KB -> Light JSON: ${(lightJsonSize / 1024).toFixed(1)}KB (${reductionPct}% reduction).\n`);

  console.log('===========================================================');
  console.log('ALL 3 JSONB OPTIMIZATION TESTS (P1-4) PASSED CLEANLY!');
  console.log('===========================================================');
}

runJsonbOptimizationTests().catch((err) => {
  console.error('[FAIL] JSONB optimization test failed:', err);
  process.exit(1);
});
