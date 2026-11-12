import React from 'react';
import { FileIntelligence } from './explorerTypes';
import { getRoleLabel } from './explorerUtils';

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
  const roleLabel = getRoleLabel(intelligence.role);

  const inbound = intelligence.inboundDependents;
  const outbound = intelligence.outboundDependencies;
  const driftCount = intelligence.driftViolations.length;

  return (
    <div className="intel flex h-full flex-col overflow-y-auto select-none font-mono text-[11px]">
      {/* 1. HEADER */}
      <div className="intel__sec flex shrink-0 items-center justify-between bg-paper-2">
        <div className="flex items-center gap-2">
          <span className="st st--live" title="Intelligence inspector live">
            <i /> architectural intelligence
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="cursor-pointer rounded-[2px] p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
            title="Collapse inspector"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 space-y-0">
        {/* 2. IDENTITY & ARCHITECTURAL ROLE */}
        <div className="intel__sec space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="intel__k mb-0">Architectural role</span>
            <span className="figcap text-ink-2">{roleLabel}</span>
          </div>

          <div>
            <span className="block truncate font-mono text-[12.5px] font-semibold text-ink" title={intelligence.name}>
              {intelligence.name}
            </span>
            <span className="block truncate text-[10px] text-ink-3" title={intelligence.path}>
              {intelligence.path}
            </span>
          </div>

          <div className="border-t border-rule pt-1">
            <div className="ikv">
              <span className="k">lines</span>
              <span className="v">{intelligence.lines}</span>
            </div>
            <div className="ikv">
              <span className="k">language</span>
              <span className="v">{intelligence.language}</span>
            </div>
            <div className="ikv">
              <span className="k">size</span>
              <span className="v">{intelligence.size} B</span>
            </div>
            <div className="ikv">
              <span className="k">entry point</span>
              <span className="v">{intelligence.isEntryPoint ? 'yes' : 'no'}</span>
            </div>
          </div>
        </div>

        {/* 3. HEALTH & CENTRALITY METRICS */}
        <div className="intel__sec space-y-2.5">
          <span className="intel__k">Health & topology</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[3px] border border-rule bg-paper-2 p-2">
              <span className="block text-[9px] uppercase tracking-[.12em] text-ink-3">Inbound callers</span>
              <span className="mt-0.5 block text-[18px] font-semibold leading-none text-ink">
                {inbound.length}
              </span>
              <span className="text-[9.5px] text-ink-3">
                {inbound.length > 5 ? 'high blast radius' : 'low impact'}
              </span>
            </div>

            <div className="rounded-[3px] border border-rule bg-paper-2 p-2">
              <span className="block text-[9px] uppercase tracking-[.12em] text-ink-3">Outbound deps</span>
              <span className="mt-0.5 block text-[18px] font-semibold leading-none text-ink">
                {outbound.length}
              </span>
              <span className="text-[9.5px] text-ink-3">direct imports</span>
            </div>
          </div>

          {/* Centrality hotspot callout */}
          {intelligence.inDegree >= 5 && (
            <div className="rounded-[3px] border border-amber/30 bg-amber/10 p-2 text-[10.5px] leading-[1.5] text-amber">
              <strong className="font-semibold">Centrality anchor.</strong> Heavily coupled with {intelligence.inDegree} incoming dependencies; modifications ripple across the codebase.
            </div>
          )}

          {/* Architectural drift callout */}
          {driftCount > 0 && (
            <div className="rounded-[3px] border border-sig/30 bg-sig/10 p-2 text-[10.5px] leading-[1.5] text-sig">
              <strong className="font-semibold">Layer violation.</strong> Breaches architectural boundaries ({driftCount} occurrence{driftCount === 1 ? '' : 's'}).
            </div>
          )}

          {/* Cycle callout */}
          {intelligence.cycleInvolvement.length > 0 && (
            <div className="rounded-[3px] border border-amber/30 bg-amber/10 p-2 text-[10.5px] leading-[1.5] text-amber">
              <strong className="font-semibold">Import cycle.</strong> Participates in {intelligence.cycleInvolvement.length} dependency loop{intelligence.cycleInvolvement.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>

        {/* 4. ACTIONS CONTINUITY DECK */}
        <div className="intel__sec space-y-2">
          <span className="intel__k">Direct investigations</span>

          <div className="space-y-1.5">
            {onNavigateToGraph && (
              <button
                onClick={() => onNavigateToGraph(intelligence.path)}
                className="abtn abtn--ghost w-full justify-between px-2.5 py-1.5 text-[10.5px]"
              >
                <span>View in architecture graph</span>
                <span className="text-ink-3">→</span>
              </button>
            )}

            {onNavigateToImpact && (
              <button
                onClick={() => onNavigateToImpact(intelligence.path)}
                className="abtn abtn--ghost w-full justify-between px-2.5 py-1.5 text-[10.5px]"
              >
                <span>Analyze blast radius</span>
                <span className="text-ink-3">→</span>
              </button>
            )}

            {onNavigateToTrace && (
              <button
                onClick={() => onNavigateToTrace(intelligence.path)}
                className="abtn abtn--ghost w-full justify-between px-2.5 py-1.5 text-[10.5px]"
              >
                <span>Trace execution flow</span>
                <span className="text-ink-3">→</span>
              </button>
            )}

            {onTriggerChat && (
              <button
                onClick={() => onTriggerChat(`Explain the architectural responsibilities and design patterns of ${intelligence.path}`)}
                className="abtn abtn--solid w-full justify-between px-2.5 py-1.5 text-[10.5px]"
              >
                <span>Ask Archon about this file</span>
                <span>✦</span>
              </button>
            )}
          </div>
        </div>

        {/* 5. INBOUND DEPENDENTS ("USED BY") */}
        <div className="intel__sec space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="intel__k mb-0">Used by ({inbound.length})</span>
            <span className="figcap">inbound callers</span>
          </div>

          {inbound.length > 0 ? (
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {inbound.map((dep) => (
                <button
                  key={dep}
                  onClick={() => onSelectFile(dep)}
                  className="block w-full truncate rounded-[2px] border border-transparent px-1.5 py-1 text-left font-mono text-[10.5px] text-ink-2 transition-colors hover:border-forest/40 hover:bg-forest/10 hover:text-emerald"
                  title={`Pivot to ${dep}`}
                >
                  {dep}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-1 text-[10.5px] italic text-ink-3">
              No inbound dependents — file is an entry point or unreferenced.
            </p>
          )}
        </div>

        {/* 6. OUTBOUND DEPENDENCIES ("DEPENDS ON") */}
        <div className="intel__sec space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="intel__k mb-0">Depends on ({outbound.length})</span>
            <span className="figcap">imports</span>
          </div>

          {outbound.length > 0 ? (
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {outbound.map((dep) => (
                <button
                  key={dep}
                  onClick={() => onSelectFile(dep)}
                  className="block w-full truncate rounded-[2px] border border-transparent px-1.5 py-1 text-left font-mono text-[10.5px] text-ink-2 transition-colors hover:border-forest/40 hover:bg-forest/10 hover:text-emerald"
                  title={`Pivot to ${dep}`}
                >
                  {dep}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-1 text-[10.5px] italic text-ink-3">
              No local repository imports detected.
            </p>
          )}
        </div>

        {/* 7. AST INTERFACE MAP */}
        {intelligence.astInfo && (
          (intelligence.astInfo.classes?.length || 0) > 0 ||
          (intelligence.astInfo.functions?.length || 0) > 0
        ) && (
          <div className="intel__sec space-y-2">
            <span className="intel__k">AST interface symbols</span>

            {/* Classes */}
            {intelligence.astInfo.classes && intelligence.astInfo.classes.length > 0 && (
              <div className="space-y-1">
                <span className="figcap text-ink-2">Classes — {intelligence.astInfo.classes.length}</span>
                <div className="mini">
                  <div className="mini__body">
                    {intelligence.astInfo.classes.map((c, i) => (
                      <div key={i} className="mini__row !grid-cols-[1fr_auto]">
                        <span className="p">
                          <span className="text-ink-3">class </span>
                          <span className="font-semibold text-ink">{typeof c?.name === 'string' ? c.name : 'AnonymousClass'}</span>
                        </span>
                        <span className="n">{c?.methods?.length ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Functions */}
            {intelligence.astInfo.functions && intelligence.astInfo.functions.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="figcap text-ink-2">Functions — {intelligence.astInfo.functions.length}</span>
                <div className="mini">
                  <div className="mini__body max-h-40 overflow-y-auto">
                    {intelligence.astInfo.functions.map((f, i) => (
                      <div key={i} className="mini__row !grid-cols-[1fr_auto]">
                        <span className="p">
                          <span className="text-ink-3">function </span>
                          <span className="font-semibold text-ink">{typeof f?.name === 'string' ? f.name : 'anonymous'}</span>
                        </span>
                        <span className="n">{f?.params?.length ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
