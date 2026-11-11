import React, { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
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
  setActiveTab: (tab: 'summary' | 'explorer' | 'graph' | 'trace' | 'impact' | 'chat') => void;
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

  // Polling for AI summary once the codebase is structurally ready
  useEffect(() => {
    const usableStatus =
      repoDetails?.indexingStatus === 'completed' ||
      repoDetails?.indexingStatus === 'structural-ready';
    if (!repoDetails || repoDetails.aiSummary || !usableStatus) return;

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
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
          Assembling architectural briefing…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel mx-auto max-w-[560px]">
        <div className="panel__head">
          <div className="t">Overview unavailable</div>
        </div>
        <div className="panel__body">
          <p className="text-[13px] leading-[1.65] text-ink-2">{error}</p>
          <button
            type="button"
            className="abtn abtn--ghost mt-4"
            onClick={() => setRetryCount((prev) => prev + 1)}
          >
            Retry
          </button>
        </div>
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

  return (
    <div className="kview !pt-0">
      {/* ── header ────────────────────────────────────────────────────── */}
      <div className="khead">
        <div className="khead__l">
          <div className="eyebrow">Overview</div>
          <h1 className="khead__t">
            What this repository <em className="serif-it">is</em>, structurally.
          </h1>
          <p className="khead__d">
            Generated from the parsed syntax trees and the resolved import graph. Every statement
            below is traceable to a file; the citation is shown with it.
          </p>
        </div>
        <div className="khead__r">
          {repoDetails?.framework && (
            <span className="st st--idle">
              <i />
              {repoDetails.framework}
            </span>
          )}
          <span className={resolvedConfidence >= 80 ? 'st st--ok' : resolvedConfidence >= 60 ? 'st st--warn' : 'st st--risk'}>
            <i />
            Confidence {resolvedConfidence}
          </span>
        </div>
      </div>

      {/* ── metric row — every figure is measured, none is asserted ───── */}
      <div className="kmetrics">
        <div className="kmetric">
          <div className="k">Files indexed</div>
          <div className="v">
            {calculatedNodesCount}
            {Array.isArray(repoDetails?.scannedFiles) && (
              <small>of {repoDetails.scannedFiles.length}</small>
            )}
          </div>
          <div className="sub">
            {Array.isArray(repoDetails?.languages) ? repoDetails.languages.join(' · ') : '—'}
          </div>
        </div>

        <div className="kmetric">
          <div className="k">Import edges</div>
          <div className="v">{calculatedEdgesCount.toLocaleString()}</div>
          <div className="sub">resolved from the dependency graph</div>
        </div>

        <div className="kmetric">
          <div className="k">Entry points</div>
          <div className="v">{entryPoints.length}</div>
          <div className="sub">{entryPoints[0] || 'none detected'}</div>
        </div>

        <div className={resolvedConfidence >= 80 ? 'kmetric kmetric--ok' : 'kmetric kmetric--risk'}>
          <div className="k">Confidence</div>
          <div className="v">
            {resolvedConfidence}
            <small>/ 100</small>
          </div>
          <div className="sub">deterministic score</div>
        </div>
      </div>

      {/* ── the briefing — the one synthesis, kept visually dominant ──── */}
      <OverviewBriefing
        summaryData={repoDetails?.aiSummary}
        indexingStatus={repoDetails?.indexingStatus}
        summaryLoading={summaryLoading}
        showManualButton={showManualButton}
        onGenerateSummary={handleGenerateSummary}
        onExploreModule={(module) => onNavigateToExplorer?.(module)}
        onTriggerChat={onTriggerChat}
      />

      {/* ── topology and confidence, side by side like the reference ──── */}
      <div className="ksplit mb-6">
        <OverviewTopology
          architectureType={
            story?.architectureType ||
            (repoDetails?.framework ? `${repoDetails.framework} Architecture` : undefined)
          }
          executionFlowStory={story?.executionFlowStory}
          entryPoints={entryPoints}
          dependencyGraph={depGraph}
          calculatedNodesCount={calculatedNodesCount}
          calculatedEdgesCount={calculatedEdgesCount}
          onNavigateToGraph={() => onNavigateToGraph?.()}
          onNavigateToExplorer={onNavigateToExplorer}
        />
        <OverviewConfidence
          confidence={resolvedConfidence}
          checklist={resolvedChecklist}
        />
      </div>

      {/* ── cited findings ─────────────────────────────────────────────── */}
      <div id="overview-findings">
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
      </div>

      {/* ── the runbook ────────────────────────────────────────────────── */}
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
