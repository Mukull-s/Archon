import React, { useState } from 'react';
import { Panel, Typography, Button, Badge } from '../../ui/DesignSystem';
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

  return (
    <section 
      aria-label="Developer Onboarding & Runbook" 
      className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5 my-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#27272a]/60 pb-3.5 mb-5 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" aria-hidden="true" />
          <h2 className="text-[12px] font-mono font-bold text-white uppercase tracking-wider m-0">
            Developer Onboarding & Architecture Runbook
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#919095]">
            Derived from framework & dependency profile
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] font-mono text-[#3b82f6] hover:underline cursor-pointer ml-2"
          >
            {isExpanded ? 'Collapse Runbook' : 'Expand Full Runbook'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Checkbox Steps */}
        <div className="lg:col-span-6 space-y-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#919095] block mb-1">
            Setup Checklist & Local Dev Lifecycle
          </span>

          {/* Step 1: Prerequisites */}
          <div className="p-3 bg-[#131316] border border-[#27272a] rounded-[6px] space-y-1.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!checkedSteps['prereq']}
                onChange={() => toggleStep('prereq')}
                className="mt-0.5 rounded-sm bg-[#09090b] border-[#27272a] text-[#3b82f6] focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-[12px] font-mono font-semibold text-white block">
                  1. Verify Runtime Prerequisites
                </span>
                <span className="text-[11px] font-mono text-[#919095]">
                  {prerequisites.join(' · ')}
                </span>
              </div>
            </label>
          </div>

          {/* Step 2: Install */}
          <div className="p-3 bg-[#131316] border border-[#27272a] rounded-[6px] space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!checkedSteps['install']}
                onChange={() => toggleStep('install')}
                className="mt-0.5 rounded-sm bg-[#09090b] border-[#27272a] text-[#3b82f6] focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-[12px] font-mono font-semibold text-white block">
                  2. Install Codebase Dependencies
                </span>
              </div>
            </label>
            {setupCommands.map((cmd, idx) => (
              <div key={idx} className="flex items-center justify-between bg-[#09090b] border border-[#27272a] px-2.5 py-1.5 rounded-[4px]">
                <code className="text-[11.5px] font-mono text-[#adc6ff]">{cmd}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cmd, `setup-${idx}`)}
                  className="text-[10px] font-mono text-[#919095] hover:text-white px-2 py-0.5 bg-[#18181b] border border-[#27272a] rounded cursor-pointer transition-colors"
                >
                  {copiedIndex === `setup-${idx}` ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            ))}
          </div>

          {/* Step 3: Migrations (if applicable) */}
          {migrations.length > 0 && (
            <div className="p-3 bg-[#131316] border border-[#27272a] rounded-[6px] space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!checkedSteps['migrate']}
                  onChange={() => toggleStep('migrate')}
                  className="mt-0.5 rounded-sm bg-[#09090b] border-[#27272a] text-[#3b82f6] focus:ring-0 cursor-pointer"
                />
                <div className="min-w-0">
                  <span className="text-[12px] font-mono font-semibold text-white block">
                    3. Synchronize Database & Models
                  </span>
                </div>
              </label>
              {migrations.map((cmd, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#09090b] border border-[#27272a] px-2.5 py-1.5 rounded-[4px]">
                  <code className="text-[11px] font-mono text-[#adc6ff] truncate mr-2" title={cmd}>{cmd}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cmd, `mig-${idx}`)}
                    className="text-[10px] font-mono text-[#919095] hover:text-white px-2 py-0.5 bg-[#18181b] border border-[#27272a] rounded cursor-pointer transition-colors shrink-0"
                  >
                    {copiedIndex === `mig-${idx}` ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Run Application */}
          <div className="p-3 bg-[#131316] border border-[#27272a] rounded-[6px] space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!checkedSteps['run']}
                onChange={() => toggleStep('run')}
                className="mt-0.5 rounded-sm bg-[#09090b] border-[#27272a] text-[#3b82f6] focus:ring-0 cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-[12px] font-mono font-semibold text-white block">
                  {migrations.length > 0 ? '4' : '3'}. Boot Local Server
                </span>
              </div>
            </label>
            {runCommands.map((cmd, idx) => (
              <div key={idx} className="flex items-center justify-between bg-[#09090b] border border-[#27272a] px-2.5 py-1.5 rounded-[4px]">
                <code className="text-[11.5px] font-mono text-[#adc6ff]">{cmd}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cmd, `run-${idx}`)}
                  className="text-[10px] font-mono text-[#919095] hover:text-white px-2 py-0.5 bg-[#18181b] border border-[#27272a] rounded cursor-pointer transition-colors"
                >
                  {copiedIndex === `run-${idx}` ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Code Navigation Jumpstarts & Tips */}
        <div className="lg:col-span-6 space-y-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#919095] block mb-1">
            Recommended Investigation Jumpstarts
          </span>

          {/* Primary Controllers Matrix */}
          <div className="p-3.5 bg-[#131316] border border-[#27272a] rounded-[6px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold uppercase text-[#fafafa]">
                Entry Controllers
              </span>
              <span className="text-[10.5px] font-mono text-[#919095]">
                {entryPoints.length} detected
              </span>
            </div>
            {entryPoints.length === 0 ? (
              <p className="text-[11.5px] font-mono text-[#919095] m-0">No direct route controllers resolved.</p>
            ) : (
              <div className="space-y-1.5">
                {entryPoints.slice(0, isExpanded ? undefined : 4).map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11.5px] font-mono">
                    <span 
                      onClick={() => onNavigateToExplorer?.(file)}
                      className="text-[#c8c5ca] hover:text-white hover:underline cursor-pointer truncate max-w-[280px]"
                      title={file}
                    >
                      {file}
                    </span>
                    {onNavigateToExplorer && (
                      <button
                        type="button"
                        onClick={() => onNavigateToExplorer(file)}
                        className="text-[#3b82f6] hover:underline cursor-pointer text-[10.5px] shrink-0 ml-2"
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
            <div className="p-3.5 bg-[#131316] border border-[#27272a] rounded-[6px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-bold uppercase text-[#fafafa]">
                  Core Business Services
                </span>
                <span className="text-[10.5px] font-mono text-[#919095]">
                  {coreHotspots.length} registered
                </span>
              </div>
              <div className="space-y-1.5">
                {coreHotspots.slice(0, isExpanded ? undefined : 4).map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11.5px] font-mono">
                    <span 
                      onClick={() => onNavigateToExplorer?.(file)}
                      className="text-[#c8c5ca] hover:text-white hover:underline cursor-pointer truncate max-w-[280px]"
                      title={file}
                    >
                      {file}
                    </span>
                    {onNavigateToExplorer && (
                      <button
                        type="button"
                        onClick={() => onNavigateToExplorer(file)}
                        className="text-[#3b82f6] hover:underline cursor-pointer text-[10.5px] shrink-0 ml-2"
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
          <div className="p-3 bg-[#131316] border border-[#27272a] rounded-[6px]">
            <span className="text-[11px] font-mono font-bold uppercase text-[#fafafa] block mb-1.5">
              Engineering Notes & Environment
            </span>
            <ul className="list-disc list-inside space-y-1 text-[11.5px] font-mono text-[#919095] m-0">
              {tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
