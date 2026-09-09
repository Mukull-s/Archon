/**
 * Central Archon V1 Plan & Entitlement Configuration.
 * 
 * All tier limitations, resource ceilings, and feature flags are defined here
 * so limits can be adjusted or audited from one single location.
 */

export interface PlanLimits {
  name: 'free' | 'pro';
  displayName: string;
  priceMonthly: number;
  period: string;
  tagline: string;
  lifetimeAnalyses: number;
  maxActiveCodebases: number;
  maxFilesPerRepo: number;
  maxRepoSizeBytes: number;
  monthlyAiQuestions: number;
  monthlyReindexes: number;
  basicArchitecture: boolean;
  dependencyGraph: boolean;
  traceFlow: boolean;
  onboarding: boolean;
  basicRag: boolean;
  advancedAnalysis: boolean;
  fullHistory: boolean;
  priorityIndexing: boolean;
}

export const PLAN_LIMITS: Record<'free' | 'pro', PlanLimits> = {
  free: {
    name: 'free',
    displayName: 'Free',
    priceMonthly: 0,
    period: 'forever',
    tagline: 'Explore Archon on real codebases with zero friction.',
    lifetimeAnalyses: 2,
    maxActiveCodebases: 1,
    maxFilesPerRepo: 400,
    maxRepoSizeBytes: 15 * 1024 * 1024, // 15 MB
    monthlyAiQuestions: 10,
    monthlyReindexes: 1,
    basicArchitecture: true,
    dependencyGraph: true,
    traceFlow: true,
    onboarding: true,
    basicRag: true,
    advancedAnalysis: false,
    fullHistory: false,
    priorityIndexing: false,
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceMonthly: 7.99,
    period: '/month',
    tagline: 'Continuously understand and work with your codebases.',
    lifetimeAnalyses: 999999,
    maxActiveCodebases: 10,
    maxFilesPerRepo: 2000,
    maxRepoSizeBytes: 50 * 1024 * 1024, // 50 MB
    monthlyAiQuestions: 500,
    monthlyReindexes: 30,
    basicArchitecture: true,
    dependencyGraph: true,
    traceFlow: true,
    onboarding: true,
    basicRag: true,
    advancedAnalysis: true,
    fullHistory: true,
    priorityIndexing: true,
  },
};

export function getPlanLimits(planName?: string | null): PlanLimits {
  if (planName === 'pro') return PLAN_LIMITS.pro;
  return PLAN_LIMITS.free;
}
