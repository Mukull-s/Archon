import React from 'react';
import { FileIntelligence } from './explorerTypes';
import { getRoleBadgeStyle } from './explorerUtils';

interface ExplorerIntelligencePanelProps {
  intelligence: FileIntelligence;
  onSelectFile: (filePath: string) => void;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToImpact?: (filePath?: string) => void;
  onNavigateToTrace?: (filePath?: string) => void;
  onTriggerChat?: (prompt: string) => void;
  onClose?: () => void;
}

export default function ExplorerIntelligencePanel({
  intelligence,
  onSelectFile,
  onNavigateToGraph,
  onNavigateToImpact,
  onNavigateToTrace,
  onTriggerChat,
  onClose
}: ExplorerIntelligencePanelProps) {
  const roleStyle = getRoleBadgeStyle(intelligence.role);

  return (
    <div className="h-full flex flex-col bg-[#0d0d10] border-l border-zinc-800/80 overflow-y-auto select-none font-mono text-[12px] scrollbar-thin scrollbar-thumb-zinc-800">
      {/* 1. HEADER */}
      <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between flex-shrink-0 bg-[#111114]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-heading font-semibold text-white text-[13px] tracking-tight">
            Architectural Intelligence
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800"
            title="Collapse Inspector"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-3.5 space-y-4 flex-1">
        {/* 2. IDENTITY & ARCHITECTURAL ROLE */}
        <div className="bg-[#141418] border border-zinc-800/90 rounded-[6px] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
              Architectural Role
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}`}
            >
              {roleStyle.label}
            </span>
          </div>

          <div>
            <span className="text-[13px] font-bold text-white block truncate" title={intelligence.name}>
              {intelligence.name}
            </span>
            <span className="text-[11px] text-zinc-500 block truncate" title={intelligence.path}>
              {intelligence.path}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60 text-[11px]">
            <div>
              <span className="text-zinc-500 block">Lines</span>
              <span className="text-zinc-200 font-semibold">{intelligence.lines}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Language</span>
              <span className="text-zinc-200 font-semibold">{intelligence.language}</span>
            </div>
          </div>
        </div>

        {/* 3. HEALTH & CENTRALITY METRICS */}
        <div className="bg-[#141418] border border-zinc-800/90 rounded-[6px] p-3 space-y-2.5">
          <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider block">
            Health & Topology
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0e0e11] p-2 rounded border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Inbound Callers</span>
              <span className="text-[16px] font-bold text-white block mt-0.5">
                {intelligence.inboundDependents.length}
              </span>
              <span className="text-[10px] text-zinc-500">
                {intelligence.inboundDependents.length > 5 ? 'High Blast Radius' : 'Low Impact'}
              </span>
            </div>

            <div className="bg-[#0e0e11] p-2 rounded border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Outbound Deps</span>
              <span className="text-[16px] font-bold text-white block mt-0.5">
                {intelligence.outboundDependencies.length}
              </span>
              <span className="text-[10px] text-zinc-500">Direct Imports</span>
            </div>
          </div>

          {/* Centrality Hotspot callout */}
          {intelligence.inDegree >= 5 && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
              ★ <strong className="font-semibold">Centrality Anchor:</strong> This file is heavily coupled with {intelligence.inDegree} incoming dependencies. Modifications will ripple across the codebase.
            </div>
          )}

          {/* Architectural Drift Callout */}
          {intelligence.driftViolations.length > 0 && (
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
              ⚠ <strong className="font-semibold">Layer Violation:</strong> Violates architectural boundaries ({intelligence.driftViolations.length} occurrences).
            </div>
          )}
        </div>

        {/* 4. ACTIONS CONTINUITY DECK */}
        <div className="bg-[#141418] border border-zinc-800/90 rounded-[6px] p-3 space-y-2">
          <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider block">
            Direct Investigations
          </span>

          <div className="space-y-1.5">
            {onNavigateToGraph && (
              <button
                onClick={() => onNavigateToGraph(intelligence.path)}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#1b1b22] hover:bg-[#252530] text-zinc-200 border border-zinc-700/60 transition-colors flex items-center justify-between text-[11.5px] cursor-pointer"
              >
                <span>View in Architecture Graph</span>
                <span className="text-primary">➔</span>
              </button>
            )}

            {onNavigateToImpact && (
              <button
                onClick={() => onNavigateToImpact(intelligence.path)}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#1b1b22] hover:bg-[#252530] text-zinc-200 border border-zinc-700/60 transition-colors flex items-center justify-between text-[11.5px] cursor-pointer"
              >
                <span>Analyze Blast Radius</span>
                <span className="text-amber-400">➔</span>
              </button>
            )}

            {onNavigateToTrace && (
              <button
                onClick={() => onNavigateToTrace(intelligence.path)}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#1b1b22] hover:bg-[#252530] text-zinc-200 border border-zinc-700/60 transition-colors flex items-center justify-between text-[11.5px] cursor-pointer"
              >
                <span>Trace Execution Flow</span>
                <span className="text-blue-400">➔</span>
              </button>
            )}

            {onTriggerChat && (
              <button
                onClick={() => onTriggerChat(`Explain the architectural responsibilities and design patterns of ${intelligence.path}`)}
                className="w-full text-left px-2.5 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors flex items-center justify-between text-[11.5px] cursor-pointer"
              >
                <span>Ask Archon AI About File</span>
                <span>✦</span>
              </button>
            )}
          </div>
        </div>

        {/* 5. INBOUND DEPENDENTS ("USED BY") */}
        <div className="bg-[#141418] border border-zinc-800/90 rounded-[6px] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
              Used By ({intelligence.inboundDependents.length})
            </span>
            <span className="text-[10px] text-zinc-500">Inbound Callers</span>
          </div>

          {intelligence.inboundDependents.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {intelligence.inboundDependents.map((dep) => (
                <div
                  key={dep}
                  onClick={() => onSelectFile(dep)}
                  className="p-1.5 rounded bg-[#0e0e11] hover:bg-primary/10 hover:text-primary hover:border-primary/40 border border-transparent text-zinc-300 text-[11px] truncate cursor-pointer transition-colors"
                  title={`Pivot to ${dep}`}
                >
                  {dep}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600 italic py-1">
              No inbound dependents detected. (File is an entry point or unreferenced).
            </p>
          )}
        </div>

        {/* 6. OUTBOUND DEPENDENCIES ("DEPENDS ON") */}
        <div className="bg-[#141418] border border-zinc-800/90 rounded-[6px] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
              Depends On ({intelligence.outboundDependencies.length})
            </span>
            <span className="text-[10px] text-zinc-500">Imports</span>
          </div>

          {intelligence.outboundDependencies.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {intelligence.outboundDependencies.map((dep) => (
                <div
                  key={dep}
                  onClick={() => onSelectFile(dep)}
                  className="p-1.5 rounded bg-[#0e0e11] hover:bg-primary/10 hover:text-primary hover:border-primary/40 border border-transparent text-zinc-300 text-[11px] truncate cursor-pointer transition-colors"
                  title={`Pivot to ${dep}`}
                >
                  {dep}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600 italic py-1">
              No local repository imports detected.
            </p>
          )}
        </div>

        {/* 7. AST INTERFACE MAP */}
        {intelligence.astInfo && (intelligence.astInfo.classes?.length > 0 || intelligence.astInfo.functions?.length > 0) && (
          <div className="bg-[#141418] border border-zinc-800/90 rounded-[6px] p-3 space-y-2">
            <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider block">
              AST Interface Symbols
            </span>

            {/* Classes */}
            {intelligence.astInfo.classes && intelligence.astInfo.classes.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-blue-400 font-bold uppercase">Classes:</span>
                {intelligence.astInfo.classes.map((c, i) => (
                  <div key={i} className="text-[11px] text-zinc-300 bg-[#0e0e11] px-2 py-1 rounded">
                    class <span className="text-white font-semibold">{typeof c?.name === 'string' ? c.name : 'AnonymousClass'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Functions */}
            {intelligence.astInfo.functions && intelligence.astInfo.functions.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase">Functions:</span>
                <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-thin">
                  {intelligence.astInfo.functions.map((f, i) => (
                    <div key={i} className="text-[11px] text-zinc-300 bg-[#0e0e11] px-2 py-1 rounded truncate">
                      function <span className="text-white font-semibold">{typeof f?.name === 'string' ? f.name : 'anonymous'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
