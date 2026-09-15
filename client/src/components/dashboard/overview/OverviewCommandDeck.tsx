import React from 'react';
import { Panel, Typography, Button, Badge } from '../../ui/DesignSystem';

interface OverviewCommandDeckProps {
  name: string;
  owner?: string | null;
  isLocal?: boolean;
  framework?: string | null;
  languages: string[] | Record<string, number>;
  fileCount: number;
  totalSize: number;
  confidence: number;
  entryPointsCount: number;
  driftCount: number;
  circularCount: number;
  hotspotsCount: number;
  onNavigateToExplorer?: () => void;
  onNavigateToGraph?: () => void;
  onScrollToFindings?: () => void;
}

export const OverviewCommandDeck: React.FC<OverviewCommandDeckProps> = ({
  name,
  owner,
  isLocal = false,
  framework,
  languages,
  fileCount,
  totalSize,
  confidence,
  entryPointsCount,
  driftCount,
  circularCount,
  hotspotsCount,
  onNavigateToExplorer,
  onNavigateToGraph,
  onScrollToFindings,
}) => {
  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getPrimaryLanguage = () => {
    if (!languages) return 'TypeScript';
    // Non-code formats to deprioritize (typically config/data files, not primary programming languages)
    const lowPriorityLangs = ['json', 'yaml', 'yml', 'toml', 'markdown', 'md', 'xml', 'html', 'css', 'txt', 'ini', 'env', 'dockerfile', 'shell', 'sh', 'bash'];
    const langList: string[] = Array.isArray(languages) ? languages : Object.keys(languages);
    if (!langList.length) return 'TypeScript';
    // Try to find a high-priority programming language first
    const primaryCode = langList.find(l => !lowPriorityLangs.includes(l.toLowerCase()));
    return primaryCode || langList[0] || 'TypeScript';
  };


  const primaryLang = getPrimaryLanguage();

  const getLangColor = (lang: string) => {
    const l = lang.toLowerCase();
    if (l.includes('typescript')) return '#3178c6';
    if (l.includes('javascript')) return '#f7df1e';
    if (l.includes('python')) return '#3572A5';
    if (l.includes('go') || l.includes('golang')) return '#00ADD8';
    if (l.includes('rust')) return '#dea584';
    if (l.includes('java')) return '#b07219';
    return '#a855f7';
  };

  const hasIssues = driftCount > 0 || circularCount > 0;

  return (
    <section 
      aria-label="Repository Command Deck" 
      className="border-b border-[#27272a] pb-6 space-y-5"
    >
      {/* Upper Row: Identity & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant={isLocal ? 'warning' : 'neutral'} className="text-[10px] font-mono tracking-wider">
              {isLocal ? 'LOCAL REPO' : 'PUBLIC GITHUB'}
            </Badge>
            {owner && (
              <span className="text-[12px] font-mono text-[#919095]">
                {owner} /
              </span>
            )}
            <span className="text-[12px] font-mono font-semibold text-[#fafafa]">
              {name}
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-[26px] md:text-[30px] font-heading font-bold text-[#fafafa] tracking-tight m-0">
            {name}
          </h1>

          {/* Technology & Runtime tags */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[12px] font-mono text-[#919095]">
            <div className="flex items-center gap-1.5">
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: getLangColor(primaryLang) }} 
                aria-hidden="true"
              />
              <span className="text-[#c8c5ca] font-medium">{primaryLang}</span>
            </div>
            {framework && (
              <>
                <span className="text-[#47464a]">•</span>
                <span className="text-[#c8c5ca] font-medium">{framework}</span>
              </>
            )}
            <span className="text-[#47464a]">•</span>
            <span>{fileCount} tracked files</span>
            {totalSize > 0 && (
              <>
                <span className="text-[#47464a]">•</span>
                <span>{formatSize(totalSize)}</span>
              </>
            )}
            {entryPointsCount > 0 && (
              <>
                <span className="text-[#47464a]">•</span>
                <span>{entryPointsCount} entry {entryPointsCount === 1 ? 'point' : 'points'}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-start">
          {onNavigateToExplorer && (
            <Button
              variant="primary"
              size="md"
              onClick={onNavigateToExplorer}
              className="gap-2"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Explore Codebase</span>
            </Button>
          )}

          {onNavigateToGraph && (
            <Button
              variant="secondary"
              size="md"
              onClick={onNavigateToGraph}
              className="gap-2"
            >
              <svg className="w-4 h-4 fill-none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <path d="M12 8v4m-5 4l3-2m9 2l-3-2" />
              </svg>
              <span>View Architecture</span>
            </Button>
          )}
        </div>
      </div>

      {/* Lower Row: Architectural Condition Deck (High Density Status Bar) */}
      <div className="bg-[#131316] border border-[#27272a] rounded-[8px] p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
        {/* Metric 1: Overall Confidence */}
        <div className="flex flex-col justify-between border-r border-[#27272a]/60 pr-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095]">
            Engine Confidence
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[20px] font-heading font-bold text-white">
              {confidence}%
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
              confidence >= 80 
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' 
                : confidence >= 60 
                ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' 
                : 'bg-red-950/40 text-red-400 border border-red-800/40'
            }`}>
              {confidence >= 80 ? 'Optimal' : confidence >= 60 ? 'Moderate' : 'Incomplete'}
            </span>
          </div>
        </div>

        {/* Metric 2: Architectural Drift */}
        <div 
          onClick={onScrollToFindings}
          className={`flex flex-col justify-between border-r border-[#27272a]/60 pr-2 ${
            driftCount > 0 ? 'cursor-pointer group' : ''
          }`}
          title={driftCount > 0 ? 'Click to inspect architectural drift violations' : undefined}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] group-hover:text-[#fafafa] transition-colors">
            Layer Drift
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-[20px] font-heading font-bold ${
              driftCount > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {driftCount}
            </span>
            <span className="text-[11px] font-mono text-[#919095]">
              {driftCount === 0 ? 'violations' : driftCount === 1 ? 'violation' : 'violations'}
            </span>
          </div>
        </div>

        {/* Metric 3: Circular Dependencies */}
        <div 
          onClick={onScrollToFindings}
          className={`flex flex-col justify-between border-r border-[#27272a]/60 pr-2 ${
            circularCount > 0 ? 'cursor-pointer group' : ''
          }`}
          title={circularCount > 0 ? 'Click to inspect circular dependency cycles' : undefined}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] group-hover:text-[#fafafa] transition-colors">
            Import Cycles
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-[20px] font-heading font-bold ${
              circularCount > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {circularCount}
            </span>
            <span className="text-[11px] font-mono text-[#919095]">
              {circularCount === 1 ? 'cycle' : 'cycles'}
            </span>
          </div>
        </div>

        {/* Metric 4: Centrality Hotspots */}
        <div 
          onClick={onScrollToFindings}
          className="flex flex-col justify-between cursor-pointer group"
          title="Click to view high-centrality files"
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] group-hover:text-[#fafafa] transition-colors">
            Central Hotspots
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[20px] font-heading font-bold text-white">
              {hotspotsCount}
            </span>
            <span className="text-[11px] font-mono text-[#919095]">
              key files
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
