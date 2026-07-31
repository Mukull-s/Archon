import { Request, Response, NextFunction } from 'express';
import { prisma, EMBEDDING_BATCH_SIZE, DB_BATCH_SIZE, MAX_FILES_LIMIT, MAX_TOTAL_SIZE_LIMIT, MAX_SINGLE_FILE_SIZE_LIMIT, MAX_CHUNKS_LIMIT } from '../config';
import { ingestionService, deleteFolderWithRetry } from '../services/ingestion.service';
import { AppError } from '../utils';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import { vectorService } from '../services/vector.service';
import { llmService } from '../services/llm.service';
import * as astService from '../services/ast.service';
import crypto from 'crypto';
import { hierarchyService } from '../services/hierarchy.service';
import { confidenceService } from '../services/confidence.service';
import { evidenceService } from '../services/evidence.service';
import { insightService } from '../services/insight.service';
import { plannerService } from '../services/planner.service';
import { storyService } from '../services/story.service';
import { onboardingService } from '../services/onboarding.service';
import { identityService } from '../services/identity.service';

/**
 * Parses a GitHub repository URL to extract owner and repository name.
 */
function parseGithubUrl(url: string): { owner: string; repo: string } {
  try {
    const cleaned = url.trim().replace(/\/$/, ''); // Remove trailing slash
    const regex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/i;
    const match = cleaned.match(regex);
    if (!match) {
      throw new AppError('Invalid GitHub URL format. Example: https://github.com/owner/repository', 400);
    }
    return { owner: match[1], repo: match[2] };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to parse GitHub URL. Ensure it matches github.com/owner/repo', 400);
  }
}

/**
 * Helper to convert file path list into tree structure string for system prompt context.
 */
function buildFileTreeString(scannedFiles: Array<{ path: string }>): string {
  const paths = scannedFiles.map(f => f.path);
  paths.sort();
  return paths.map(p => `- ${p}`).join('\n');
}

/**
 * Helper to recursively search a dependency graph in reverse order to map dependent nodes.
 */
function findAffectedFiles(targetFile: string, dependencyGraph: Record<string, string[]>): string[] {
  const affected = new Set<string>();
  const queue: string[] = [targetFile];
  const visited = new Set<string>();

  // Build reverse graph: key is target, value is list of files that import key
  const reverseGraph: Record<string, string[]> = {};
  for (const [filePath, imports] of Object.entries(dependencyGraph)) {
    for (const imp of imports) {
      const normalizedImp = imp.replace(/\\/g, '/');
      const normalizedFilePath = filePath.replace(/\\/g, '/');
      if (!reverseGraph[normalizedImp]) {
        reverseGraph[normalizedImp] = [];
      }
      reverseGraph[normalizedImp].push(normalizedFilePath);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!.replace(/\\/g, '/');
    if (visited.has(current)) continue;
    visited.add(current);

    const dependents = reverseGraph[current] || [];
    for (const dep of dependents) {
      const normalizedDep = dep.replace(/\\/g, '/');
      if (!affected.has(normalizedDep)) {
        affected.add(normalizedDep);
        queue.push(normalizedDep);
      }
    }
  }

  return Array.from(affected);
}

/**
 * Scan a public GitHub URL.
 */
export async function scanPublicRepo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { url } = req.body;
    if (!url) {
      throw new AppError('GitHub repository URL is required.', 400);
    }
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized access.', 401);
    }
    const { owner, repo } = parseGithubUrl(url);

    // Check if repository already exists for this user to avoid duplicates
    let repository = await prisma.repository.findFirst({
      where: { userId, owner, name: repo }
    });

    if (repository) {
      if (repository.indexingStatus === 'indexing') {
        res.status(200).json({
          success: true,
          message: 'Repository is already indexing in the background.',
          data: repository
        });
        return;
      }
      // Set status to indexing, progress to Downloading
      repository = await prisma.repository.update({
        where: { id: repository.id },
        data: {
          indexingStatus: 'indexing',
          indexingProgress: 'Downloading',
          // Reset other fields for fresh scan
          framework: null,
          languages: [],
          entryPoints: [],
          importantFiles: [],
          fileCount: 0,
          totalSize: 0,
          confidence: 0
        }
      });
    } else {
      // Create new repository
      repository = await prisma.repository.create({
        data: {
          userId,
          owner,
          name: repo,
          isLocal: false,
          framework: null,
          languages: [],
          entryPoints: [],
          importantFiles: [],
          fileCount: 0,
          totalSize: 0,
          confidence: 0,
          indexingStatus: 'indexing',
          indexingProgress: 'Downloading'
        }
      });
    }

    // Trigger background vector indexing asynchronously
    performVectorIndexing(repository.id, false).catch(err => {
      console.error(`[Background Indexing] Failed for repo ${repository!.id}:`, err);
    });

    res.status(201).json({
      success: true,
      message: 'Repository registration successful. Indexing started in background.',
      data: repository
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Scan an uploaded ZIP file.
 */
export async function scanLocalZip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('No repository ZIP file uploaded.', 400);
    }
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized access.', 401);
    }

    const repoName = path.parse(file.originalname).name;
    const zipPath = file.path;

    // Check if repository already exists for this user
    let repository = await prisma.repository.findFirst({
      where: { userId, name: repoName, isLocal: true }
    });

    if (repository) {
      if (repository.indexingStatus === 'indexing') {
        res.status(200).json({
          success: true,
          message: 'Repository is already indexing in the background.',
          data: repository
        });
        return;
      }
      repository = await prisma.repository.update({
        where: { id: repository.id },
        data: {
          indexingStatus: 'indexing',
          indexingProgress: 'Parsing',
          framework: null,
          languages: [],
          entryPoints: [],
          importantFiles: [],
          fileCount: 0,
          totalSize: 0,
          confidence: 0
        }
      });
    } else {
      repository = await prisma.repository.create({
        data: {
          userId,
          owner: null,
          name: repoName,
          isLocal: true,
          framework: null,
          languages: [],
          entryPoints: [],
          importantFiles: [],
          fileCount: 0,
          totalSize: 0,
          confidence: 0,
          indexingStatus: 'indexing',
          indexingProgress: 'Parsing'
        }
      });
    }

    // Trigger background vector indexing passing the local zip path
    performVectorIndexing(repository.id, false, { zipPath }).catch(err => {
      console.error(`[Background Indexing] Failed for local repo ${repository!.id}:`, err);
    });

    res.status(201).json({
      success: true,
      message: 'ZIP upload successful. Indexing started in background.',
      data: repository
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets the list of repositories cached by the user.
 */
export async function listUserRepos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repos = await prisma.repository.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        owner: true,
        isLocal: true,
        framework: true,
        languages: true,
        fileCount: true,
        totalSize: true,
        confidence: true,
        indexingStatus: true,
        indexingProgress: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: repos });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves the detailed repository index.
 */
export async function getRepoDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    let repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: {
        id: true, name: true, owner: true, isLocal: true, framework: true,
        languages: true, fileCount: true, totalSize: true, confidence: true,
        scannedFiles: true, astMetadata: true, dependencyGraph: true,
        entryPoints: true, indexingStatus: true, indexingProgress: true,
        aiSummary: true,
        createdAt: true, updatedAt: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    // Auto-fail stale indexing jobs (e.g., if process crashed/killed due to memory limits)
    if (repo.indexingStatus === 'indexing') {
      const StaleTimeout = 10 * 60 * 1000; // 10 minutes
      const timeSinceUpdate = Date.now() - new Date(repo.updatedAt).getTime();
      if (timeSinceUpdate > StaleTimeout) {
        repo = await prisma.repository.update({
          where: { id: repo.id },
          data: {
            indexingStatus: 'failed',
            indexingProgress: 'Error: Indexing timed out. The server process may have run out of memory or restarted.'
          },
          select: {
            id: true, name: true, owner: true, isLocal: true, framework: true,
            languages: true, fileCount: true, totalSize: true, confidence: true,
            scannedFiles: true, astMetadata: true, dependencyGraph: true,
            entryPoints: true, indexingStatus: true, indexingProgress: true,
            aiSummary: true,
            createdAt: true, updatedAt: true
          }
        });
      }
    }

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as any[];

    const astMetadata = (typeof repo.astMetadata === 'string'
      ? JSON.parse(repo.astMetadata)
      : repo.astMetadata) as Record<string, any>;

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]>;

    const confidenceDetails = confidenceService.calculateConfidence(
      scannedFiles,
      astMetadata,
      dependencyGraph,
      repo.languages,
      repo.framework
    );

    const chunkCount = await prisma.codeChunk.count({
      where: { repositoryId: id as string }
    });
    const isIndexed = chunkCount > 0;

    res.status(200).json({
      success: true,
      data: {
        ...repo,
        isIndexed,
        confidenceDetails
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Calculates dependencies, affected routes, modules, and risk score for a selected file.
 * Automatically generates a human-friendly LLM explanation of the impact.
 */
export async function analyzeImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { filePath } = req.body;
    if (!filePath) {
      throw new AppError('Target filePath is required.', 400);
    }
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: { id: true, dependencyGraph: true }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]>;

    const normalizedTarget = filePath.replace(/\\/g, '/');

    // Retrieve file content from CodeChunks
    const chunks = await prisma.codeChunk.findMany({
      where: {
        repositoryId: id as string,
        filePath: normalizedTarget
      },
      orderBy: { startLine: 'asc' }
    });
    const fileContent = chunks.map(c => c.content).join('\n');

    const riskInfo = astService.computeImpactRisk(normalizedTarget, dependencyGraph, fileContent);
    const affectedFiles = riskInfo.affectedFiles;

    const affectedRoutes: string[] = [];
    const affectedServices: string[] = [];
    const affectedControllers: string[] = [];
    const affectedComponents: string[] = [];
    const otherFiles: string[] = [];

    for (const f of affectedFiles) {
      const lower = f.toLowerCase();
      if (lower.includes('route') || lower.includes('/routes/')) {
        affectedRoutes.push(f);
      } else if (lower.includes('service') || lower.includes('/services/')) {
        affectedServices.push(f);
      } else if (lower.includes('controller') || lower.includes('/controllers/')) {
        affectedControllers.push(f);
      } else if (lower.includes('component') || lower.includes('/components/')) {
        affectedComponents.push(f);
      } else {
        otherFiles.push(f);
      }
    }

    // Generate high-level impact summary explanation via LLM
    let summary = 'This file has no dependent files. Changing it is safe and will not impact other parts of the codebase.';
    if (affectedFiles.length > 0) {
      try {
        const prompt = `Explain in 1 or 2 simple, friendly sentences the structural impact of modifying the file [${normalizedTarget}]. 
It is directly or indirectly imported by these files:
${affectedFiles.map(f => `- [${f}]`).join('\n')}

Explain WHY modifying this file propagates to these dependencies. Keep it short, high-level, and easy for a beginner to understand.`;
        
        const aiSummary = await llmService.chat({
          prompt,
          contextChunks: [],
          model: 'qwen/qwen3-coder:free'
        });
        summary = aiSummary.text;
      } catch (err) {
        summary = `Modifying this file will propagate changes to ${affectedFiles.length} dependent files across your project.`;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        filePath: normalizedTarget,
        riskLevel: riskInfo.riskLevel,
        riskScore: riskInfo.riskScore,
        inDegree: riskInfo.inDegree,
        maxDepth: riskInfo.maxDepth,
        affectedFilesCount: affectedFiles.length,
        affectedFiles,
        dbModels: riskInfo.dbModels,
        envVars: riskInfo.envVars,
        categories: {
          routes: affectedRoutes,
          services: affectedServices,
          controllers: affectedControllers,
          components: affectedComponents,
          others: otherFiles
        },
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Standalone asynchronous vector indexing runner.
 * Automatically checks if repository is already indexed to return instantly unless force is true.
 */
export async function performVectorIndexing(id: string, force = false, options?: { zipPath?: string }): Promise<void> {
  // ── Metrics helpers ───────────────────────────────────────────────────────
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

  // Yield immediately so the HTTP response is sent before we start heavy work
  await new Promise(resolve => setImmediate(resolve));

  try {
    const repoRow = await prisma.repository.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!repoRow) throw new AppError('Repository not found.', 404);

    // ── Stage 0: Commit SHA early-exit ────────────────────────────────────
    // If the repo is GitHub-hosted and already completed, check the latest commit SHA.
    // If it matches the stored SHA, return immediately without re-indexing.
    if (!force && repoRow.indexingStatus === 'completed' && repoRow.owner && !repoRow.isLocal) {
      try {
        const token = repoRow.user?.githubToken || process.env.GITHUB_FALLBACK_TOKEN;
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
        // Store latest SHA for future comparisons (best-effort, non-breaking)
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
      const token = repoRow.user?.githubToken || undefined;
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
    const languages = new Set<string>();
    let totalSize = 0;
    let fileIndex = 0;

    const parseStart = Date.now();

    // Iterative (stack-based) walk to avoid deep recursion stack overflows
    const dirStack: string[] = [repoRoot];
    while (dirStack.length > 0 && scannedFiles.length < MAX_FILES_LIMIT) {
      const dirPath = dirStack.pop()!;
      let entries: string[];
      try { entries = fs.readdirSync(dirPath); } catch { continue; }

      for (const file of entries) {
        if (scannedFiles.length >= MAX_FILES_LIMIT) break;

        const fullPath = path.join(dirPath, file);
        let stat: fs.Stats;
        try { stat = fs.statSync(fullPath); } catch { continue; }

        if (stat.isDirectory()) {
          if (!EXCLUDED_DIRS.has(file)) dirStack.push(fullPath);
          continue;
        }

        if (!stat.isFile()) continue;
        if (EXCLUDED_FILENAMES.has(file)) continue;
        const ext = path.extname(file).toLowerCase();
        if (!INDEXABLE_EXTENSIONS.has(ext)) continue;
        if (stat.size > MAX_SINGLE_FILE_SIZE_LIMIT) continue;
        if (totalSize + stat.size > MAX_TOTAL_SIZE_LIMIT) break;

        try {
          let content = fs.readFileSync(fullPath, 'utf-8').replace(/\u0000/g, '');
          if (!content.trim()) continue;

          totalSize += stat.size;
          const lang = identityService.detectLanguageByExtension(ext);
          if (lang) languages.add(lang);

          const fileHash = crypto.createHash('sha256').update(content).digest('hex');
          const relativePath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');

          scannedFiles.push({ path: relativePath, size: stat.size, lines: content.split('\n').length, hash: fileHash });

          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            astMetadata[relativePath] = astService.parseSourceFile(relativePath, content);
          }

          // Yield event loop every 50 files to prevent blocking
          fileIndex++;
          if (fileIndex % 50 === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        } catch (err) {
          console.error(`[Indexing] Failed to read ${path.relative(repoRoot, fullPath)}:`, err);
        }
      }
    }

    const parseTime = Date.now() - parseStart;
    logStage('parse', parseTime);

    // Real progress: Discovery complete = 30%
    await prisma.repository.update({ where: { id }, data: { indexingProgress: 'Parsed 30%' } });
    await new Promise(resolve => setImmediate(resolve));

    // ── Stage 4: Dependency resolution + Identity ──────────────────────────
    const fileList = scannedFiles.map(f => f.path);
    const dependencyGraph = astService.resolveDependencies(fileList, astMetadata);
    const identityResult = identityService.runIdentityEngine(repoRoot, scannedFiles, dependencyGraph);
    const framework = identityResult.framework;
    const entryPoints = identityResult.entryPoints;

    const { score } = confidenceService.calculateConfidence(
      scannedFiles, astMetadata, dependencyGraph, languages, framework
    );

    // ── Stage 5: Incremental diff vs stored scannedFiles ──────────────────
    const oldFiles = (typeof repoRow.scannedFiles === 'string'
      ? JSON.parse(repoRow.scannedFiles)
      : repoRow.scannedFiles) as Array<{ path: string; hash?: string }> || [];

    const oldHashMap = new Map<string, string>();
    for (const f of oldFiles) { if (f.path && f.hash) oldHashMap.set(f.path, f.hash); }

    const newFilePaths = new Set(scannedFiles.map(f => f.path));
    const changedOrDeletedFiles = new Set<string>();
    for (const oldF of oldFiles) { if (!newFilePaths.has(oldF.path)) changedOrDeletedFiles.add(oldF.path); }
    for (const newF of scannedFiles) {
      if (oldHashMap.get(newF.path) !== newF.hash || force) changedOrDeletedFiles.add(newF.path);
    }

    // Only files that changed need re-embedding
    const filesToEmbed = scannedFiles.filter(f => changedOrDeletedFiles.has(f.path));
    console.log(`[Indexing] ${scannedFiles.length} total files | ${filesToEmbed.length} changed/new (need embedding) | ${scannedFiles.length - filesToEmbed.length} unchanged`);

    // Clean stale chunks
    if (changedOrDeletedFiles.size > 0 && !force) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "CodeChunk" WHERE "repositoryId" = $1 AND "filePath" = ANY($2)`,
        id, Array.from(changedOrDeletedFiles)
      );
    } else if (force) {
      await prisma.$executeRawUnsafe(`DELETE FROM "CodeChunk" WHERE "repositoryId" = $1`, id);
    }

    // Persist scanned file metadata to DB early
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

    // ── Stage 6: Streaming Embedding Pipeline (Bounded Buffer) ────────────
    const unchangedChunksCount = force ? 0 : await prisma.codeChunk.count({ where: { repositoryId: id } });
    let totalChunksProcessed = 0;
    let pendingChunks: any[] = []; // Bounded streaming buffer
    let embeddingFailed = false;
    let embedTime = 0;
    let dbWriteTime = 0;
    const embedStart = Date.now();

    // Helper: flush the bounded buffer — embed + insert immediately, then clear
    async function flushPendingChunks() {
      if (pendingChunks.length === 0) return;
      const batch = pendingChunks;
      pendingChunks = []; // Free memory immediately before awaiting

      const batchTexts = batch.map(c => c.content);
      const t0 = Date.now();
      let embeddings: number[][];
      try {
        embeddings = await vectorService.getEmbeddingsBatch(batchTexts);
        embedTime += Date.now() - t0;
      } catch (embedErr: any) {
        console.error(`[Indexing] Embedding batch failed (graceful degradation): ${embedErr.message}`);
        embeddingFailed = true;
        return; // Skip insert, continue to next batch
      }

      const readyChunks = batch.map((c, j) => ({ ...c, embedding: embeddings[j] }));
      const dbT0 = Date.now();
      await vectorService.bulkInsertChunks(id, readyChunks, unchangedChunksCount + totalChunksProcessed);
      dbWriteTime += Date.now() - dbT0;
      totalChunksProcessed += readyChunks.length;
    }

    for (let fileIdx = 0; fileIdx < filesToEmbed.length; fileIdx++) {
      const file = filesToEmbed[fileIdx];
      const fullFilePath = path.join(repoRoot, file.path);

      let fileContent = '';
      try {
        fileContent = fs.readFileSync(fullFilePath, 'utf-8').replace(/\u0000/g, '');
      } catch { continue; }
      if (!fileContent.trim()) continue;

      const symbols = astService.getCodeSymbols(file.path, fileContent);
      const fileChunks = ingestionService.chunkCodeFile(file.path, fileContent, symbols);
      if (fileChunks.length === 0) continue;

      if (unchangedChunksCount + totalChunksProcessed + pendingChunks.length + fileChunks.length > MAX_CHUNKS_LIMIT) {
        console.warn(`[Indexing] Chunk limit (${MAX_CHUNKS_LIMIT}) approaching. Stopping embedding.`);
        break;
      }

      for (const chunk of fileChunks) {
        if (!chunk.content.trim()) continue; // Skip empty chunks
        pendingChunks.push({
          filePath: file.path,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          symbolName: chunk.symbolName
        });

        // Flush whenever buffer fills up — memory stays bounded
        if (pendingChunks.length >= EMBEDDING_BATCH_SIZE) {
          await flushPendingChunks();
          await new Promise(resolve => setImmediate(resolve)); // Yield event loop
        }
      }

      // Real progress: Embedding phase = 40% to 90% based on files processed
      if (fileIdx % 10 === 0 || fileIdx === filesToEmbed.length - 1) {
        const pct = Math.round(40 + ((fileIdx + 1) / filesToEmbed.length) * 50);
        await prisma.repository.update({ where: { id }, data: { indexingProgress: `Embedding ${pct}%` } });
      }
    }

    // Flush any remaining chunks
    if (pendingChunks.length > 0) await flushPendingChunks();
    logStage('embedding', Date.now() - embedStart);
    logStage('db-insert-total', dbWriteTime);

    // Real progress: 92% — starting summary
    await prisma.repository.update({ where: { id }, data: { indexingProgress: 'Saving 92%' } });

    // ── Stage 7: AI Repository Summary ────────────────────────────────────
    let readmeText = '';
    for (const rp of ['README.md', 'readme.md', 'README', 'readme']) {
      const p = path.join(repoRoot, rp);
      if (fs.existsSync(p)) { try { readmeText = fs.readFileSync(p, 'utf-8').slice(0, 5000); break; } catch {} }
    }
    let pkgJsonText = '';
    const pkgPath = path.join(repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) { try { pkgJsonText = fs.readFileSync(pkgPath, 'utf-8').slice(0, 3000); } catch {} }

    const fileTreeStr = scannedFiles
      .map(f => f.path).slice(0, 100).join('\n') + (scannedFiles.length > 100 ? '\n... (truncated)' : '');

    let aiSummaryObj: any = null;
    const summaryT0 = Date.now();
    try {
      console.log(`[Indexing] Generating AI Repository Summary...`);
      const summaryText = await llmService.generateRepositorySummary({
        name: repoRow.name, framework: framework || null,
        languages: Array.from(languages), fileCount: scannedFiles.length,
        totalSize, readme: readmeText, packageJson: pkgJsonText, fileTree: fileTreeStr
      });
      let cleaned = summaryText.trim();
      if (cleaned.startsWith('```')) {
        const lines = cleaned.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        cleaned = lines.join('\n').trim();
      }
      aiSummaryObj = JSON.parse(cleaned);
      console.log(`[Indexing] AI Summary generated in ${Date.now() - summaryT0}ms`);
    } catch (summaryErr: any) {
      console.error('[Indexing] AI summary failed (non-fatal):', summaryErr.message);
    }
    logStage('summary', Date.now() - summaryT0);

    // ── Stage 8: Finalize ─────────────────────────────────────────────────
    const latestSha = (repoRow as any)._latestSha;
    await prisma.repository.update({
      where: { id },
      data: {
        indexingStatus: 'completed',
        indexingProgress: embeddingFailed ? 'Completed (partial — some embeddings failed)' : 'Completed',
        aiSummary: aiSummaryObj || undefined,
        ...(latestSha ? { indexingProgress: 'Completed' } : {})
      }
    });

    // If we fetched a latest SHA, try to persist it (best-effort, ignores schema errors)
    if (latestSha) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "Repository" SET "commitSha" = $1 WHERE id = $2`, latestSha, id);
      } catch {} // Column may not exist yet — not fatal
    }

    const totalTime = Date.now() - startTime;
    logStage('complete', totalTime);
    console.log(`[Indexing] ✅ Repo ${id} — ${scannedFiles.length} files | ${unchangedChunksCount + totalChunksProcessed} total chunks | ${filesToEmbed.length} files embedded | ${scannedFiles.length - filesToEmbed.length} unchanged`);
    console.log(`[Indexing] Timing: download=${(0 / 1000).toFixed(2)}s parse=${(parseTime / 1000).toFixed(2)}s embed=${(embedTime / 1000).toFixed(2)}s db=${(dbWriteTime / 1000).toFixed(2)}s total=${(totalTime / 1000).toFixed(2)}s`);

  } catch (error: any) {
    console.error(`[Indexing] Failed to index repository ${id}:`, error.stack || error);
    await prisma.repository.update({
      where: { id },
      data: { indexingStatus: 'failed', indexingProgress: `Error: ${error.message || 'Unknown error'}` }
    }).catch(updateErr => console.error('[Indexing] Failed to update repo status:', updateErr));
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


/**
 * Builds the vector index for all files inside a repository.
 */

export async function buildVectorIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { force } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    if (repo.indexingStatus === 'indexing' && !force) {
      res.status(200).json({ success: true, message: 'Repository is already indexing in the background.' });
      return;
    }

    // Set indexing status to indexing and starting progress
    await prisma.repository.update({
      where: { id: id as string },
      data: {
        indexingStatus: 'indexing',
        indexingProgress: repo.isLocal ? 'Parsing' : 'Downloading'
      }
    });

    // Trigger background vector indexing asynchronously
    performVectorIndexing(id as string, !!force).catch(err => {
      console.error(`[Background Indexing] Failed for repo ${id}:`, err);
    });

    res.status(202).json({
      success: true,
      message: 'Repository indexing started in the background.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles conversational QA against the indexed repository.
 */
export async function chatWithRepo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { message, model } = req.body;
    if (!message) {
      throw new AppError('Message prompt is required.', 400);
    }
    const requestedModel = model || 'qwen/qwen3-coder:free';
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: {
        id: true, name: true, fileCount: true, totalSize: true, framework: true,
        languages: true, entryPoints: true, scannedFiles: true, dependencyGraph: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    const plan = plannerService.planQuery(message);
    console.log(`Planner selected query intent: ${plan.intent}`);
    plan.steps.forEach(step => console.log(`  -> Planning step: ${step}`));

    let similarChunks: any[] = [];
    if (plan.useVector) {
      const queryVector = await vectorService.getEmbedding(message);
      similarChunks = await vectorService.searchSimilarChunks(id as string, queryVector, plan.limit);
    } else {
      similarChunks = await prisma.codeChunk.findMany({
        where: {
          repositoryId: id as string,
          filePath: {
            contains: 'package.json'
          }
        },
        take: plan.limit
      });
      if (similarChunks.length === 0) {
        similarChunks = await prisma.codeChunk.findMany({
          where: { repositoryId: id as string },
          take: plan.limit
        });
      }
    }

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]>;

    const inDegreeMap: Record<string, number> = {};
    for (const [filePath, imports] of Object.entries(dependencyGraph)) {
      for (const imp of imports) {
        inDegreeMap[imp] = (inDegreeMap[imp] || 0) + 1;
      }
    }

    const rawChunks = similarChunks.map((chunk: any) => ({
      filePath: chunk.filePath as string,
      content: chunk.content as string,
      startLine: chunk.startLine as number,
      endLine: chunk.endLine as number,
      symbolName: chunk.symbolName as string | null
    }));

    const sortedChunks = hierarchyService.categorizeAndSortChunks(rawChunks, inDegreeMap);
    const contextChunks = hierarchyService.allocateTokens(sortedChunks, 8000);

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as Array<{ path: string }>;
    const fileTree = buildFileTreeString(scannedFiles);

    const repoMetadata = {
      name: repo.name,
      fileCount: repo.fileCount,
      totalSize: repo.totalSize,
      framework: repo.framework,
      languages: typeof repo.languages === 'string' ? JSON.parse(repo.languages) : repo.languages,
      entryPoints: typeof repo.entryPoints === 'string' ? JSON.parse(repo.entryPoints) : repo.entryPoints,
      fileTree
    };

    const evidenceTraces = evidenceService.generateEvidenceTraces(scannedFiles, dependencyGraph).map(t => t.pathString);

    const aiResult = await llmService.chat({
      prompt: message,
      contextChunks,
      model: requestedModel,
      repoMetadata,
      evidenceTraces
    });

    await prisma.chatMessage.create({
      data: { repositoryId: id as string, sender: 'USER', message }
    });

    await prisma.chatMessage.create({
      data: { repositoryId: id as string, sender: 'AI', message: aiResult.text, modelUsed: aiResult.modelUsed }
    });

    res.status(200).json({
      success: true,
      data: {
        text: aiResult.text,
        reasoning: aiResult.reasoning,
        modelUsed: aiResult.modelUsed
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles conversational streaming QA using Server-Sent Events (SSE).
 */
export async function chatWithRepoStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { message, model } = req.body;
    if (!message) {
      throw new AppError('Message prompt is required.', 400);
    }
    const requestedModel = model || 'qwen/qwen3-coder:free';
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: {
        id: true, name: true, fileCount: true, totalSize: true, framework: true,
        languages: true, entryPoints: true, scannedFiles: true, dependencyGraph: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    const plan = plannerService.planQuery(message);
    console.log(`Planner stream selected query intent: ${plan.intent}`);
    plan.steps.forEach(step => console.log(`  -> Planning stream step: ${step}`));

    let similarChunks: any[] = [];
    if (plan.useVector) {
      const queryVector = await vectorService.getEmbedding(message);
      similarChunks = await vectorService.searchSimilarChunks(id as string, queryVector, plan.limit);
    } else {
      similarChunks = await prisma.codeChunk.findMany({
        where: {
          repositoryId: id as string,
          filePath: {
            contains: 'package.json'
          }
        },
        take: plan.limit
      });
      if (similarChunks.length === 0) {
        similarChunks = await prisma.codeChunk.findMany({
          where: { repositoryId: id as string },
          take: plan.limit
        });
      }
    }

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]>;

    const inDegreeMap: Record<string, number> = {};
    for (const [filePath, imports] of Object.entries(dependencyGraph)) {
      for (const imp of imports) {
        inDegreeMap[imp] = (inDegreeMap[imp] || 0) + 1;
      }
    }

    const rawChunks = similarChunks.map((chunk: any) => ({
      filePath: chunk.filePath as string,
      content: chunk.content as string,
      startLine: chunk.startLine as number,
      endLine: chunk.endLine as number,
      symbolName: chunk.symbolName as string | null
    }));

    const sortedChunks = hierarchyService.categorizeAndSortChunks(rawChunks, inDegreeMap);
    const contextChunks = hierarchyService.allocateTokens(sortedChunks, 8000);

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as Array<{ path: string }>;
    const fileTree = buildFileTreeString(scannedFiles);

    const repoMetadata = {
      name: repo.name,
      fileCount: repo.fileCount,
      totalSize: repo.totalSize,
      framework: repo.framework,
      languages: typeof repo.languages === 'string' ? JSON.parse(repo.languages) : repo.languages,
      entryPoints: typeof repo.entryPoints === 'string' ? JSON.parse(repo.entryPoints) : repo.entryPoints,
      fileTree
    };

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Write query planner steps
    res.write(`data: ${JSON.stringify({ plan: { intent: plan.intent, steps: plan.steps } })}\n\n`);

    // Save user query to history
    await prisma.chatMessage.create({
      data: { repositoryId: id as string, sender: 'USER', message }
    });

    let completeText = '';
    let finalModel = requestedModel;

    const evidenceTraces = evidenceService.generateEvidenceTraces(scannedFiles, dependencyGraph).map(t => t.pathString);

    try {
      const stream = llmService.chatStream({
        prompt: message,
        contextChunks,
        model: requestedModel,
        repoMetadata,
        evidenceTraces
      });

      for await (const chunk of stream) {
        completeText += chunk.content;
        finalModel = chunk.modelUsed;
        res.write(`data: ${JSON.stringify({ token: chunk.content, modelUsed: chunk.modelUsed })}\n\n`);
      }

      // Save complete AI response to history
      await prisma.chatMessage.create({
        data: {
          repositoryId: id as string,
          sender: 'AI',
          message: completeText,
          modelUsed: finalModel
        }
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('Streaming response failed:', err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves the chat history for a specific repository.
 */
export async function getChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: { id: true }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }
    const messages = await prisma.chatMessage.findMany({
      where: { repositoryId: id as string },
      orderBy: { createdAt: 'asc' }
    });
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
}

/**
 * Computes and returns insights for the repository.
 */
export async function getRepoInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: { id: true, scannedFiles: true, dependencyGraph: true, entryPoints: true }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as any[];

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]>;

    const entryPoints = (typeof repo.entryPoints === 'string'
      ? JSON.parse(repo.entryPoints)
      : repo.entryPoints) as string[];

    const insights = insightService.computeInsights(scannedFiles, dependencyGraph, entryPoints);

    res.status(200).json({ success: true, data: insights });
  } catch (error) {
    next(error);
  }
}

/**
 * Generates and returns a narrative explaining the high-level business domain and execution flow of the repository.
 */
export async function getRepoStory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: { id: true, name: true, framework: true, languages: true, entryPoints: true, dependencyGraph: true }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]>;

    const entryPoints = (typeof repo.entryPoints === 'string'
      ? JSON.parse(repo.entryPoints)
      : repo.entryPoints) as string[];

    // Calculate hotspots using simple in-degree centrality weight
    const inDegreeMap: Record<string, number> = {};
    for (const [filePath, imports] of Object.entries(dependencyGraph)) {
      for (const imp of imports) {
        inDegreeMap[imp] = (inDegreeMap[imp] || 0) + 1;
      }
    }
    const sortedHotspots = Object.entries(inDegreeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([filePath]) => filePath);

    const story = storyService.generateStory(
      repo.name,
      repo.framework || 'unknown',
      (typeof repo.languages === 'string' ? JSON.parse(repo.languages) : repo.languages) || {},
      entryPoints,
      dependencyGraph,
      sortedHotspots
    );

    res.status(200).json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
}

/**
 * Generates and returns a custom onboarding guide for the repository.
 */
export async function getRepoOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: { id: true, framework: true, languages: true, astMetadata: true }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    const astMetadata = (typeof repo.astMetadata === 'string'
      ? JSON.parse(repo.astMetadata)
      : repo.astMetadata) as Record<string, any>;

    // Collect all imports as dependencies
    const dependencies = new Set<string>();
    for (const fileMeta of Object.values(astMetadata)) {
      if (fileMeta && Array.isArray(fileMeta.imports)) {
        fileMeta.imports.forEach((imp: string) => dependencies.add(imp));
      }
    }

    const onboarding = onboardingService.generateOnboardingGuide(
      repo.framework || 'unknown',
      (typeof repo.languages === 'string' ? JSON.parse(repo.languages) : repo.languages) || {},
      Array.from(dependencies)
    );

    res.status(200).json({ success: true, data: onboarding });
  } catch (error) {
    next(error);
  }
}

/**
 * Manually generates or regenerates the AI Repository Summary.
 */
export async function generateRepoSummaryEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as any[] || [];

    const fileTreeLines = scannedFiles.map(f => f.path);
    const fileTreeStr = fileTreeLines.slice(0, 100).join('\n') + (fileTreeLines.length > 100 ? '\n... (truncated)' : '');

    console.log(`[Manual Summary] Generating AI Repository Summary for repo ${id}...`);
    const summaryText = await llmService.generateRepositorySummary({
      name: repo.name,
      framework: repo.framework,
      languages: repo.languages,
      fileCount: scannedFiles.length,
      totalSize: repo.totalSize,
      fileTree: fileTreeStr
    });

    let cleanedJson = summaryText.trim();
    if (cleanedJson.startsWith('```')) {
      const lines = cleanedJson.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1].startsWith('```')) lines.pop();
      cleanedJson = lines.join('\n').trim();
    }
    const aiSummaryObj = JSON.parse(cleanedJson);

    // Save to DB
    const updated = await prisma.repository.update({
      where: { id: id as string },
      data: { aiSummary: aiSummaryObj }
    });

    res.status(200).json({ success: true, data: updated.aiSummary });
  } catch (error: any) {
    console.error('[Manual Summary] Generation failed:', error.message);
    next(error);
  }
}

export const repoController = {
  scanPublicRepo,
  scanLocalZip,
  listUserRepos,
  getRepoDetails,
  analyzeImpact,
  buildVectorIndex,
  chatWithRepo,
  chatWithRepoStream,
  getChatHistory,
  getRepoInsights,
  getRepoStory,
  getRepoOnboarding,
  generateRepoSummaryEndpoint
};
