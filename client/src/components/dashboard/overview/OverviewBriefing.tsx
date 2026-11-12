import React, { useState } from 'react';

interface AISummaryData {
  summary?: string;
  purpose?: string;
  targetUsers?: string[];
  keyFeatures?: string[];
  coreModules?: string[];
  techStack?: string[];
  complexity?: 'Low' | 'Medium' | 'High' | string;
}

interface OverviewBriefingProps {
  summaryData?: AISummaryData | null;
  indexingStatus?: string;
  summaryLoading?: boolean;
  showManualButton?: boolean;
  onGenerateSummary?: () => void;
  onExploreModule?: (moduleName: string) => void;
  onTriggerChat?: (prompt: string) => void;
}

export const OverviewBriefing: React.FC<OverviewBriefingProps> = ({
  summaryData,
  indexingStatus,
  summaryLoading = false,
  showManualButton = false,
  onGenerateSummary,
  onExploreModule,
  onTriggerChat,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summaryData) {
    if (showManualButton) {
      return (
        <section aria-label="Technical Briefing">
          <div className="panel">
            <div className="panel__head">
              <div className="t">Codebase technical briefing</div>
              <div className="r">{indexingStatus || 'not generated'}</div>
            </div>
            <div className="panel__body">
              <p className="text-[13px] leading-[1.65] text-ink-2">
                Generate a structured synthesis of the domain, purpose, modules, and tech stack derived
                from repository AST and entry points.
              </p>
              <button
                type="button"
                className="abtn abtn--ghost mt-4"
                onClick={onGenerateSummary}
                disabled={summaryLoading}
              >
                {summaryLoading ? 'Synthesizing…' : 'Generate technical briefing'}
              </button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section aria-label="Technical Briefing">
        <div className="panel">
          <div className="panel__head">
            <div className="t">
              <span className="st st--live">
                <i />
                Synthesizing
              </span>
            </div>
            {onGenerateSummary && (
              <button
                type="button"
                className="abtn abtn--ghost"
                onClick={onGenerateSummary}
                disabled={summaryLoading}
              >
                Force generate
              </button>
            )}
          </div>
          <div className="panel__body">
            <p className="figcap">
              Analyzing architecture entrypoints, routes, and package boundaries in background.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const {
    summary,
    purpose,
    targetUsers = [],
    keyFeatures = [],
    coreModules = [],
    techStack = [],
    complexity,
  } = summaryData;

  return (
    <section aria-label="Codebase Technical Briefing">
      <div className="brief mb-6">
        <div className="brief__k">Technical briefing · architectural &amp; domain synthesis</div>

        {(summary || purpose) && (
          <>
            {purpose && (
              <p>
                <b>Purpose.</b> {purpose}
              </p>
            )}
            {summary && <p>{summary}</p>}
          </>
        )}

        <div className="mt-5 grid grid-cols-1 gap-6 border-t border-rule pt-4 md:grid-cols-12">
          <div className="space-y-4 md:col-span-7">
            {targetUsers.length > 0 && (
              <div>
                <span className="figcap mb-2 block">Target consumers</span>
                <div className="flex flex-wrap gap-1.5">
                  {targetUsers.map((user, idx) => (
                    <span
                      key={idx}
                      className="rounded-[2px] border border-rule bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] text-ink-2"
                    >
                      {user}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {techStack.length > 0 && (
              <div>
                <span className="figcap mb-2 block">Technology profile</span>
                <div className="flex flex-wrap gap-1.5">
                  {techStack.map((tech, idx) => (
                    <span
                      key={idx}
                      className="rounded-[2px] border border-rule bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] text-ink-2"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-rule pt-4 md:col-span-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <div className="flex items-center justify-between gap-3">
              {complexity && (
                <span className={complexity.toLowerCase() === 'high' ? 'st st--risk' : complexity.toLowerCase() === 'low' ? 'st st--ok' : 'st st--warn'}>
                  <i />
                  Complexity {complexity}
                </span>
              )}
              {onTriggerChat && (
                <button
                  type="button"
                  onClick={() =>
                    onTriggerChat(
                      `Explain the architectural intent and design choices of ${summary || purpose || 'this codebase'}`
                    )
                  }
                  className="figcap hover:text-ink"
                  title="Query AI Assistant about this architecture"
                >
                  Ask AI ›
                </button>
              )}
            </div>

            {coreModules.length > 0 && (
              <div>
                <span className="figcap mb-2 block">Identified core modules</span>
                <div className="flex flex-wrap gap-1.5">
                  {coreModules.map((module, idx) => (
                    <button
                      key={idx}
                      onClick={() => onExploreModule?.(module)}
                      className="rounded-[2px] border border-rule bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
                      title={`Inspect module: ${module}`}
                    >
                      {module}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {keyFeatures.length > 0 && (
              <div>
                <span className="figcap mb-2 block">Key architectural capabilities</span>
                <ul className="m-0 list-disc space-y-1 pl-4 text-[12px] leading-[1.6] text-ink-2">
                  {keyFeatures.slice(0, isExpanded ? undefined : 3).map((feat, idx) => (
                    <li key={idx} className="truncate" title={feat}>
                      {feat}
                    </li>
                  ))}
                </ul>
                {keyFeatures.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="figcap mt-2 hover:text-ink"
                  >
                    {isExpanded ? 'Show less' : `+ ${keyFeatures.length - 3} more capabilities`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
