import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import AdmZip from 'adm-zip';
import { prisma, MAX_FILES_LIMIT, MAX_CHUNKS_LIMIT, EMBEDDING_BATCH_SIZE, MAX_CONCURRENT_EMBEDDINGS } from '../config';
import { AppError } from '../utils';
import { getPlaintextToken } from '../utils/crypto';
import { ingestionService, deleteFolderWithRetry } from './ingestion.service';
import * as astService from './ast.service';
import { embeddingService } from './embedding.service';
import { AsyncSemaphore } from './concurrency';
import { vectorService } from './vector.service';
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
    await prisma.repository.update({ where: { id }, data: { indexingProgress: 'Parsing' } });

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

    // ── Structural phase complete ─────────────────────────────────────────
    // Everything the Explorer / Insights / Graph / Architecture tabs need is
    // now persisted. Unlock the product immediately; embeddings continue in
    // the background and only affect RAG quality.
    await prisma.repository.update({
      where: { id },
      data: { indexingStatus: 'structural-ready', indexingProgress: 'Embedding 0%' }
    });

    // ── Stage 6: Streaming Embedding Pipeline (Bounded, Concurrent Buffer) ─
    const embedTracker = embeddingService.createTracker();
    const unchangedChunksCount = force ? 0 : await prisma.codeChunk.count({ where: { repositoryId: id } });
    let totalChunksProcessed = 0;
    let totalBatches = 0;
    let pendingChunks: any[] = [];
    let embeddingFailed = false;
    let embedTime = 0;
    let dbWriteTime = 0;
    const embedStart = Date.now();

    // Bounded concurrent flush pool. Embedding + insert for independent batches
    // overlap instead of running strictly one-at-a-time.
    const embedConcurrency = Math.max(1, MAX_CONCURRENT_EMBEDDINGS);
    const embedLimiter = new AsyncSemaphore(embedConcurrency);
    const inFlight: Promise<void>[] = [];
    let peakConcurrency = 0;

    async function processBatch(batch: any[], startIndex: number): Promise<void> {
      peakConcurrency = Math.max(peakConcurrency, embedLimiter.active);
      const batchTexts = batch.map(c => c.content);
      const t0 = Date.now();
      let embeddings: number[][];
      try {
        embeddings = await vectorService.getEmbeddingsBatch(batchTexts, embedTracker);
        embedTime += Date.now() - t0;
      } catch (embedErr: any) {
        console.error(`[Indexing] Embedding batch failed (graceful degradation): ${embedErr.message}`);
        embeddingFailed = true;
        return;
      }

      const readyChunks = batch.map((c, j) => ({ ...c, embedding: embeddings[j] }));
      const dbT0 = Date.now();
      await vectorService.bulkInsertChunks(id, readyChunks, startIndex);
      dbWriteTime += Date.now() - dbT0;
    }

    function flushPendingChunks(): void {
      if (pendingChunks.length === 0) return;
      const batch = pendingChunks;
      pendingChunks = [];
      // Assign the global chunk index *before* dispatching so concurrent
      // inserts can never race on ordering.
      const startIndex = unchangedChunksCount + totalChunksProcessed;
      totalChunksProcessed += batch.length;
      totalBatches += 1;

      const task = embedLimiter.run(() => processBatch(batch, startIndex)).catch(err => {
        console.error(`[Indexing] Unexpected embedding pipeline error: ${err?.message || err}`);
        embeddingFailed = true;
      });
      inFlight.push(task);
      void task.finally(() => {
        const idx = inFlight.indexOf(task);
        if (idx >= 0) inFlight.splice(idx, 1);
      });
    }

    async function drainInFlight(): Promise<void> {
      while (inFlight.length > 0) {
        await Promise.all(inFlight.slice());
      }
    }

    let lastProgressWrite = Date.now();
    for (let fileIdx = 0; fileIdx < filesToEmbed.length; fileIdx++) {
      const file = filesToEmbed[fileIdx];
      const fullFilePath = path.join(repoRoot, file.path);

      let fileContent = contentCache.get(file.path);
      if (fileContent === undefined) {
        try {
          fileContent = fs.readFileSync(fullFilePath, 'utf-8').replace(/\u0000/g, '');
        } catch { continue; }
      }
      if (!fileContent.trim()) continue;

      const symbols = symbolsCache.get(file.path) ?? astService.getCodeSymbols(file.path, fileContent);
      const fileChunks = ingestionService.chunkCodeFile(file.path, fileContent, symbols);
      if (fileChunks.length === 0) continue;

      if (unchangedChunksCount + totalChunksProcessed + pendingChunks.length + fileChunks.length > MAX_CHUNKS_LIMIT) {
        console.warn(`[Indexing] Chunk limit (${MAX_CHUNKS_LIMIT}) approaching. Stopping embedding.`);
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

        if (pendingChunks.length >= EMBEDDING_BATCH_SIZE) {
          // Back-pressure: wait for a slot before dispatching the next batch.
          if (inFlight.length >= embedConcurrency) {
            await Promise.race(inFlight);
          }
          flushPendingChunks();
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      const now = Date.now();
      if (fileIdx % 25 === 0 || now - lastProgressWrite >= 2000 || fileIdx === filesToEmbed.length - 1) {
        lastProgressWrite = now;
        const pct = filesToEmbed.length > 0 ? Math.round(((fileIdx + 1) / filesToEmbed.length) * 100) : 100;
        await prisma.repository.update({ where: { id }, data: { indexingProgress: `Embedding ${pct}%` } });
      }
    }

    if (pendingChunks.length > 0) flushPendingChunks();
    await drainInFlight();
    logStage('embedding', Date.now() - embedStart);
    logStage('db-insert-total', dbWriteTime);

    await prisma.repository.update({ where: { id }, data: { indexingProgress: 'Saving 92%' } });

    // ── Stage 7: Finalize ─────────────────────────────────────────────────
    const latestSha = (repoRow as any)._latestSha;
    const embedMetrics = embedTracker.getMetrics();
    const indexingStats = {
      files: scannedFiles.length,
      filesEmbedded: filesToEmbed.length,
      chunks: unchangedChunksCount + totalChunksProcessed,
      batches: totalBatches,
      apiMs: embedMetrics.totalLatencyMs,
      backoffMs: embedMetrics.totalBackoffMs,
      dbMs: dbWriteTime,
      embedWallMs: Date.now() - embedStart,
      retries: embedMetrics.retries,
      rateLimits: embedMetrics.rateLimitResponses,
      timeouts: embedMetrics.timeoutResponses,
      peakConcurrency,
      failed: embeddingFailed
    };
    await prisma.repository.update({
      where: { id },
      data: {
        indexingStatus: 'completed',
        indexingProgress: embeddingFailed ? 'Completed (partial — some embeddings failed)' : 'Completed',
        indexingStats: indexingStats as any
      }
    });

    if (repoRow.userId) {
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
