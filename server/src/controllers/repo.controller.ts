import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config';
import { ingestionService, deleteFolderWithRetry } from '../services/ingestion.service';
import { AppError } from '../utils';
import { confidenceService } from '../services/confidence.service';
import { entitlementService } from '../services/entitlement.service';
import { queueService } from '../services/queue.service';
import { hierarchyService } from '../services/hierarchy.service';
import { insightService } from '../services/insight.service';
import { storyService } from '../services/story.service';
import { onboardingService } from '../services/onboarding.service';
import { llmService } from '../services/llm.service';

// Orchestrators (Extracted for separation of concerns and maintainability P1-1)
import { performVectorIndexing, parseRepositorySummary } from '../services/indexing.orchestrator';
import {
  prepareChatContext,
  buildFileTreeString,
  executeChatWithRepo,
  executeChatWithRepoStream,
  getChatHistory,
  PreparedChatContext
} from '../services/chat.orchestrator';
import { executeImpactAnalysis } from '../services/impact.orchestrator';

// Re-export for backward compatibility with route definitions and tests
export { performVectorIndexing };
export { prepareChatContext, buildFileTreeString, PreparedChatContext };
export const chatWithRepo = executeChatWithRepo;
export const chatWithRepoStream = executeChatWithRepoStream;
export { getChatHistory };
export const analyzeImpact = executeImpactAnalysis;

/**
 * Parses a GitHub repository URL to extract owner and repository name.
 */
function parseGithubUrl(url: string): { owner: string; repo: string } {
  try {
    const cleaned = url.trim().replace(/\/$/, '');
    const regex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/i;
    const match = cleaned.match(regex);
    if (!match) {
      throw new AppError('Invalid GitHub URL format. Example: https://github.com/owner/repository', 400);
    }
    // Strip a trailing `.git` (e.g. "https://github.com/owner/repo.git") and any
    // query/hash so the zipball endpoint receives the bare repository name.
    const repo = match[2].replace(/\.git$/i, '').replace(/[?#].*$/, '');
    return { owner: match[1], repo };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to parse GitHub URL. Ensure it matches github.com/owner/repo', 400);
  }
}

/** Fields the client needs to render a repository immediately after a scan. */
const REPO_SUMMARY_SELECT = {
  id: true,
  name: true,
  owner: true,
  isLocal: true,
  indexingStatus: true,
  indexingProgress: true
} as const;

/**
 * Derives a 0–100 completion percentage from backend progress.
 */
function deriveSemanticCompleteness(indexingStatus: string, indexingProgress: string): number {
  if (indexingStatus === 'completed') return 100;
  if (indexingStatus !== 'indexing') return 0;
  const match = /(\d+)%/.exec(indexingProgress || '');
  if (!match) return 0;
  return Math.min(100, Math.max(0, parseInt(match[1], 10)));
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

    const existingRepo = await prisma.repository.findFirst({
      where: { userId, owner, name: repo },
      // Minimal projection: avoids loading the large scannedFiles/astMetadata/
      // dependencyGraph JSONB blobs just to check indexing status.
      select: { id: true, indexingStatus: true, name: true, owner: true, indexingProgress: true }
    });

    let repository: any;
    const isReindex = !!existingRepo;

    if (existingRepo) {
      if (existingRepo.indexingStatus === 'indexing') {
        res.status(200).json({
          success: true,
          message: 'Repository is already indexing in the background.',
          data: existingRepo
        });
        return;
      }

      await entitlementService.canReindex(userId, existingRepo.id);

      repository = await prisma.repository.update({
        where: { id: existingRepo.id },
        data: {
          indexingStatus: 'indexing',
          indexingProgress: 'Downloading',
          framework: null,
          languages: [],
          entryPoints: [],
          importantFiles: [],
          fileCount: 0,
          totalSize: 0,
          confidence: 0
        },
        select: REPO_SUMMARY_SELECT
      });
    } else {
      await entitlementService.canAnalyzeCodebase(userId);

      repository = await prisma.repository.create({
        data: {
          userId,
          owner,
          name: repo,
          isLocal: false,
          indexingStatus: 'indexing',
          indexingProgress: 'Downloading',
          languages: [],
          entryPoints: [],
          importantFiles: [],
          fileCount: 0,
          totalSize: 0,
          scannedFiles: [],
          astMetadata: {},
          dependencyGraph: {}
        },
        select: REPO_SUMMARY_SELECT
      });
    }

    const enqueued = await queueService.enqueue(repository.id, userId, {
      force: isReindex,
      isNewAnalysis: !isReindex
    });

    res.status(202).json({
      success: true,
      message: isReindex
        ? 'Repository re-indexing started in the background.'
        : 'Repository analysis started in the background.',
      data: {
        repository,
        jobId: enqueued.jobId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Scan a local repository uploaded as a ZIP file.
 */
export async function scanLocalZip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('A ZIP file is required for local scanning.', 400);
    }

    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized access.', 401);
    }

    const originalName = path.parse(file.originalname).name;
    await entitlementService.canAnalyzeCodebase(userId);

    const repository = await prisma.repository.create({
      data: {
        userId,
        name: originalName,
        isLocal: true,
        indexingStatus: 'indexing',
        indexingProgress: 'Parsing',
        languages: [],
        entryPoints: [],
        importantFiles: [],
        fileCount: 0,
        totalSize: 0,
        scannedFiles: [],
        astMetadata: {},
        dependencyGraph: {}
      }
    });

    const enqueued = await queueService.enqueue(repository.id, userId, {
      zipPath: file.path,
      force: false,
      isNewAnalysis: true
    });

    res.status(202).json({
      success: true,
      message: 'Local ZIP scan started in the background.',
      data: {
        repository,
        jobId: enqueued.jobId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lists all active repositories belonging to the authenticated user.
 */
export async function listUserRepos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    const repos = await prisma.repository.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
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
        aiSummary: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(200).json({
      success: true,
      data: repos
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns details for a specific repository.
 */
export async function getRepoDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const lite = req.query.lite === 'true';
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    let repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: {
        id: true, name: true, owner: true, isLocal: true, framework: true,
        languages: true, fileCount: true, totalSize: true, confidence: true,
        entryPoints: true, indexingStatus: true, indexingProgress: true,
        aiSummary: true,
        indexingStats: true,
        createdAt: true, updatedAt: true,
        ...(lite ? {} : { scannedFiles: true, astMetadata: true, dependencyGraph: true })
      }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    if (repo.indexingStatus === 'indexing') {
      const StaleTimeout = 10 * 60 * 1000;
      const timeSinceUpdate = Date.now() - new Date(repo.updatedAt).getTime();
      if (timeSinceUpdate > StaleTimeout) {
        repo = await prisma.repository.update({
          where: { id: repo.id },
          data: {
            indexingStatus: 'failed',
            indexingProgress: 'Error: Indexing timed out. The server process may have restarted.'
          },
          select: {
            id: true, name: true, owner: true, isLocal: true, framework: true,
            languages: true, fileCount: true, totalSize: true, confidence: true,
            entryPoints: true, indexingStatus: true, indexingProgress: true,
            aiSummary: true,
            indexingStats: true,
            createdAt: true, updatedAt: true,
            ...(lite ? {} : { scannedFiles: true, astMetadata: true, dependencyGraph: true })
          }
        });
      }
    }

    if (lite) {
      const semanticCompleteness = deriveSemanticCompleteness(repo.indexingStatus, repo.indexingProgress);
      res.status(200).json({
        success: true,
        data: {
          ...repo,
          // Strict gate: the UI renders repository data only when the run is
          // fully complete (all files, all batches, summary present).
          isIndexed: repo.indexingStatus === 'completed',
          semanticCompleteness,
          scannedFiles: [],
          astMetadata: {},
          dependencyGraph: {},
          confidenceDetails: { score: repo.confidence, checks: [] }
        }
      });
      return;
    }

    const scannedFiles = (typeof (repo as any).scannedFiles === 'string'
      ? JSON.parse((repo as any).scannedFiles)
      : (repo as any).scannedFiles) as any[];

    const astMetadata = (typeof (repo as any).astMetadata === 'string'
      ? JSON.parse((repo as any).astMetadata)
      : (repo as any).astMetadata) as Record<string, any>;

    const dependencyGraph = (typeof (repo as any).dependencyGraph === 'string'
      ? JSON.parse((repo as any).dependencyGraph)
      : (repo as any).dependencyGraph) as Record<string, string[]>;

    const confidenceDetails = confidenceService.calculateConfidence(
      scannedFiles,
      astMetadata,
      dependencyGraph,
      repo.languages,
      repo.framework
    );

    // Strict gate: repository data is only "indexed" when the run fully
    // completed. A partial/failed run renders an error + retry, never half-data.
    const isIndexed = repo.indexingStatus === 'completed';
    const semanticCompleteness = deriveSemanticCompleteness(repo.indexingStatus, repo.indexingProgress);

    const lightScannedFiles = (scannedFiles || []).map((f: any) => ({
      path: f.path,
      size: f.size,
      lines: f.lines,
    }));

    res.status(200).json({
      success: true,
      data: {
        ...repo,
        scannedFiles: lightScannedFiles,
        isIndexed,
        semanticCompleteness,
        confidenceDetails
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a repository and clean up any local cache.
 */
export async function deleteRepo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: { id: true, name: true, localPath: true }
    });

    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    if (repo.localPath && fs.existsSync(repo.localPath)) {
      try {
        await deleteFolderWithRetry(repo.localPath);
      } catch (fsErr) {
        console.warn(`[Delete Repo] Warning: Failed to delete directory ${repo.localPath}:`, fsErr);
      }
    }

    await prisma.repository.delete({
      where: { id: repo.id }
    });

    res.status(200).json({
      success: true,
      message: `Repository "${repo.name}" deleted successfully.`
    });
  } catch (error) {
    next(error);
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
      throw new AppError('Repository not found or access denied.', 404);
    }

    if (repo.indexingStatus === 'indexing' && !force) {
      res.status(200).json({ success: true, message: 'Repository is already indexing in the background.' });
      return;
    }

    await entitlementService.canReindex(userId, id as string);

    await prisma.repository.update({
      where: { id: id as string },
      data: {
        indexingStatus: 'indexing',
        indexingProgress: repo.isLocal ? 'Parsing' : 'Downloading'
      }
    });

    const enqueued = await queueService.enqueue(id as string, userId, {
      force: true,
      isNewAnalysis: false
    });

    res.status(202).json({
      success: true,
      message: 'Repository indexing job enqueued in background queue.',
      data: {
        jobId: enqueued.jobId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves repository architecture insights.
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
      select: {
        id: true, name: true, framework: true, languages: true,
        scannedFiles: true, dependencyGraph: true, astMetadata: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as any[] || [];

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]> || {};

    const astMetadata = (typeof repo.astMetadata === 'string'
      ? JSON.parse(repo.astMetadata)
      : repo.astMetadata) as Record<string, any> || {};

    const insights = insightService.computeInsights(
      scannedFiles,
      dependencyGraph,
      (repo as any).entryPoints || []
    );

    res.status(200).json({
      success: true,
      data: insights
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns structured repository history and architectural narrative.
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
      select: {
        id: true, name: true, framework: true, languages: true,
        fileCount: true, totalSize: true, entryPoints: true,
        scannedFiles: true, dependencyGraph: true, astMetadata: true,
        createdAt: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as any[] || [];

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]> || {};

    const astMetadata = (typeof repo.astMetadata === 'string'
      ? JSON.parse(repo.astMetadata)
      : repo.astMetadata) as Record<string, any> || {};

    const langObj: Record<string, number> = {};
    (repo.languages || []).forEach(l => { langObj[l] = 1; });
    const story = storyService.generateStory(
      repo.name,
      repo.framework || 'Unknown',
      langObj,
      repo.entryPoints,
      dependencyGraph,
      repo.entryPoints
    );

    res.status(200).json({
      success: true,
      data: story
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns interactive onboarding guide and learning tracks.
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
      select: {
        id: true, name: true, framework: true, languages: true,
        entryPoints: true, scannedFiles: true, dependencyGraph: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    const scannedFiles = (typeof repo.scannedFiles === 'string'
      ? JSON.parse(repo.scannedFiles)
      : repo.scannedFiles) as any[] || [];

    const dependencyGraph = (typeof repo.dependencyGraph === 'string'
      ? JSON.parse(repo.dependencyGraph)
      : repo.dependencyGraph) as Record<string, string[]> || {};

    const langObj: Record<string, number> = {};
    (repo.languages || []).forEach(l => { langObj[l] = 1; });
    const allDeps = Object.values(dependencyGraph).flat();
    const onboarding = onboardingService.generateOnboardingGuide(
      repo.framework || 'Unknown',
      langObj,
      allDeps
    );

    res.status(200).json({
      success: true,
      data: onboarding
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generates an executive AI summary for a repository.
 */
export async function generateRepoSummaryEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: {
        id: true, name: true, framework: true, languages: true,
        fileCount: true, totalSize: true, aiSummary: true,
        // Needed to build the file tree passed to the summarizer.
        scannedFiles: true
      }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    if (repo.aiSummary) {
      res.status(200).json({
        success: true,
        data: repo.aiSummary
      });
      return;
    }

    const scannedFiles = (typeof (repo as any).scannedFiles === 'string'
      ? JSON.parse((repo as any).scannedFiles)
      : (repo as any).scannedFiles) as any[] || [];
    const fileTree = buildFileTreeString(scannedFiles);

    const raw = await llmService.generateRepositorySummary({
      name: repo.name,
      framework: repo.framework,
      languages: repo.languages,
      fileCount: repo.fileCount,
      totalSize: repo.totalSize,
      fileTree
    });

    const summary = parseRepositorySummary(raw);

    await prisma.repository.update({
      where: { id: repo.id },
      data: { aiSummary: summary as any }
    });

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Archives a repository.
 */
export async function archiveRepo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const updated = await entitlementService.archiveRepo(userId, id as string);
    res.status(200).json({
      success: true,
      message: 'Repository archived successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unarchives a repository.
 */
export async function unarchiveRepo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }
    const updated = await entitlementService.unarchiveRepo(userId, id as string);
    res.status(200).json({
      success: true,
      message: 'Repository activated successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export const repoController = {
  scanPublicRepo,
  scanLocalZip,
  listUserRepos,
  getRepoDetails,
  deleteRepo,
  archiveRepo,
  unarchiveRepo,
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
