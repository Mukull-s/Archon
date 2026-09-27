import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config';
import { AppError } from '../utils';
import * as astService from './ast.service';
import { entitlementService } from './entitlement.service';
import { llmService } from './llm.service';

/**
 * Calculates dependencies, affected routes, modules, and risk score for a selected file.
 * Automatically generates a human-friendly LLM explanation of the impact.
 */
export async function executeImpactAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      throw new AppError('Repository not found or access denied.', 404);
    }

    // Retrieve user entitlement to check plan tier for advanced AI reasoning
    const userLimits = await entitlementService.getUserUsageAndLimits(userId);
    const isPro = userLimits.plan === 'pro';

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

    // Generate high-level impact summary explanation
    let summary = 'This file has no dependent files. Changing it is safe and will not impact other parts of the codebase.';
    if (affectedFiles.length > 0) {
      if (isPro) {
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
        } catch {
          summary = `Modifying this file will propagate changes to ${affectedFiles.length} dependent files across your project.`;
        }
      } else {
        summary = `Modifying this file will propagate changes to ${affectedFiles.length} dependent files across your project. Upgrade to Pro for AI-powered architectural reasoning.`;
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

export const impactOrchestrator = {
  executeImpactAnalysis
};
