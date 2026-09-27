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

  // ── 6. BatchPipeline: bounded embeds + decoupled persistence ─────────────

  section('BatchPipeline: bounded embeds + decoupled DB');
  {
    const { BatchPipeline } = require('../src/services/indexing.pipeline');

    // concurrency 1 is the sharpest test: with a coupled design the insert would
    // block the next embed; decoupled, they overlap.
    let activeEmbeds = 0;
    let activeInserts = 0;
    let overlapped = false;
    const inserted: number[] = [];

    const pipeline = new BatchPipeline({
      concurrency: 1,
      maxOutstanding: 4,
      embed: async (texts: string[]) => {
        activeEmbeds++;
        if (activeInserts > 0) overlapped = true;
        await new Promise(r => setTimeout(r, 25));
        activeEmbeds--;
        return texts.map(() => [1, 2, 3]);
      },
      insert: async (items: any[], _embeddings: number[][], startIndex: number) => {
        activeInserts++;
        if (activeEmbeds > 0) overlapped = true;
        await new Promise(r => setTimeout(r, 25));
        activeInserts--;
        inserted.push(...items.map((it: any) => startIndex + it.i));
      },
    });

    const N = 4;
    for (let b = 0; b < N; b++) {
      const items = [{ i: 0 }, { i: 1 }];
      pipeline.submit({ items, texts: items.map(() => 'x'), startIndex: b * 2 });
    }
    await pipeline.drain();

    assert(pipeline.peakEmbedConcurrency === 1, 'embed concurrency respected', `peak ${pipeline.peakEmbedConcurrency}`);
    assert(overlapped, 'a DB insert overlapped an embedding call (decoupled)');
    assert(inserted.length === N * 2, 'all items inserted', `${inserted.length}`);
    assert(
      inserted.slice().sort((a, b) => a - b).join(',') === '0,1,2,3,4,5,6,7',
      'global chunk indices remain correct',
      inserted.join(',')
    );

    // Error isolation: one failing embed must not stop the others.
    let embedCalls = 0;
    let failed = 0;
    const p2 = new BatchPipeline({
      concurrency: 2,
      embed: async () => {
        embedCalls++;
        if (embedCalls === 1) throw new Error('boom');
        return [[1]];
      },
      insert: async () => {},
      onEmbedError: () => { failed++; },
    });
    p2.submit({ items: [{ i: 0 }], texts: ['a'], startIndex: 0 });
    p2.submit({ items: [{ i: 1 }], texts: ['b'], startIndex: 1 });
    p2.submit({ items: [{ i: 2 }], texts: ['c'], startIndex: 2 });
    await p2.drain();
    assert(failed === 1, 'failing batch reported exactly once', `failed ${failed}`);
    assert(p2.insertedItems === 2, 'unaffected batches still persisted', `inserted ${p2.insertedItems}`);

    // Back-pressure keeps outstanding batches bounded.
    let peakOutstanding = 0;
    const p3 = new BatchPipeline({
      concurrency: 2,
      maxOutstanding: 2,
      embed: async () => { await new Promise(r => setTimeout(r, 10)); return [[1]]; },
      insert: async () => { await new Promise(r => setTimeout(r, 10)); },
    });
    for (let i = 0; i < 8; i++) {
      await p3.waitForCapacity();
      p3.submit({ items: [{ i }], texts: ['x'], startIndex: i });
      peakOutstanding = Math.max(peakOutstanding, p3.outstanding);
    }
    await p3.drain();
    assert(peakOutstanding <= 2, 'back-pressure bounds outstanding batches', `peak ${peakOutstanding}`);
  }

  // ── 7. Completion gate: summary parsing + quarantine accounting ──────────

  section('Completion gate: summary parsing + quarantine');
  {
    const { parseRepositorySummary } = require('../src/services/indexing.orchestrator');

    const rawJson = parseRepositorySummary('{"summary":"A tool","purpose":"x"}');
    assert(rawJson.summary === 'A tool' && rawJson.purpose === 'x', 'parses raw JSON summary');

    const fenced = parseRepositorySummary('```json\n{"summary":"Fenced"}\n```');
    assert(fenced.summary === 'Fenced', 'parses fenced JSON summary');

    const prose = parseRepositorySummary('Just some prose about the repo');
    assert(prose.summary === 'Just some prose about the repo', 'falls back to prose as summary');

    assert(parseRepositorySummary('').summary === '', 'empty summary parses to empty');

    const { BatchPipeline } = require('../src/services/indexing.pipeline');

    // Embed failures are quarantined (not terminal) and surfaced to the caller.
    const quarantined: any[] = [];
    const p = new BatchPipeline({
      concurrency: 2,
      embed: async (texts: string[]) => {
        if (texts[0] === 'bad') throw new Error('voyage down');
        return texts.map(() => [1]);
      },
      insert: async () => {},
      onEmbedError: (_err: unknown, b: any) => quarantined.push(b)
    });
    p.submit({ items: [{ i: 0 }], texts: ['bad'], startIndex: 0 });
    p.submit({ items: [{ i: 1 }], texts: ['good'], startIndex: 1 });
    await p.drain();
    assert(quarantined.length === 1, 'quarantine surfaces exactly the failed batch', `${quarantined.length}`);
    assert(quarantined[0].startIndex === 0, 'quarantined batch keeps its global start index');
    assert(p.resolvedBatches === 1, 'resolvedBatches counts successful batches', `${p.resolvedBatches}`);
    assert(p.failedBatches === 0, 'embed failures are not terminal until recovery is attempted');

    // Insert failures are terminal and counted.
    const p2 = new BatchPipeline({
      concurrency: 1,
      embed: async () => [[1]],
      insert: async () => { throw new Error('db write failed'); }
    });
    p2.submit({ items: [{ i: 0 }], texts: ['x'], startIndex: 0 });
    await p2.drain();
    assert(p2.failedBatches === 1, 'insert failure is terminal and counted', `${p2.failedBatches}`);
    assert(p2.resolvedBatches === 0, 'no batch resolves on insert failure', `${p2.resolvedBatches}`);
  }

  // ── 9. Vector literal: compact AND float32-lossless ──────────────────────

  section('Vector literal serialization (wire-byte reduction)');
  {
    const { toVectorLiteral } = require('../src/services/vector.service');

    const vec = Array.from({ length: 512 }, () => Math.random() * 2 - 1);
    const compact = toVectorLiteral(vec);
    const naive = `[${vec.join(',')}]`;

    // 1. It must be materially smaller on the wire.
    assert(compact.length < naive.length * 0.65, 'compact literal is >=35% smaller', `${compact.length} vs ${naive.length}`);

    // 2. It must round-trip to the exact same float32 pgvector would store.
    const parts = compact.slice(1, -1).split(',');
    assert(parts.length === 512, 'compact literal has all 512 dimensions');
    let lossless = true;
    for (let i = 0; i < vec.length; i++) {
      if (Math.fround(Number(parts[i])) !== Math.fround(vec[i])) { lossless = false; break; }
    }
    assert(lossless, 'every component round-trips to the identical float32');

    // 3. Edge cases must not produce invalid literals.
    assert(toVectorLiteral([0, -0, 1, -1]).match(/^\[[-0-9.,eE]+\]$/) !== null, 'edge values produce a valid literal');
    const tiny = toVectorLiteral([1e-8, -1.5e-7]);
    assert(tiny.includes('e-'), 'tiny magnitudes keep scientific notation (not silently zeroed)');
  }

  // ── 10. Before/after: the exact regression scenario ───────────────────────

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
