import React, { useState } from 'react';
import { toast } from 'sonner';

interface OnboardingData {
  prerequisites?: string[];
  setupCommands?: string[];
  databaseMigrationSteps?: string[];
  runCommands?: string[];
  troubleshootingTips?: string[];
}

interface OverviewOnboardingProps {
  onboarding: OnboardingData | null;
  entryPoints?: string[];
  coreHotspots?: string[];
  onNavigateToExplorer?: (filePath: string) => void;
  onTriggerChat?: (prompt: string) => void;
}

export const OverviewOnboarding: React.FC<OverviewOnboardingProps> = ({
  onboarding,
  entryPoints = [],
  coreHotspots = [],
  onNavigateToExplorer,
  onTriggerChat,
}) => {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({
    step_0: true,
  });
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success(`Copied: ${text}`);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleStep = (id: string) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const prerequisites = onboarding?.prerequisites || ['Node.js (v18 or higher)', 'npm or yarn package manager'];
  const setupCommands = onboarding?.setupCommands || ['npm install'];
  const migrations = onboarding?.databaseMigrationSteps || [];
  const runCommands = onboarding?.runCommands || ['npm run dev'];
  const tips = onboarding?.troubleshootingTips || [
    'Ensure you copy `.env.example` to `.env` before running the application.',
    'Check that all required environment variables are configured.',
  ];

  const renderCommands = (commands: string[], prefix: string) =>
    commands.map((cmd, idx) => (
      <div
        key={idx}
        className="flex items-center justify-between gap-2 rounded-[2px] border border-rule bg-paper px-2.5 py-1.5"
      >
        <code className="truncate font-mono text-[11.5px] text-ink" title={cmd}>
          {cmd}
        </code>
        <button
          type="button"
          onClick={() => copyToClipboard(cmd, `${prefix}-${idx}`)}
          className="abtn abtn--ghost shrink-0"
        >
          {copiedIndex === `${prefix}-${idx}` ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    ));

  return (
    <section aria-label="Developer Onboarding & Runbook">
      <div className="panel">
        <div className="panel__head">
          <div className="t">Developer onboarding &amp; runbook</div>
          <div className="r flex items-center gap-3">
            <span className="hidden sm:inline">Derived from framework &amp; dependency profile</span>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="figcap hover:text-ink"
            >
              {isExpanded ? 'Collapse runbook' : 'Expand full runbook'}
            </button>
          </div>
        </div>
        <div className="panel__body">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Interactive Checkbox Steps */}
            <div className="space-y-3 lg:col-span-6">
              <span className="figcap block">Setup checklist &amp; local dev lifecycle</span>

              {/* Step 1: Prerequisites */}
              <div className="space-y-1.5 rounded-[3px] border border-rule bg-paper-3 p-3">
                <label className="flex cursor-pointer select-none items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!checkedSteps['prereq']}
                    onChange={() => toggleStep('prereq')}
                    className="mt-0.5 cursor-pointer accent-emerald"
                  />
                  <div className="min-w-0">
                    <span className="block font-mono text-[12px] font-semibold text-ink">
                      1. Verify runtime prerequisites
                    </span>
                    <span className="font-mono text-[11px] text-ink-3">{prerequisites.join(' · ')}</span>
                  </div>
                </label>
              </div>

              {/* Step 2: Install */}
              <div className="space-y-2 rounded-[3px] border border-rule bg-paper-3 p-3">
                <label className="flex cursor-pointer select-none items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!checkedSteps['install']}
                    onChange={() => toggleStep('install')}
                    className="mt-0.5 cursor-pointer accent-emerald"
                  />
                  <div className="min-w-0">
                    <span className="block font-mono text-[12px] font-semibold text-ink">
                      2. Install codebase dependencies
                    </span>
                  </div>
                </label>
                {renderCommands(setupCommands, 'setup')}
              </div>

              {/* Step 3: Migrations (if applicable) */}
              {migrations.length > 0 && (
                <div className="space-y-2 rounded-[3px] border border-rule bg-paper-3 p-3">
                  <label className="flex cursor-pointer select-none items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={!!checkedSteps['migrate']}
                      onChange={() => toggleStep('migrate')}
                      className="mt-0.5 cursor-pointer accent-emerald"
                    />
                    <div className="min-w-0">
                      <span className="block font-mono text-[12px] font-semibold text-ink">
                        3. Synchronize database &amp; models
                      </span>
                    </div>
                  </label>
                  {renderCommands(migrations, 'mig')}
                </div>
              )}

              {/* Step 4: Run Application */}
              <div className="space-y-2 rounded-[3px] border border-rule bg-paper-3 p-3">
                <label className="flex cursor-pointer select-none items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!checkedSteps['run']}
                    onChange={() => toggleStep('run')}
                    className="mt-0.5 cursor-pointer accent-emerald"
                  />
                  <div className="min-w-0">
                    <span className="block font-mono text-[12px] font-semibold text-ink">
                      {migrations.length > 0 ? '4' : '3'}. Boot local server
                    </span>
                  </div>
                </label>
                {renderCommands(runCommands, 'run')}
              </div>
            </div>

            {/* Right Column: Code Navigation Jumpstarts & Tips */}
            <div className="space-y-3 lg:col-span-6">
              <span className="figcap block">Recommended investigation jumpstarts</span>

              {/* Primary Controllers Matrix */}
              <div className="rounded-[3px] border border-rule bg-paper-3 p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="figcap"><b>Entry controllers</b></span>
                  <span className="figcap">{entryPoints.length} detected</span>
                </div>
                {entryPoints.length === 0 ? (
                  <p className="m-0 font-mono text-[11.5px] text-ink-3">
                    No direct route controllers resolved.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {entryPoints.slice(0, isExpanded ? undefined : 4).map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between font-mono text-[11.5px]">
                        <span
                          onClick={() => onNavigateToExplorer?.(file)}
                          className="max-w-[280px] cursor-pointer truncate text-ink-2 hover:text-ink hover:underline"
                          title={file}
                        >
                          {file}
                        </span>
                        {onNavigateToExplorer && (
                          <button
                            type="button"
                            onClick={() => onNavigateToExplorer(file)}
                            className="figcap ml-2 shrink-0 hover:text-ink"
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Core Services Matrix */}
              {coreHotspots.length > 0 && (
                <div className="rounded-[3px] border border-rule bg-paper-3 p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="figcap"><b>Core business services</b></span>
                    <span className="figcap">{coreHotspots.length} registered</span>
                  </div>
                  <div className="space-y-1.5">
                    {coreHotspots.slice(0, isExpanded ? undefined : 4).map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between font-mono text-[11.5px]">
                        <span
                          onClick={() => onNavigateToExplorer?.(file)}
                          className="max-w-[280px] cursor-pointer truncate text-ink-2 hover:text-ink hover:underline"
                          title={file}
                        >
                          {file}
                        </span>
                        {onNavigateToExplorer && (
                          <button
                            type="button"
                            onClick={() => onNavigateToExplorer(file)}
                            className="figcap ml-2 shrink-0 hover:text-ink"
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Troubleshooting Tips */}
              <div className="rounded-[3px] border border-rule bg-paper-3 p-3">
                <span className="figcap mb-1.5 block"><b>Engineering notes &amp; environment</b></span>
                <ul className="m-0 list-disc space-y-1 pl-4 font-mono text-[11.5px] text-ink-2">
                  {tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
                {onTriggerChat && (
                  <button
                    type="button"
                    onClick={() =>
                      onTriggerChat('Explain how to get this codebase running locally, step by step.')
                    }
                    className="figcap mt-2 hover:text-ink"
                  >
                    Ask AI about setup ›
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
