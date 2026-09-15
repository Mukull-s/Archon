import React, { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { Loading, ErrorState } from '../ui/DesignSystem';
import { toast } from 'sonner';
import { OverviewCommandDeck } from './overview/OverviewCommandDeck';
import { OverviewBriefing } from './overview/OverviewBriefing';
import { OverviewFindings } from './overview/OverviewFindings';
import { OverviewTopology } from './overview/OverviewTopology';
import { OverviewConfidence } from './overview/OverviewConfidence';
import { OverviewOnboarding } from './overview/OverviewOnboarding';

export interface OverviewTabProps {
  repositoryId: string;
  framework: string | null;
  languages: string[];
  entryPoints: string[];
  fileCount: number;
  totalSize: number;
  confidence: number;
  checklist: string[];
  setActiveTab: (tab: 'summary' | 'explorer' | 'graph' | 'trace' | 'impact' | 'chat' | 'settings') => void;
  onNavigateToExplorer?: (filePath: string) => void;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToImpact?: (filePath?: string) => void;
  onNavigateToTrace?: (filePath?: string) => void;
  onTriggerChat?: (prompt: string) => void;
  investigationTarget?: string;
  onSelectInvestigationTarget?: (target: string) => void;
}

export default function OverviewTab({
  repositoryId,
  framework,
  languages,
  entryPoints,
  fileCount,
  totalSize,
  confidence,
  checklist,
  setActiveTab,
  onNavigateToExplorer,
  onNavigateToGraph,
  onNavigateToImpact,
  onNavigateToTrace,
  onTriggerChat,
  investigationTarget,
  onSelectInvestigationTarget,
}: OverviewTabProps) {
  const [story, setStory] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [repoDetails, setRepoDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showManualButton, setShowManualButton] = useState(false);

  // Polling for AI summary if completed and summary missing
  useEffect(() => {
    if (!repoDetails || repoDetails.aiSummary || repoDetails.indexingStatus !== 'completed') return;

    // Show manual fallback button after 20 seconds of polling
    const timer = setTimeout(() => {
      setShowManualButton(true);
    }, 20000);

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/repos/${repositoryId}`);
        const repository = data.data;
        if (repository && repository.aiSummary) {
          setRepoDetails((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              aiSummary: repository.aiSummary,
            };
          });
          clearInterval(interval);
          clearTimeout(timer);
        }
      } catch (err) {
        console.warn('[OverviewTab] polling summary failed:', err);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [repoDetails?.aiSummary, repoDetails?.indexingStatus, repositoryId]);

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      const { data } = await api.post(`/repos/${repositoryId}/summary`);
      if (data.data) {
        setRepoDetails((prev: any) => ({
          ...prev,
          aiSummary: data.data,
        }));
        toast.success('AI Repository Summary generated successfully!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to generate summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Guard against React StrictMode double-mount and stale closures
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    const controller = new AbortController();
    const { signal } = controller;

    const withTimeout = <T,>(promise: Promise<T>, ms = 20_000): Promise<T> => {
      let timer: ReturnType<typeof setTimeout>;
      return new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Request timed out after ${ms / 1000}s`)), ms);
        promise.then(
          (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          (e) => {
            clearTimeout(timer);
            reject(e);
          }
        );
      });
    };

    setLoading(true);
    setError(null);

    let storySucceeded = false;
    let onboardingSucceeded = false;
    let insightsSucceeded = false;
    let detailsSucceeded = false;

    const fetchStory = withTimeout(api.get(`/repos/${repositoryId}/story`, { signal }))
      .then((res) => {
        if (fetchIdRef.current === fetchId) {
          setStory(res.data.data);
          storySucceeded = true;
        }
      })
      .catch((err) => {
        if (!signal.aborted) console.warn('[OverviewTab] story:', err.message);
      });

    const fetchOnboarding = withTimeout(api.get(`/repos/${repositoryId}/onboarding`, { signal }))
      .then((res) => {
        if (fetchIdRef.current === fetchId) {
          setOnboarding(res.data.data);
          onboardingSucceeded = true;
        }
      })
      .catch((err) => {
        if (!signal.aborted) console.warn('[OverviewTab] onboarding:', err.message);
      });

    const fetchInsights = withTimeout(api.get(`/repos/${repositoryId}/insights`, { signal }))
      .then((res) => {
        if (fetchIdRef.current === fetchId) {
          setInsights(res.data.data);
          insightsSucceeded = true;
        }
      })
      .catch((err) => {
        if (!signal.aborted) console.warn('[OverviewTab] insights:', err.message);
      });

    const fetchDetails = withTimeout(api.get(`/repos/${repositoryId}`, { signal }))
      .then((res) => {
        if (fetchIdRef.current !== fetchId) return;
        const repository = res.data.data;
        setRepoDetails({
          ...repository,
          scannedFiles: typeof repository.scannedFiles === 'string' ? JSON.parse(repository.scannedFiles) : repository.scannedFiles,
          languages: typeof repository.languages === 'string' ? JSON.parse(repository.languages) : repository.languages,
          entryPoints: typeof repository.entryPoints === 'string' ? JSON.parse(repository.entryPoints) : repository.entryPoints,
          dependencyGraph: typeof repository.dependencyGraph === 'string' ? JSON.parse(repository.dependencyGraph) : repository.dependencyGraph,
        });
        detailsSucceeded = true;
      })
      .catch((err) => {
        if (!signal.aborted) console.warn('[OverviewTab] details:', err.message);
      });

    Promise.allSettled([fetchStory, fetchOnboarding, fetchInsights, fetchDetails]).then(() => {
      if (fetchIdRef.current === fetchId) {
        setLoading(false);
        const allFailed = !storySucceeded && !onboardingSucceeded && !insightsSucceeded && !detailsSucceeded;
        if (allFailed) {
          const msg = 'Failed to load codebase overview. Please retry.';
          setError(msg);
          toast.error(msg);
        }
      }
    });

    return () => {
      controller.abort();
    };
  }, [repositoryId, retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loading message="Assembling architectural briefing..." type="skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <ErrorState
          title="Repository Analysis Unavailable"
          description={error}
          onRetry={() => setRetryCount((prev) => prev + 1)}
        />
      </div>
    );
  }

  // Derive findings stats from real backend data
  const architecturalDrift = insights?.architecturalDrift || [];
  const circularDependencies = insights?.circularDependencies || [];
  const centralityHotspots = insights?.centralityHotspots || [];
  const missingTests = insights?.missingTests || [];
  const deadCode = insights?.deadCode || [];

  // Parse dependency graph stats
  const depGraph = repoDetails?.dependencyGraph || {};
  const calculatedEdgesCount = Object.values(depGraph).reduce(
    (acc: number, val: any) => acc + (Array.isArray(val) ? val.length : 0),
    0
  );
  const calculatedNodesCount = repoDetails?.fileCount || Object.keys(depGraph).length || fileCount;

  // Real confidence and checklist from backend
  const resolvedConfidence = repoDetails?.confidenceDetails?.score ?? confidence;
  const resolvedChecklist = repoDetails?.confidenceDetails?.checklist ?? checklist;

  const scrollToFindings = () => {
    const el = document.getElementById('overview-findings');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-16 space-y-2">
      {/* ────────────────────────────────────────────────────────── */}
      {/* LEVEL 1: REPOSITORY IDENTITY & ARCHITECTURAL CONDITION    */}
      {/* ────────────────────────────────────────────────────────── */}
      <OverviewCommandDeck
        name={repoDetails?.name || 'Workspace'}
        owner={repoDetails?.owner}
        isLocal={repoDetails?.isLocal}
        framework={repoDetails?.framework || framework}
        languages={repoDetails?.languages || languages}
        fileCount={calculatedNodesCount}
        totalSize={repoDetails?.totalSize || totalSize}
        confidence={resolvedConfidence}
        entryPointsCount={entryPoints.length}
        driftCount={architecturalDrift.length}
        circularCount={circularDependencies.length}
        hotspotsCount={centralityHotspots.length}
        onNavigateToExplorer={() => onNavigateToExplorer?.(entryPoints[0] || '')}
        onNavigateToGraph={() => onNavigateToGraph?.()}
        onScrollToFindings={scrollToFindings}
      />

      {/* ────────────────────────────────────────────────────────── */}
      {/* LEVEL 1: AI TECHNICAL BRIEFING (Subordinate synthesis)     */}
      {/* ────────────────────────────────────────────────────────── */}
      <OverviewBriefing
        summaryData={repoDetails?.aiSummary}
        indexingStatus={repoDetails?.indexingStatus}
        summaryLoading={summaryLoading}
        showManualButton={showManualButton}
        onGenerateSummary={handleGenerateSummary}
        onExploreModule={(module) => onNavigateToExplorer?.(module)}
        onTriggerChat={onTriggerChat}
      />

      {/* ────────────────────────────────────────────────────────── */}
      {/* LEVEL 2: ARCHITECTURAL HEALTH & CRITICAL FINDINGS          */}
      {/* ────────────────────────────────────────────────────────── */}
      <OverviewFindings
        architecturalDrift={architecturalDrift}
        circularDependencies={circularDependencies}
        centralityHotspots={centralityHotspots}
        missingTests={missingTests}
        deadCode={deadCode}
        onNavigateToExplorer={onNavigateToExplorer}
        onNavigateToGraph={onNavigateToGraph}
        onNavigateToImpact={onNavigateToImpact}
        onTriggerChat={onTriggerChat}
      />

      {/* ────────────────────────────────────────────────────────── */}
      {/* LEVEL 2: ARCHITECTURE TOPOLOGY & REQUEST LIFECYCLE        */}
      {/* ────────────────────────────────────────────────────────── */}
      <OverviewTopology
        architectureType={story?.architectureType || repoDetails?.framework ? `${repoDetails?.framework} Architecture` : undefined}
        executionFlowStory={story?.executionFlowStory}
        entryPoints={entryPoints}
        dependencyGraph={depGraph}
        calculatedNodesCount={calculatedNodesCount}
        calculatedEdgesCount={calculatedEdgesCount}
        onNavigateToGraph={() => onNavigateToGraph?.()}
        onNavigateToExplorer={onNavigateToExplorer}
      />

      {/* ────────────────────────────────────────────────────────── */}
      {/* LEVEL 3: ANALYSIS CONFIDENCE & DETERMINISTIC EVIDENCE      */}
      {/* ────────────────────────────────────────────────────────── */}
      <OverviewConfidence
        confidence={resolvedConfidence}
        checklist={resolvedChecklist}
      />

      {/* ────────────────────────────────────────────────────────── */}
      {/* LEVEL 3: DEVELOPER ONBOARDING RUNBOOK                     */}
      {/* ────────────────────────────────────────────────────────── */}
      <OverviewOnboarding
        onboarding={onboarding}
        entryPoints={entryPoints}
        coreHotspots={story?.coreHotspots || []}
        onNavigateToExplorer={onNavigateToExplorer}
        onTriggerChat={onTriggerChat}
      />
    </div>
  );
}
