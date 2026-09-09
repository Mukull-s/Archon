import { prisma, getPlanLimits, PlanLimits } from '../config';
import { AppError } from '../utils';

export interface UserUsageAndLimits {
  plan: 'free' | 'pro';
  limits: PlanLimits;
  usage: {
    lifetimeAnalysesUsed: number;
    activeCodebases: number;
    totalCodebases: number;
    monthlyAiQuestionsUsed: number;
    monthlyReindexesUsed: number;
    usagePeriodStart: string;
  };
}

export class EntitlementService {
  /**
   * Retrieves authoritative usage and limits for a user.
   * Lazily checks and resets monthly periods without needing recurring cron jobs.
   */
  async getUserUsageAndLimits(userId: string): Promise<UserUsageAndLimits> {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        lifetimeAnalysesUsed: true,
        monthlyAiQuestionsUsed: true,
        monthlyReindexesUsed: true,
        usagePeriodStart: true,
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const now = new Date();
    const periodStart = new Date(user.usagePeriodStart || now);
    const daysPassed = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

    // Monthly rollover check (30 days or calendar month rollover)
    if (
      daysPassed >= 30 ||
      now.getMonth() !== periodStart.getMonth() ||
      now.getFullYear() !== periodStart.getFullYear()
    ) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          monthlyAiQuestionsUsed: 0,
          monthlyReindexesUsed: 0,
          usagePeriodStart: now,
        },
        select: {
          id: true,
          plan: true,
          lifetimeAnalysesUsed: true,
          monthlyAiQuestionsUsed: true,
          monthlyReindexesUsed: true,
          usagePeriodStart: true,
        },
      });
    }

    const activeCodebasesCount = await prisma.repository.count({
      where: { userId, isArchived: false },
    });

    const totalCodebasesCount = await prisma.repository.count({
      where: { userId },
    });

    const planName = (user.plan === 'pro' ? 'pro' : 'free') as 'free' | 'pro';
    const limits = getPlanLimits(planName);

    // Ensure lifetime analyses accurately reflect whichever is higher (recorded counter vs total created repos)
    const effectiveLifetimeAnalyses = Math.max(user.lifetimeAnalysesUsed || 0, totalCodebasesCount);

    return {
      plan: planName,
      limits,
      usage: {
        lifetimeAnalysesUsed: effectiveLifetimeAnalyses,
        activeCodebases: activeCodebasesCount,
        totalCodebases: totalCodebasesCount,
        monthlyAiQuestionsUsed: user.monthlyAiQuestionsUsed || 0,
        monthlyReindexesUsed: user.monthlyReindexesUsed || 0,
        usagePeriodStart: (user.usagePeriodStart || now).toISOString(),
      },
    };
  }

  /**
   * Validates whether a user is allowed to perform a new codebase analysis.
   */
  async canAnalyzeCodebase(userId: string): Promise<UserUsageAndLimits> {
    const data = await this.getUserUsageAndLimits(userId);
    const { plan, limits, usage } = data;

    if (usage.lifetimeAnalysesUsed >= limits.lifetimeAnalyses) {
      throw new AppError(
        `Lifetime analysis quota reached (${limits.lifetimeAnalyses} analyses on the ${limits.displayName} plan). Upgrade to Pro for unlimited analyses.`,
        403,
        true,
        'ANALYSIS_LIMIT_REACHED',
        {
          actual: usage.lifetimeAnalysesUsed,
          limit: limits.lifetimeAnalyses,
          plan,
        }
      );
    }

    return data;
  }

  /**
   * Validates whether a user has available active codebase slots.
   */
  async canCreateActiveCodebase(userId: string): Promise<UserUsageAndLimits> {
    const data = await this.getUserUsageAndLimits(userId);
    const { plan, limits, usage } = data;

    if (usage.activeCodebases >= limits.maxActiveCodebases) {
      throw new AppError(
        `Active codebase limit reached (${limits.maxActiveCodebases} active codebase on ${limits.displayName} plan). Archive an existing codebase or upgrade to Pro to unlock up to 10 active codebases.`,
        403,
        true,
        'ACTIVE_CODEBASE_LIMIT_REACHED',
        {
          actual: usage.activeCodebases,
          limit: limits.maxActiveCodebases,
          plan,
        }
      );
    }

    return data;
  }

  /**
   * Validates whether a user can re-index a repository.
   */
  async canReindex(userId: string, repoId: string): Promise<UserUsageAndLimits> {
    const data = await this.getUserUsageAndLimits(userId);
    const { plan, limits, usage } = data;

    // Verify repository exists and belongs to the calling user
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId },
      select: { reindexCount: true },
    });

    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    // 1. Check monthly re-indexes
    if (usage.monthlyReindexesUsed >= limits.monthlyReindexes) {
      throw new AppError(
        `Monthly re-index quota reached (${limits.monthlyReindexes} re-indexes/month on ${limits.displayName} plan). Upgrade to Pro for 30 re-indexes/month.`,
        403,
        true,
        'REINDEX_LIMIT_REACHED',
        {
          actual: usage.monthlyReindexesUsed,
          limit: limits.monthlyReindexes,
          plan,
        }
      );
    }

    // 2. For Free plan: enforce 1 re-index per codebase
    if (plan === 'free') {
      if ((repo.reindexCount || 0) >= 1) {
        throw new AppError(
          `Free codebases allow 1 re-index per codebase. Upgrade to Pro for continuous updates and 30 re-indexes/month.`,
          403,
          true,
          'REINDEX_LIMIT_REACHED',
          {
            actual: repo.reindexCount,
            limit: 1,
            plan,
          }
        );
      }
    }

    return data;
  }

  /**
   * Validates whether a user can ask an AI question.
   */
  async canAskAI(userId: string): Promise<UserUsageAndLimits> {
    const data = await this.getUserUsageAndLimits(userId);
    const { plan, limits, usage } = data;

    if (usage.monthlyAiQuestionsUsed >= limits.monthlyAiQuestions) {
      throw new AppError(
        `Monthly AI question quota reached (${limits.monthlyAiQuestions} questions/month on ${limits.displayName} plan). Upgrade to Pro for 500 questions/month.`,
        403,
        true,
        'AI_LIMIT_REACHED',
        {
          actual: usage.monthlyAiQuestionsUsed,
          limit: limits.monthlyAiQuestions,
          plan,
        }
      );
    }

    return data;
  }

  /**
   * Validates whether a user is entitled to advanced architecture/impact analysis.
   */
  async canUseAdvancedAnalysis(userId: string): Promise<UserUsageAndLimits> {
    const data = await this.getUserUsageAndLimits(userId);
    const { plan, limits } = data;

    if (!limits.advancedAnalysis) {
      throw new AppError(
        `Advanced architectural analysis is available exclusively on the Pro plan.`,
        403,
        true,
        'ADVANCED_FEATURE_REQUIRED',
        { plan }
      );
    }

    return data;
  }

  /**
   * Enforces file count and total byte size ceilings before expensive indexing.
   */
  async validateRepoSize(
    userId: string,
    fileCount: number,
    totalSizeBytes: number
  ): Promise<void> {
    const { plan, limits } = await this.getUserUsageAndLimits(userId);

    if (fileCount > limits.maxFilesPerRepo) {
      throw new AppError(
        `Repository exceeds file limit (${fileCount.toLocaleString()} files detected, ${limits.maxFilesPerRepo.toLocaleString()} allowed on ${limits.displayName} plan). Upgrade to Pro to analyze up to 2,000 files.`,
        400,
        true,
        'FILE_LIMIT_EXCEEDED',
        {
          actual: fileCount,
          limit: limits.maxFilesPerRepo,
          unit: 'files',
          plan,
        }
      );
    }

    if (totalSizeBytes > limits.maxRepoSizeBytes) {
      const actualMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);
      const limitMb = (limits.maxRepoSizeBytes / (1024 * 1024)).toFixed(0);
      throw new AppError(
        `Repository size (${actualMb} MB) exceeds maximum allowed size of ${limitMb} MB on the ${limits.displayName} plan. Upgrade to Pro for up to 50 MB.`,
        400,
        true,
        'REPOSITORY_SIZE_LIMIT_EXCEEDED',
        {
          actual: totalSizeBytes,
          limit: limits.maxRepoSizeBytes,
          unit: 'bytes',
          plan,
        }
      );
    }
  }

  /**
   * Authoritative server-side usage recorders.
   */
  async recordCodebaseAnalysis(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lifetimeAnalysesUsed: { increment: 1 },
      },
    });
  }

  async recordAiQuestion(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyAiQuestionsUsed: { increment: 1 },
      },
    });
  }

  async recordReindex(userId: string, repoId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          monthlyReindexesUsed: { increment: 1 },
        },
      }),
      prisma.repository.update({
        where: { id: repoId },
        data: {
          reindexCount: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Archives a codebase so free users can free their active slot without deleting data.
   */
  async archiveRepo(userId: string, repoId: string): Promise<void> {
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId },
      select: { id: true },
    });

    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    await prisma.repository.update({
      where: { id: repoId },
      data: { isArchived: true },
    });
  }

  /**
   * Restores an archived codebase, validating active codebase limits first.
   */
  async unarchiveRepo(userId: string, repoId: string): Promise<void> {
    await this.canCreateActiveCodebase(userId);

    const repo = await prisma.repository.findFirst({
      where: { id: repoId, userId },
      select: { id: true },
    });

    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    await prisma.repository.update({
      where: { id: repoId },
      data: { isArchived: false },
    });
  }

  /**
   * Development / test endpoint to simulate plan change.
   */
  async setPlan(userId: string, plan: 'free' | 'pro'): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { plan },
    });
  }
}

export const entitlementService = new EntitlementService();
