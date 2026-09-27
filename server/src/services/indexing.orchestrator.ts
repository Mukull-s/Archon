import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import AdmZip from 'adm-zip';
import { prisma, MAX_FILES_LIMIT, MAX_CHUNKS_LIMIT, MAX_CONCURRENT_EMBEDDINGS } from '../config';
import { AppError } from '../utils';
import { getPlaintextToken } from '../utils/crypto';
import { ingestionService, deleteFolderWithRetry } from './ingestion.service';
import * as astService from './ast.service';
import { embeddingService } from './embedding.service';
import { BatchPipeline } from './indexing.pipeline';
import { vectorService } from './vector.service';
import { llmService } from './llm.service';
import { buildFileTreeString } from './chat.orchestrator';
import { estimateTokens, readBatchOptionsFromEnv } from './embedding.batching';
import { entitlementService } from './entitlement.service';
import { identityService } from './identity.service';
import { confidenceService } from './confidence.service';
import { queueService } from './queue.service';

/**
 * Calculates MD5 file hash for change detection during incremental re-indexing.
 */
export function hashFile(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Sanitizes strings for database insertion.
 */
export function cleanString(val: string): string {
  return val ? val.replace(/\u0000/g, '') : '';
}

/**
 * Parses the LLM's repository-summary response.
 *
 * The model is instructed to return raw JSON; if it returns fenced or prose
 * text instead, the text is preserved as `{ summary }` so the completion gate
 * still sees a present, displayable summary rather than failing the whole run.
 */
export function parseRepositorySummary(raw: string): Record<string, any> {
  if (!raw || typeof raw !== 'string') return { summary: String(raw ?? '') };
  let cleaned = raw.trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) cleaned = fence[1].trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {}
  return { summary: raw };
}

/**
 * Standalone asynchronous vector indexing runner.
 * Orchestrates download, extraction, AST discovery, bounded chunking, and streaming embedding.
 */
export async function performVectorIndexing(
  id: string,
  force = false,
  options?: { zipPath?: string; isNewAnalysis?: boolean; userId?: string }
): Promise<void> {
  function heapMB() { return Math.round(process.memoryUsage().heapUsed / 1024 / 1024); }
  function logStage(stage: string, durationMs?: number) {
    console.log(JSON.stringify({
      stage,
      heapMB: heapMB(),
      ...(durationMs !== undefined && { durationSec: parseFloat((durationMs / 1000).toFixed(2)) })
    }));
  }

  // Progressive stage state, persisted so the client's stage loader is driven by
  // real backend progress (Download -> Parse -> Embed -> Summary -> Done) rather
  // than a client-side timer.
  const stageState: Record<string, any> = { stage: 'download' };
  async function persistStage(progressText: string, patch: Record<string, any> = {}) {
    Object.assign(stageState, patch);
    await prisma.repository.update({
      where: { id },
      data: { indexingProgress: progressText, indexingStats: { ...stageState } as any }
    }).catch(() => {});
  }

  const startTime = Date.now();
  const tempDirsToCleanup: string[] = [];

  // Yield immediately so caller (HTTP request or queue worker) is unblocked
  await new Promise(resolve => setImmediate(resolve));

  try {
    const repoRow = await prisma.repository.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!repoRow) throw new AppError('Repository not found or access denied.', 404);

    if (options?.userId && repoRow.userId !== options.userId) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    // ── Stage 0: Commit SHA early-exit ────────────────────────────────────
    if (!force && repoRow.indexingStatus === 'completed' && repoRow.owner && !repoRow.isLocal) {
      try {
        const token = getPlaintextToken(repoRow.user?.githubToken) || process.env.GITHUB_FALLBACK_TOKEN;
        const headers: Record<string, string> = { 'User-Agent': 'Archon-Intelligence-Platform' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const shaRes = await (await import('axios')).default.get(
          `https://api.github.com/repos/${repoRow.owner}/${repoRow.name}/commits?per_page=1`,
          { headers, timeout: 8000 }
        );
        const latestSha: string = shaRes.data?.[0]?.sha ?? '';
        const storedSha: string = (repoRow as any).commitSha ?? '';
        if (latestSha && storedSha && latestSha === storedSha) {
          console.log(`[Indexing] Repo ${id} is already up-to-date (SHA: ${latestSha.slice(0, 8)}). Skipping.`);
          await prisma.repository.update({
            where: { id },
            data: { indexingStatus: 'completed', indexingProgress: 'Completed' }
          });
          return;
        }
        if (latestSha) {
          await prisma.repository.update({ where: { id }, data: { indexingProgress: 'Downloading' } });
          (repoRow as any)._latestSha = latestSha;
        }
      } catch (shaErr: any) {
        console.warn(`[Indexing] Could not fetch commit SHA (non-fatal): ${shaErr.message}`);
      }
    }

    await prisma.repository.update({
      where: { id },
      data: { indexingStatus: 'indexing', indexingProgress: repoRow.isLocal ? 'Parsing' : 'Downloading' }
    });

    // ── Stage 1: Download ─────────────────────────────────────────────────
    logStage('start');
    let zipPath = options?.zipPath;
    let downloadTime = 0;
    if (!repoRow.isLocal && !zipPath) {
      const t0 = Date.now();
      const token = getPlaintextToken(repoRow.user?.githubToken) || undefined;
      zipPath = await ingestionService.downloadGithubRepo(repoRow.owner!, repoRow.name, token);
      downloadTime = Date.now() - t0;
      tempDirsToCleanup.push(zipPath);
      logStage('download', downloadTime);
    }

    await new Promise(resolve => setImmediate(resolve));

    // ── Stage 2: Extraction ────────────────────────────────────────────────
    await persistStage('Parsing', { stage: 'extract' });

    const extractId = crypto.randomUUID();
    const extractPath = path.join(os.tmpdir(), 'archon-extracted', extractId);
    tempDirsToCleanup.push(extractPath);
    if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });

    const extractStart = Date.now();
    console.log(`[Indexing] Extracting ZIP: ${zipPath} to ${extractPath}...`);
    const zip = new AdmZip(zipPath!);
    const zipEntries = zip.getEntries();
    for (const entry of zipEntries) {
      const entryName = entry.entryName;
      if (entryName.includes('..') || path.isAbsolute(entryName) || /^[a-zA-Z]:/.test(entryName)) {
        throw new AppError('Security violation: ZIP archive contains illegal path traversal entries.', 400, 'SECURITY_VIOLATION');
      }
    }
    zip.extractAllTo(extractPath, true);
    const extractTime = Date.now() - extractStart;
    logStage('extract', extractTime);

    const extractedEntries = fs.readdirSync(extractPath);
    let repoRoot = extractPath;
    if (extractedEntries.length === 1 && fs.statSync(path.join(extractPath, extractedEntries[0])).isDirectory()) {
      repoRoot = path.join(extractPath, extractedEntries[0]);
    }

    // ── Stage 3: Discovery + Parsing ──────────────────────────────────────
    const INDEXABLE_EXTENSIONS = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
      '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.swift',
      '.kt', '.prisma', '.json', '.yml', '.yaml', '.toml'
    ]);
    const EXCLUDED_FILENAMES = new Set([
      '.gitignore', '.env', '.env.local', '.env.development',
      '.env.production', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'LICENSE', 'README.md', 'CHANGELOG.md'
    ]);
    const EXCLUDED_DIRS = new Set([
      'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out',
      'generated', '.cache', '__pycache__', 'venv', '.venv', 'target', 'vendor'
    ]);

    const scannedFiles: Array<{ path: string; size: number; lines: number; hash: string }> = [];
    const astMetadata: Record<string, any> = {};
    const symbolsCache = new Map<string, astService.CodeSymbol[]>();
    const contentCache = new Map<string, string>();
    const CONTENT_CACHE_MAX_BYTES = 32 * 1024 * 1024;
    let contentCacheBytes = 0;
    const PARSEABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);
    const languages = new Set<string>();
    let totalSize = 0;
    let fileIndex = 0;

    const parseStart = Date.now();
    const dirStack = [repoRoot];

    while (dirStack.length > 0 && scannedFiles.length < MAX_FILES_LIMIT) {
      const currentDir = dirStack.pop()!;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (scannedFiles.length >= MAX_FILES_LIMIT) break;
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            dirStack.push(fullPath);
          }
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (!INDEXABLE_EXTENSIONS.has(ext)) continue;
        if (EXCLUDED_FILENAMES.has(entry.name)) continue;

        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        if (stat.size > 500_000) continue; // Skip files > 500KB

        const detectedLang = identityService.detectLanguageByExtension(ext);
        if (detectedLang) languages.add(detectedLang);

        let buffer: Buffer;
        try {
          buffer = fs.readFileSync(fullPath);
        } catch {
          continue;
        }
        const content = buffer.toString('utf-8').replace(/\u0000/g, '');

        const lines = content.split('\n').length;
        // Hash from the buffer we already read — this removes a second filesystem read per file.
        const hash = crypto.createHash('md5').update(buffer).digest('hex');

        scannedFiles.push({ path: relativePath, size: stat.size, lines, hash });
        totalSize += stat.size;

        // Bounded content cache: lets the chunking stage reuse this read instead
        // of re-reading the file. Capped so a huge repo cannot exhaust memory.
        if (contentCacheBytes + buffer.length <= CONTENT_CACHE_MAX_BYTES) {
          contentCache.set(relativePath, content);
          contentCacheBytes += buffer.length;
        }

        // Single parse for both AST metadata and chunk symbols.
        if (PARSEABLE_EXTENSIONS.has(ext)) {
          try {
            const parsed = astService.parseSourceFileWithSymbols(relativePath, content);
            astMetadata[relativePath] = parsed.metadata;
            symbolsCache.set(relativePath, parsed.symbols);
          } catch {}
        }

        fileIndex++;
        if (fileIndex % 100 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    }

    const parseTime = Date.now() - parseStart;
    logStage('parse', parseTime);
    await persistStage('Parsing', { stage: 'parse', filesScanned: scannedFiles.length });

    // ── Stage 4: Dependency Graph + Identity ──────────────────────────────
    const fileList = scannedFiles.map(f => f.path);
    const dependencyGraph = astService.resolveDependencies(fileList, astMetadata);
    const identityResult = identityService.runIdentityEngine(repoRoot, scannedFiles, dependencyGraph);
    const framework = identityResult.framework;
    const entryPoints = identityResult.entryPoints;

    const { score } = confidenceService.calculateConfidence(
      scannedFiles as any,
      astMetadata,
      dependencyGraph,
      languages,
      framework
    );

    // ── Stage 5: Incremental Chunk Invalidation ───────────────────────────
    const oldFiles: Array<{ path: string; hash?: string }> = (typeof repoRow.scannedFiles === 'string'
      ? JSON.parse(repoRow.scannedFiles)
      : repoRow.scannedFiles) as any[] || [];

    const oldHashMap = new Map<string, string>();
    for (const f of oldFiles) { if (f.hash) oldHashMap.set(f.path, f.hash); }

    const newFilePaths = new Set(scannedFiles.map(f => f.path));
    const changedOrDeletedFiles = new Set<string>();

    for (const oldF of oldFiles) { if (!newFilePaths.has(oldF.path)) changedOrDeletedFiles.add(oldF.path); }
    for (const newF of scannedFiles) {
      if (oldHashMap.get(newF.path) !== newF.hash || force) changedOrDeletedFiles.add(newF.path);
    }

    const filesToEmbed = scannedFiles.filter(f => changedOrDeletedFiles.has(f.path));
    console.log(`[Indexing] ${scannedFiles.length} total files | ${filesToEmbed.length} changed/new (need embedding) | ${scannedFiles.length - filesToEmbed.length} unchanged`);

    if (changedOrDeletedFiles.size > 0 && !force) {
      await prisma.codeChunk.deleteMany({
        where: {
          repositoryId: id,
          filePath: { in: Array.from(changedOrDeletedFiles) }
        }
      });
    } else if (force) {
      await prisma.codeChunk.deleteMany({
        where: { repositoryId: id }
      });
    }

    // Persist scanned file metadata without raw content to prevent giant JSONB blobs (P1-4)
    await prisma.repository.update({
      where: { id },
      data: {
        framework,
        languages: Array.from(languages),
        entryPoints,
        importantFiles: entryPoints,
        fileCount: scannedFiles.length,
        totalSize,
        confidence: score,
        scannedFiles: scannedFiles.map(f => ({ path: f.path, size: f.size, lines: f.lines, hash: f.hash })) as any,
        astMetadata: astMetadata as any,
        dependencyGraph: dependencyGraph as any
      }
    });

    // ── Stage 6: Streaming Embedding Pipeline (Bounded, Concurrent) ───────
    // Status stays `indexing` until ALL batches are resolved AND the summary
    // is present. The UI renders nothing until `completed` (no half-data).
    await persistStage('Embedding 0%', { stage: 'embed', chunksTotal: 0 });

    // Summary generation runs in parallel with embeddings so it adds no serial
    // latency, but it is a required gate for completion.
    let summaryJson: Record<string, any> | null = null;
    let summaryError: any = null;
    const summaryPromise = (async () => {
      try {
        const fileTree = buildFileTreeString(scannedFiles);
        const raw = await llmService.generateRepositorySummary({
          name: repoRow.name,
          framework,
          languages: Array.from(languages),
          fileCount: scannedFiles.length,
          totalSize,
          fileTree
        });
        summaryJson = parseRepositorySummary(raw);
      } catch (err) {
        summaryError = err;
      }
    })();
    const embedTracker = embeddingService.createTracker();
    const unchangedChunksCount = force ? 0 : await prisma.codeChunk.count({ where: { repositoryId: id } });
    let totalChunksProcessed = 0;
    let filesProcessed = 0;
    let filesSkipped = 0;
    let truncatedByLimit = false;
    let pendingChunks: any[] = [];
    let pendingTokens = 0;
    const batchOptions = readBatchOptionsFromEnv();
    const quarantine: Array<{ items: any[]; texts: string[]; startIndex: number }> = [];
    let insertFailures = 0;
    let quarantineRecovered = 0;
    let quarantineFailed = 0;
    const embedStart = Date.now();

    // Embedding and persistence are decoupled: the embedding slot is released
    // as soon as the API call returns, so a DB insert overlaps the next embed.
    const embedConcurrency = Math.max(1, MAX_CONCURRENT_EMBEDDINGS);
    const pipeline = new BatchPipeline<any>({
      concurrency: embedConcurrency,
      maxOutstanding: embedConcurrency + 2,
      embed: (texts) => vectorService.getEmbeddingsBatch(texts, embedTracker),
      insert: (items, embeddings, startIndex) => {
        const readyChunks = items.map((c, j) => ({ ...c, embedding: embeddings[j] }));
        return vectorService.bulkInsertChunks(id, readyChunks, startIndex);
      },
      onEmbedError: (embedErr: any, batch) => {
        // Quarantine rather than drop: retried via the split path after drain.
        console.error(`[Indexing] Embedding batch failed; quarantined for retry: ${embedErr?.message || embedErr}`);
        quarantine.push({ items: batch.items, texts: batch.texts, startIndex: batch.startIndex });
      },
      onInsertError: (dbErr: any) => {
        console.error(`[Indexing] Chunk insert failed: ${dbErr?.message || dbErr}`);
        insertFailures += 1;
      }
    });

    function flushPendingChunks(): void {
      if (pendingChunks.length === 0) return;
      const batch = pendingChunks;
      pendingChunks = [];
      pendingTokens = 0;
      // Assign the global chunk index *before* dispatch so concurrent inserts
      // can never race on ordering.
      const startIndex = unchangedChunksCount + totalChunksProcessed;
      totalChunksProcessed += batch.length;
      pipeline.submit({ items: batch, texts: batch.map(c => c.content), startIndex });
    }

    let lastProgressWrite = Date.now();
    for (let fileIdx = 0; fileIdx < filesToEmbed.length; fileIdx++) {
      const file = filesToEmbed[fileIdx];
      const fullFilePath = path.join(repoRoot, file.path);

      let fileContent = contentCache.get(file.path);
      if (fileContent === undefined) {
        try {
          fileContent = fs.readFileSync(fullFilePath, 'utf-8').replace(/\u0000/g, '');
        } catch { filesSkipped++; continue; }
      }
      if (!fileContent.trim()) { filesSkipped++; continue; }

      const symbols = symbolsCache.get(file.path) ?? astService.getCodeSymbols(file.path, fileContent);
      const fileChunks = ingestionService.chunkCodeFile(file.path, fileContent, symbols);
      if (fileChunks.length === 0) { filesSkipped++; continue; }

      if (unchangedChunksCount + totalChunksProcessed + pendingChunks.length + fileChunks.length > MAX_CHUNKS_LIMIT) {
        console.warn(`[Indexing] Chunk limit (${MAX_CHUNKS_LIMIT}) reached. Stopping embedding (run will be incomplete).`);
        truncatedByLimit = true;
        break;
      }

      for (const chunk of fileChunks) {
        if (!chunk.content.trim()) continue;
        pendingChunks.push({
          filePath: file.path,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          symbolName: chunk.symbolName
        });
        pendingTokens += estimateTokens(chunk.content);

        // Token-aware sealing: seal on the estimated token budget OR the input
        // count ceiling, whichever binds first. This makes the ≤90k-token /
        // ≤96-input invariant explicit at the seal point (defense-in-depth keeps
        // the inner layer token-aware too).
        if (
          pendingChunks.length >= batchOptions.maxInputsPerRequest ||
          pendingTokens >= batchOptions.maxTokensPerRequest
        ) {
          await pipeline.waitForCapacity();
          flushPendingChunks();
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      filesProcessed++;
      const now = Date.now();
      if (fileIdx % 25 === 0 || now - lastProgressWrite >= 2000 || fileIdx === filesToEmbed.length - 1) {
        lastProgressWrite = now;
        const pct = filesToEmbed.length > 0 ? Math.round(((fileIdx + 1) / filesToEmbed.length) * 100) : 100;
        await persistStage(`Embedding ${pct}%`, {
          stage: 'embed',
          chunksTotal: unchangedChunksCount + totalChunksProcessed + pendingChunks.length,
          filesProcessed,
          filesEmbedded: filesToEmbed.length
        });
      }
    }

    if (pendingChunks.length > 0) flushPendingChunks();
    await pipeline.drain();

    // Quarantine recovery: retry failed batches one input at a time via the
    // split path. This is the last chance before the run is marked failed.
    if (quarantine.length > 0) {
      console.warn(`[Indexing] Retrying ${quarantine.length} quarantined batch(es) one input at a time...`);
      for (const q of quarantine) {
        for (let i = 0; i < q.items.length; i++) {
          try {
            const vecs = await vectorService.getEmbeddingsBatch([q.texts[i]], embedTracker);
            await vectorService.bulkInsertChunks(id, [{ ...q.items[i], embedding: vecs[0] }], q.startIndex + i);
            quarantineRecovered += 1;
          } catch (retryErr: any) {
            quarantineFailed += 1;
            console.error(`[Indexing] Quarantined chunk could not be embedded: ${retryErr?.message || retryErr}`);
          }
        }
      }
    }

    const totalBatches = pipeline.batchCount;
    const batchesResolved = pipeline.resolvedBatches + quarantineRecovered;
    const batchesFailed = pipeline.failedBatches + insertFailures + quarantineFailed;
    const dbWriteTime = pipeline.dbMs;
    const peakConcurrency = pipeline.peakEmbedConcurrency;
    logStage('embedding', Date.now() - embedStart);
    logStage('db-insert-total', dbWriteTime);

    // Await the parallel summary before deciding completion.
    await persistStage('Generating summary', { stage: 'summary' });
    await summaryPromise;
    const summaryPresent = !!summaryJson;

    // ── Stage 7: Completion gate ──────────────────────────────────────────
    // `completed` requires 100% of files processed, 100% of batches resolved,
    // and a present summary. Anything less is an explicit failure — never a
    // silent "partial" that would render half-data.
    const complete = !truncatedByLimit && batchesResolved === totalBatches && batchesFailed === 0 && summaryPresent;

    const failureReasons: string[] = [];
    if (truncatedByLimit) failureReasons.push('chunk limit reached');
    if (batchesFailed > 0) failureReasons.push(`${batchesFailed} batch(es) unresolved`);
    else if (batchesResolved !== totalBatches) failureReasons.push(`${totalBatches - batchesResolved} batch(es) missing`);
    if (!summaryPresent) failureReasons.push(`summary generation failed${summaryError ? ` (${summaryError.message || summaryError})` : ''}`);

    const latestSha = (repoRow as any)._latestSha;
    const embedMetrics = embedTracker.getMetrics();
    const indexingStats = {
      stage: complete ? 'done' : 'failed',
      files: scannedFiles.length,
      filesEmbedded: filesToEmbed.length,
      filesProcessed,
      filesSkipped,
      chunks: unchangedChunksCount + totalChunksProcessed,
      batches: totalBatches,
      batchesResolved,
      batchesFailed,
      quarantined: quarantine.length,
      quarantineRecovered,
      quarantineFailed,
      summaryPresent,
      truncatedByLimit,
      apiMs: embedMetrics.totalLatencyMs,
      backoffMs: embedMetrics.totalBackoffMs,
      dbMs: dbWriteTime,
      embedWallMs: Date.now() - embedStart,
      retries: embedMetrics.retries,
      rateLimits: embedMetrics.rateLimitResponses,
      timeouts: embedMetrics.timeoutResponses,
      peakConcurrency
    };
    await prisma.repository.update({
      where: { id },
      data: complete
        ? {
            indexingStatus: 'completed',
            indexingProgress: 'Completed',
            indexingStats: indexingStats as any,
            ...(summaryJson ? { aiSummary: summaryJson as any } : {})
          }
        : {
            indexingStatus: 'failed',
            indexingProgress: `Error: incomplete index (${failureReasons.join('; ')})`,
            indexingStats: indexingStats as any
          }
    });

    if (complete && repoRow.userId) {
      if (options?.isNewAnalysis) {
        await entitlementService.recordCodebaseAnalysis(repoRow.userId);
      } else if (force) {
        await entitlementService.recordReindex(repoRow.userId, id);
      }
    }

    if (latestSha) {
      try {
        await prisma.$executeRaw`UPDATE "Repository" SET "commitSha" = ${latestSha} WHERE id = ${id}`;
      } catch {}
    }

    const totalTime = Date.now() - startTime;
    logStage('complete', totalTime);

    const totalCalls = embedMetrics.successfulCalls + embedMetrics.failedCalls;
    const avgLatency = totalCalls > 0 ? Math.round(embedMetrics.totalLatencyMs / totalCalls) : 0;

    console.log(`\n==================================================`);
    console.log(`[Benchmark] Indexing Finished`);
    console.log(`Repository: ${repoRow.name}`);
    console.log(`Files: ${scannedFiles.length}`);
    console.log(`Chunks: ${unchangedChunksCount + totalChunksProcessed}`);
    console.log(`Embedding Batches Dispatched: ${totalBatches} (concurrency ${embedConcurrency}, peak ${peakConcurrency})`);
    console.log(`Batches Resolved: ${batchesResolved}/${totalBatches} | Failed: ${batchesFailed} | Quarantined: ${quarantine.length} (recovered ${quarantineRecovered})`);
    console.log(`Summary Present: ${summaryPresent}`);
    console.log(`Index Status: ${complete ? 'completed' : `failed (${failureReasons.join('; ')})`}`);
    console.log(`Successful API Calls: ${embedMetrics.successfulCalls}`);
    console.log(`Failed API Calls: ${embedMetrics.failedCalls}`);
    console.log(`Retry Attempts: ${embedMetrics.retries}`);
    console.log(`Rate Limit (429) Responses: ${embedMetrics.rateLimitResponses}`);
    console.log(`Timeout Responses: ${embedMetrics.timeoutResponses}`);
    console.log(`Total Backoff Sleep Time: ${(embedMetrics.totalBackoffMs / 1000).toFixed(2)}s`);
    console.log(`Actual API Call Latency: ${(embedMetrics.totalLatencyMs / 1000).toFixed(2)}s`);
    console.log(`Average API Latency: ${avgLatency}ms`);
    console.log(`Total Index Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`==================================================\n`);

  } catch (error: any) {
    console.error(`[Indexing] Failed to index repository ${id}:`, error.stack || error);
    if (!(error instanceof AppError && error.statusCode === 404)) {
      await prisma.repository.update({
        where: { id },
        data: { indexingStatus: 'failed', indexingProgress: `Error: ${error.message || 'Unknown error'}` }
      }).catch(updateErr => console.error('[Indexing] Failed to update repo status:', updateErr));
    }
    throw error;
  } finally {
    logStage('cleanup');
    for (const dir of tempDirsToCleanup) {
      if (fs.existsSync(dir)) {
        try {
          if (fs.statSync(dir).isDirectory()) await deleteFolderWithRetry(dir);
          else fs.unlinkSync(dir);
        } catch (cleanupErr) {
          console.error(`[Indexing] Cleanup failed for ${dir}:`, cleanupErr);
        }
      }
    }
    logStage('cleanup-done');
  }
}

// Register durable queue job handler for vector indexing
queueService.registerHandler('VECTOR_INDEX', async (job) => {
  await performVectorIndexing(job.repositoryId, job.payload.force ?? false, {
    zipPath: job.payload.zipPath,
    isNewAnalysis: job.payload.isNewAnalysis ?? false,
    userId: job.userId
  });
});
