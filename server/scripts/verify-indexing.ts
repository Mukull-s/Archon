/**
 * Indexing-performance verification harness.
 *
 * Runs the real, side-effect-free logic used by the indexing pipeline:
 *   - token-aware Voyage batching  (server/src/services/embedding.batching.ts)
 *   - size-capped AST chunking     (server/src/services/chunking.ts)
 *   - single-parse metadata+symbols (server/src/services/ast.service.ts)
 *   - bounded concurrency pool     (server/src/services/concurrency.ts)
 *
 * It fails loudly (non-zero exit) if any invariant is violated, and prints a
 * before/after comparison for the exact `TOO_MANY_TOKENS_IN_BATCH` regression
 * described in INDEXING_PERFORMANCE_AUDIT_AND_PLAN.md.
 *
 * Run: npx ts-node --transpile-only scripts/verify-indexing.ts
 */
import {
  buildTokenAwareBatches,
  classifyEmbeddingError,
  clampInputChars,
  estimateTokens,
  DEFAULT_MAX_TOKENS_PER_REQUEST,
  DEFAULT_MAX_INPUTS_PER_REQUEST,
  DEFAULT_MAX_CHARS_PER_INPUT,
} from '../src/services/embedding.batching';
import {
  chunkCodeFile,
  readChunkLimitsFromEnv,
  DEFAULT_CHUNK_MAX_CHARS,
} from '../src/services/chunking';
import { parseSourceFileWithSymbols, parseSourceFile, getCodeSymbols } from '../src/services/ast.service';
import { AsyncSemaphore } from '../src/services/concurrency';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A file containing one enormous class (the old "whole class = one chunk" case). */
function makeLargeClassFile(methodCount: number): string {
  const lines: string[] = ['import { Injectable } from "@nestjs/common";', '', 'export class BigService {'];
  for (let i = 0; i < methodCount; i++) {
    lines.push(
      `  method${i}(input: string, count: number): string { return \`${i}:\${input}:\${count}\`; }`
    );
  }
  lines.push('}', '');
  return lines.join('\n');
}

/** A file with a small header plus many small top-level functions. */
function makeManyFunctionsFile(fnCount: number): string {
  const lines: string[] = ["import fs from 'fs';", ''];
  for (let i = 0; i < fnCount; i++) {
    lines.push(`export function fn${i}(value: number): number {`);
    lines.push(`  return value + ${i};`);
    lines.push('}');
    lines.push('');
  }
  return lines.join('\n');
}

/** A file with one absurdly long single line (minified/bundled style). */
function makeSingleHugeLine(chars: number): string {
  return `export const blob = "${'x'.repeat(chars)}";\n`;
}

async function main() {
  // ── 1. Token-aware batching ───────────────────────────────────────────────

  section('Token-aware batching');
  {
    const opts = {
      maxTokensPerRequest: DEFAULT_MAX_TOKENS_PER_REQUEST,
      maxInputsPerRequest: DEFAULT_MAX_INPUTS_PER_REQUEST,
      maxCharsPerInput: DEFAULT_MAX_CHARS_PER_INPUT,
    };

    const mixed = [
      'small',
      'y'.repeat(4_800), // ~1200 tokens
      'z'.repeat(20_000), // ~5000 tokens (large)
      ...Array.from({ length: 200 }, (_, i) => `function f${i}() { return ${i}; }`),
    ];

    const batches = buildTokenAwareBatches(mixed, opts);
    assert(batches.length >= 1, 'produced at least one batch');
    for (const batch of batches) {
      const tokens = batch.reduce((acc, t) => acc + estimateTokens(t), 0);
      assert(tokens <= opts.maxTokensPerRequest, 'batch respects token budget', `${tokens} > ${opts.maxTokensPerRequest}`);
      assert(batch.length <= opts.maxInputsPerRequest, 'batch respects input ceiling', `${batch.length} > ${opts.maxInputsPerRequest}`);
    }
    const flattened = batches.flat();
    assert(flattened.length === mixed.length, 'no inputs dropped or duplicated', `${flattened.length} vs ${mixed.length}`);
    assert(flattened.every((t, i) => t === mixed[i]), 'input order preserved');

    const clamped = clampInputChars('q'.repeat(50_000), opts.maxCharsPerInput);
    assert(clamped.truncated === true, 'oversized input flagged as truncated');
    assert(clamped.text.length === opts.maxCharsPerInput, 'oversized input clamped to maxChars');
  }

  // ── 2. Error classification / fail-fast ───────────────────────────────────

  section('Error classification (fail-fast)');
  {
    const tooLarge = { statusCode: 400, body: { detail: 'TOO_MANY_TOKENS_IN_BATCH: max 120000, batch has 166031' } };
    const c1 = classifyEmbeddingError(tooLarge);
    assert(c1.isTooLarge && !c1.retryable, '400 TOO_MANY_TOKENS is non-retryable');

    const rateLimit = { statusCode: 429, message: 'rate limit exceeded' };
    const c2 = classifyEmbeddingError(rateLimit);
    assert(c2.isRateLimit && c2.retryable, '429 is retryable');

    const serverErr = { statusCode: 503, message: 'service unavailable' };
    assert(classifyEmbeddingError(serverErr).retryable, '503 is retryable');

    const networkErr = { code: 'ECONNRESET', message: 'socket hang up' };
    assert(classifyEmbeddingError(networkErr).retryable, 'network error is retryable');

    const authErr = { statusCode: 401, message: 'unauthorized' };
    const c5 = classifyEmbeddingError(authErr);
    assert(!c5.retryable && c5.reason === 'invalid_request', '401 is non-retryable');

    const timeout = { name: 'VoyageAITimeoutError', message: 'Request timed out' };
    assert(classifyEmbeddingError(timeout).retryable, 'timeout is retryable');
  }

  // ── 3. Chunk size ceilings ────────────────────────────────────────────────

  section('Chunking size ceilings');
  {
    const limits = readChunkLimitsFromEnv();
    assert(limits.maxChars === DEFAULT_CHUNK_MAX_CHARS, 'default chunk ceiling honoured');

    const bigClass = makeLargeClassFile(2_000);
    const parsedClass = parseSourceFileWithSymbols('src/big.service.ts', bigClass);
    const classChunks = chunkCodeFile('src/big.service.ts', bigClass, parsedClass.symbols, limits);
    const classMax = Math.max(...classChunks.map(c => c.content.length));
    assert(classChunks.length > 1, 'oversized class split into multiple chunks', `got ${classChunks.length}`);
    assert(classMax <= limits.maxChars, 'no chunk exceeds maxChars', `max ${classMax} > ${limits.maxChars}`);
    assert(classChunks.every(c => c.startLine >= 1 && c.endLine >= c.startLine), 'all chunk line ranges valid');
    assert(classChunks.some(c => /#\d+\/\d+$/.test(c.symbolName)), 'split symbol chunks are numbered');

    const manyFns = makeManyFunctionsFile(300);
    const parsedFns = parseSourceFileWithSymbols('src/fns.ts', manyFns);
    const fnChunks = chunkCodeFile('src/fns.ts', manyFns, parsedFns.symbols, limits);
    assert(fnChunks.length >= parsedFns.symbols.length, 'each function yields at least one chunk');
    assert(Math.max(...fnChunks.map(c => c.content.length)) <= limits.maxChars, 'function chunks within ceiling');

    const hugeLine = makeSingleHugeLine(40_000);
    const parsedLine = parseSourceFileWithSymbols('src/blob.ts', hugeLine);
    const lineChunks = chunkCodeFile('src/blob.ts', hugeLine, parsedLine.symbols, limits);
    assert(lineChunks.length > 1, 'single huge line split into multiple chunks');
    assert(
      Math.max(...lineChunks.map(c => c.content.length)) <= limits.maxChars,
      'huge-line chunks within ceiling',
      `max ${Math.max(...lineChunks.map(c => c.content.length))}`
    );

    assert(chunkCodeFile('src/empty.ts', '', [], limits).length === 0, 'empty content yields no chunks');
  }

  // ── 4. Single-parse equivalence ───────────────────────────────────────────

  section('Single-parse metadata + symbols');
  {
    const src = makeManyFunctionsFile(40);
    const combined = parseSourceFileWithSymbols('src/eq.ts', src);
    const metadataOnly = parseSourceFile('src/eq.ts', src);
    const symbolsOnly = getCodeSymbols('src/eq.ts', src);

    assert(
      JSON.stringify(combined.metadata) === JSON.stringify(metadataOnly),
      'combined metadata matches parseSourceFile'
    );
    assert(
      JSON.stringify(combined.symbols) === JSON.stringify(symbolsOnly),
      'combined symbols match getCodeSymbols'
    );
  }

  // ── 5. Bounded concurrency pool ───────────────────────────────────────────

  section('Bounded concurrency pool');
  {
    const sem = new AsyncSemaphore(3);
    let active = 0;
    let peak = 0;
    const completed: number[] = [];

    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        sem.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve, 15));
          active--;
          completed.push(i);
          return i;
        })
      )
    );

    assert(peak <= 3, 'never exceeds configured concurrency', `peak ${peak}`);
    assert(peak === 3, 'actually reaches configured concurrency', `peak ${peak}`);
    assert(completed.length === 12, 'all tasks complete');
    assert(sem.active === 0 && sem.waiting === 0, 'semaphore drains to zero');

    // Dynamic resize (adaptive 429 throttle): raising the ceiling admits queued waiters.
    const grow = new AsyncSemaphore(1);
    const resolvers: Array<() => void> = [];
    const hold = () => new Promise<void>(resolve => { resolvers.push(resolve); });
    const first = grow.run(hold);
    const second = grow.run(hold);
    assert(grow.active === 1 && grow.waiting === 1, 'queued when at capacity', `active ${grow.active} waiting ${grow.waiting}`);
    grow.setMaxConcurrency(3);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert(grow.active === 2 && grow.waiting === 0, 'raising ceiling admits queued waiters', `active ${grow.active} waiting ${grow.waiting}`);
    resolvers.forEach(resolve => resolve());
    await Promise.all([first, second]);
    assert(grow.active === 0, 'resizable semaphore drains');
  }

  // ── 6. EmbeddingService integration (mock Voyage client) ──────────────────

  section('EmbeddingService: fail-fast + split recovery (mock client)');
  {
    // Provide a valid env so ../config can load; the mock client bypasses network.
    process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/archon_test';
    process.env.GITHUB_CLIENT_ID ||= 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET ||= 'test-client-secret';
    process.env.JWT_SECRET ||= 'x'.repeat(32);
    process.env.RESEND_API_KEY ||= 'test-resend';
    process.env.VOYAGE_API_KEY ||= 'test-voyage';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EmbeddingService } = require('../src/services/embedding.service');

    const tooLargeError = () => ({
      statusCode: 400,
      body: { detail: 'TOO_MANY_TOKENS_IN_BATCH: max 120000, batch has 999999' },
    });

    // A) A batch rejected as too large is split and recovered, preserving order.
    let callsA = 0;
    const splitClient = {
      embed: async (req: any) => {
        callsA++;
        const inputs: string[] = req.input;
        if (inputs.length > 4) throw tooLargeError();
        return {
          data: inputs.map((t: string, index: number) => ({ index, embedding: [t.length] })),
          usage: { prompt_tokens: inputs.length * 10 },
        };
      },
    };
    const svcA = new EmbeddingService(splitClient as any, 3);
    const inputsA = Array.from({ length: 8 }, (_, i) => `chunk-${i}-${'a'.repeat(50)}`);
    const outA = await svcA.getEmbeddingsBatch(inputsA);
    assert(outA.length === 8, 'split recovery returns all embeddings', `got ${outA.length}`);
    assert(callsA === 3, 'too-large batch split once into two requests', `calls ${callsA}`);
    assert(outA[0][0] === inputsA[0].length && outA[7][0] === inputsA[7].length, 'split recovery preserves order');

    // B) A non-retryable error fails in a single attempt (no retry waste).
    let callsB = 0;
    const failClient = {
      embed: async () => {
        callsB++;
        throw { statusCode: 400, body: { detail: 'invalid_request' } };
      },
    };
    const svcB = new EmbeddingService(failClient as any, 3);
    let threwB = false;
    try {
      await svcB.getEmbeddingsBatch(['only-one-input']);
    } catch {
      threwB = true;
    }
    assert(threwB, 'non-retryable error is surfaced');
    assert(callsB === 1, 'non-retryable error is NOT retried', `calls ${callsB}`);

    // C) An oversized input is clamped before the request is made.
    let maxLenSeen = 0;
    const clampClient = {
      embed: async (req: any) => {
        maxLenSeen = Math.max(maxLenSeen, ...(req.input as string[]).map(t => t.length));
        return {
          data: (req.input as string[]).map((_t, index) => ({ index, embedding: [1] })),
          usage: {},
        };
      },
    };
    const svcC = new EmbeddingService(clampClient as any, 3);
    await svcC.getEmbeddingsBatch(['q'.repeat(50_000)]);
    assert(maxLenSeen <= DEFAULT_MAX_CHARS_PER_INPUT, 'oversized input clamped before request', `max ${maxLenSeen}`);
  }

  // ── 7. Before/after: the exact regression scenario ────────────────────────

  section('Regression: 128-count batching vs token-aware batching');
  {
    const limits = readChunkLimitsFromEnv();
    const opts = {
      maxTokensPerRequest: DEFAULT_MAX_TOKENS_PER_REQUEST,
      maxInputsPerRequest: DEFAULT_MAX_INPUTS_PER_REQUEST,
      maxCharsPerInput: DEFAULT_MAX_CHARS_PER_INPUT,
    };

    const files: Array<{ path: string; content: string }> = [];
    for (let i = 0; i < 60; i++) {
      files.push({ path: `src/module${i}.ts`, content: makeLargeClassFile(400 + (i % 7) * 120) });
    }

    // OLD pipeline: raw symbol chunks (unbounded) split into groups of 128 inputs.
    const oldRawChunks: string[] = [];
    for (const file of files) {
      const parsed = parseSourceFileWithSymbols(file.path, file.content);
      for (const sym of parsed.symbols) {
        const lines = file.content.split('\n');
        oldRawChunks.push(lines.slice(sym.startLine - 1, sym.endLine).join('\n'));
      }
    }
    const oldBatches: string[][] = [];
    for (let i = 0; i < oldRawChunks.length; i += 128) oldBatches.push(oldRawChunks.slice(i, i + 128));
    const oldMaxTokens = Math.max(...oldBatches.map(b => b.reduce((a, t) => a + estimateTokens(t), 0)));

    // NEW pipeline: size-capped chunks, token-budgeted batches.
    const newChunkContents: string[] = [];
    for (const file of files) {
      const parsed = parseSourceFileWithSymbols(file.path, file.content);
      for (const chunk of chunkCodeFile(file.path, file.content, parsed.symbols, limits)) {
        newChunkContents.push(chunk.content);
      }
    }
    const newBatches = buildTokenAwareBatches(newChunkContents, opts);
    const newMaxTokens = Math.max(...newBatches.map(b => b.reduce((a, t) => a + estimateTokens(t), 0)));
    const newMaxInputs = Math.max(...newBatches.map(b => b.length));

    console.log(`  old (128-count): ${oldRawChunks.length} chunks -> ${oldBatches.length} batches, max ~${oldMaxTokens} tokens/batch`);
    console.log(`  new (token-aware): ${newChunkContents.length} chunks -> ${newBatches.length} batches, max ~${newMaxTokens} tokens/batch, max ${newMaxInputs} inputs/batch`);

    assert(oldMaxTokens > 120_000, 'OLD batching genuinely exceeded Voyage 120k token cap (regression reproduced)', `max ${oldMaxTokens}`);
    assert(newMaxTokens <= opts.maxTokensPerRequest, 'NEW batching never exceeds 90k token budget', `max ${newMaxTokens}`);
    assert(newMaxInputs <= opts.maxInputsPerRequest, 'NEW batching never exceeds 96 inputs', `max ${newMaxInputs}`);
    assert(
      Math.max(...newChunkContents.map(c => c.length)) <= limits.maxChars,
      'NEW chunking caps every chunk under maxChars'
    );
  }

  console.log(`\n${failed === 0 ? '✅ PASS' : '❌ FAIL'} — ${passed} assertions passed, ${failed} failed.`);
  return failed;
}

main()
  .then((failedCount) => process.exit(failedCount === 0 ? 0 : 1))
  .catch((err) => {
    console.error('Harness crashed:', err);
    process.exit(1);
  });
