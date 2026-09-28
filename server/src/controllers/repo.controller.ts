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


