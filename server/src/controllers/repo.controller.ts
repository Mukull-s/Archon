import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config';
import { ingestionService } from '../services/ingestion.service';
import { AppError } from '../utils';
import path from 'path';
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

    // Retrieve user's stored githubToken to bypass API rate limits
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const token = user?.githubToken || undefined;

    // Download zipball
    const zipPath = await ingestionService.downloadGithubRepo(owner, repo, token);

    // Process and index
    const result = await ingestionService.processAndScanZip(zipPath, userId, repo, owner);

    // Trigger vector indexing synchronously during analysis
    if (result.repository?.id) {
      await performVectorIndexing(result.repository.id);
    }

    res.status(201).json({
      success: true,
      message: 'Repository scanned and cached successfully.',
      data: result.repository,
      warnings: result.warnings,
      checklist: result.checklist
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

    // Process and index
    const result = await ingestionService.processAndScanZip(zipPath, userId, repoName);

    // Trigger vector indexing synchronously during analysis
    if (result.repository?.id) {
      await performVectorIndexing(result.repository.id);
    }

    res.status(201).json({
      success: true,
      message: 'ZIP uploaded, scanned and cached successfully.',
      data: result.repository,
      warnings: result.warnings,
      checklist: result.checklist
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
    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: {
        id: true, name: true, owner: true, isLocal: true, framework: true,
        languages: true, fileCount: true, totalSize: true, confidence: true,
        scannedFiles: true, astMetadata: true, dependencyGraph: true,
        entryPoints: true, createdAt: true, updatedAt: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
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
export async function performVectorIndexing(id: string, force = false): Promise<void> {
  const repo = await prisma.repository.findFirst({
    where: { id },
    select: { id: true, name: true, scannedFiles: true }
  });
  if (!repo) {
    throw new AppError('Repository not found.', 404);
  }

  // If already indexed and not forcing re-index, skip
  if (!force) {
    const chunkCount = await prisma.codeChunk.count({
      where: { repositoryId: id }
    });
    if (chunkCount > 0) {
      console.log(`Repository ${repo.name} (${id}) is already indexed. Skipping background index build.`);
      return;
    }
  }

  // Delete existing chunks for this repository to prevent duplicates
  await prisma.$executeRawUnsafe(`DELETE FROM "CodeChunk" WHERE "repositoryId" = $1`, id);

  const scannedFiles = (typeof repo.scannedFiles === 'string'
    ? JSON.parse(repo.scannedFiles)
    : repo.scannedFiles) as Array<{ path: string; content?: string }>;

  console.log(`Building index for repository: ${repo.name} (${scannedFiles.length} files)...`);

  // Gather all chunks from all files first
  const allChunks: Array<{
    filePath: string;
    chunkIndex: number;
    content: string;
    startLine: number;
    endLine: number;
    symbolName: string | null;
  }> = [];

  for (const file of scannedFiles) {
    const fileContent = file.content || '';
    const symbols = astService.getCodeSymbols(file.path, fileContent);
    const chunks = ingestionService.chunkCodeFile(file.path, fileContent, symbols);
    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({
        filePath: file.path,
        chunkIndex: i,
        content: chunks[i].content,
        startLine: chunks[i].startLine,
        endLine: chunks[i].endLine,
        symbolName: chunks[i].symbolName
      });
    }
  }

  console.log(`Generated ${allChunks.length} chunks. Generating embeddings in concurrent batches...`);

  const batchSize = 16;
  const concurrency = 4;
  const batches: Array<typeof allChunks> = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    batches.push(allChunks.slice(i, i + batchSize));
  }

  for (let i = 0; i < batches.length; i += concurrency) {
    const batchGroup = batches.slice(i, i + concurrency);
    await Promise.all(batchGroup.map(async (batch) => {
      const batchTexts = batch.map(c => c.content);
      const embeddings = await vectorService.getEmbeddingsBatch(batchTexts);

      const valuesSql: string[] = [];
      const params: any[] = [];

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];
        const vectorStr = `[${embedding.join(',')}]`;
        const chunkId = crypto.randomUUID();

        const baseIdx = j * 9;
        valuesSql.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}::vector)`);

        params.push(
          chunkId,
          id,
          chunk.filePath,
          chunk.chunkIndex,
          chunk.content,
          chunk.startLine,
          chunk.endLine,
          chunk.symbolName,
          vectorStr
        );
      }

      const query = `INSERT INTO "CodeChunk" (id, "repositoryId", "filePath", "chunkIndex", "content", "startLine", "endLine", "symbolName", embedding) VALUES ${valuesSql.join(', ')}`;
      await prisma.$executeRawUnsafe(query, ...params);
    }));

    await new Promise(resolve => setTimeout(resolve, 30));
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
      where: { id: id as string, userId: userId as string },
      select: { id: true }
    });
    if (!repo) {
      throw new AppError('Repository not found.', 404);
    }

    await performVectorIndexing(id as string, !!force);
    res.status(200).json({ success: true, message: 'Repository indexed successfully into pgvector.' });
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
  getRepoOnboarding
};
