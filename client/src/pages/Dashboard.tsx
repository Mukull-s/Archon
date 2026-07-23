import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import OverviewTab from '../components/dashboard/OverviewTab';
import ScopeSelector from '../components/dashboard/ScopeSelector';
import ChatConsole from '../components/dashboard/ChatConsole';
import CodeGraph from '../components/dashboard/CodeGraph';
import ExecutionTracing from '../components/dashboard/ExecutionTracing';
import ImpactAnalysis from '../components/dashboard/ImpactAnalysis';
import api from '../lib/api';
import { toast } from 'sonner';
import AppShell from '../components/dashboard/AppShell';
import { Loading, Typography, Panel, Button } from '../components/ui/DesignSystem';

interface FileItem {
  path: string;
  size: number;
  lines: number;
}

interface RepositoryData {
  id: string;
  name: string;
  owner: string | null;
  isLocal: boolean;
  framework: string | null;
  languages: string[];
  entryPoints: string[];
  importantFiles: string[];
  fileCount: number;
  totalSize: number;
  confidence: number;
  isIndexed?: boolean;
  scannedFiles: FileItem[];
  astMetadata: any;
  dependencyGraph: any;
  confidenceDetails?: {
    score: number;
    checklist: string[];
  };
}

interface ImpactResult {
  filePath: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedFilesCount: number;
  affectedFiles: string[];
  categories: {
    routes: string[];
    services: string[];
    controllers: string[];
    components: string[];
    others: string[];
  };
  summary?: string;
}

type TabId = 'summary' | 'explorer' | 'graph' | 'trace' | 'impact' | 'chat' | 'settings';

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [repo, setRepo] = useState<RepositoryData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedExplorerFile, setSelectedExplorerFile] = useState<string | null>(null);
  const [autoTriggerChatPrompt, setAutoTriggerChatPrompt] = useState<string | null>(null);

  // Impact state
  const [impactTarget, setImpactTarget] = useState<string>('');
  const [analyzingImpact, setAnalyzingImpact] = useState(false);
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);

  // Shared Investigation Context
  const [investigationTarget, setInvestigationTarget] = useState<string>('');
  const changeInvestigationTarget = (target: string) => {
    setInvestigationTarget(target);
    setImpactTarget(target);
  };


  // Fetch repository data
  useEffect(() => {
    if (!id) return;
    const fetchRepo = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/repos/${id}`);
        const repository = data.data;
        const scannedFiles = typeof repository.scannedFiles === 'string'
          ? JSON.parse(repository.scannedFiles) : repository.scannedFiles;
        const parsedRepo: RepositoryData = {
          ...repository,
          scannedFiles,
          languages: typeof repository.languages === 'string' ? JSON.parse(repository.languages) : repository.languages,
          entryPoints: typeof repository.entryPoints === 'string' ? JSON.parse(repository.entryPoints) : repository.entryPoints,
          importantFiles: typeof repository.importantFiles === 'string' ? JSON.parse(repository.importantFiles) : repository.importantFiles
        };
        setRepo(parsedRepo);
        setSelectedFiles(new Set<string>(scannedFiles.map((f: FileItem) => f.path)));
        if (parsedRepo.entryPoints.length > 0) {
          setImpactTarget(parsedRepo.entryPoints[0]);
          setInvestigationTarget(parsedRepo.entryPoints[0]);
        } else if (scannedFiles.length > 0) {
          setImpactTarget(scannedFiles[0].path);
          setInvestigationTarget(scannedFiles[0].path);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.error?.message || 'Failed to load repository.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchRepo();
  }, [id, navigate]);

  // Command Palette event handlers
  useEffect(() => {
    const handleSelectFile = (e: Event) => {
      const filePath = (e as CustomEvent).detail;
      setSelectedExplorerFile(filePath);
      setActiveTab('explorer');
    };

    const handleTriggerChat = (e: Event) => {
      const prompt = (e as CustomEvent).detail;
      setAutoTriggerChatPrompt(prompt);
      setActiveTab('chat');
    };

    window.addEventListener('command-palette-select-file', handleSelectFile);
    window.addEventListener('command-palette-trigger-chat', handleTriggerChat);

    return () => {
      window.removeEventListener('command-palette-select-file', handleSelectFile);
      window.removeEventListener('command-palette-trigger-chat', handleTriggerChat);
    };
  }, []);

  const handleToggleFile = (filePath: string) => {
    const s = new Set(selectedFiles);
    s.has(filePath) ? s.delete(filePath) : s.add(filePath);
    setSelectedFiles(s);
  };

  const handleToggleFolder = (folderPath: string, checked: boolean) => {
    if (!repo) return;
    const s = new Set(selectedFiles);
    repo.scannedFiles.forEach(f => {
      if (f.path.startsWith(folderPath + '/') || f.path === folderPath) {
        checked ? s.add(f.path) : s.delete(f.path);
      }
    });
    setSelectedFiles(s);
  };

  const handleAnalyzeImpact = async () => {
    if (!id || !impactTarget) return;
    setAnalyzingImpact(true);
    setImpactResult(null);
    try {
      const { data } = await api.post(`/repos/${id}/impact`, { filePath: impactTarget });
      setImpactResult(data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Impact analysis failed.');
    } finally {
      setAnalyzingImpact(false);
    }
  };

  const selectionStats = useMemo(() => {
    if (!repo) return { count: 0, size: 0 };
    let size = 0;
    repo.scannedFiles.forEach(f => { if (selectedFiles.has(f.path)) size += f.size; });
    return { count: selectedFiles.size, size };
  }, [repo, selectedFiles]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getRiskBadge = (level: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      HIGH: { label: '🔴 High Risk', color: '#f43f5e', bg: 'rgba(244,63,94,0.08)' },
      MEDIUM: { label: '🟡 Medium Risk', color: '#eab308', bg: 'rgba(234,179,8,0.08)' },
      LOW: { label: '🟢 Low Risk', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    };
    return map[level] || map.LOW;
  };
  if (loading) {
    return (
      <div className="stitch-theme fixed inset-0 flex items-center justify-center bg-[#09090b]">
        <Loading message="Loading repository analysis..." type="spinner" />
      </div>
    );
  }

  if (!repo) return null;

  return (
    <AppShell
      repository={repo}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    >
      {/* 1. OVERVIEW TAB */}
      {activeTab === 'summary' && (
        <OverviewTab
          repositoryId={repo.id}
          framework={repo.framework}
          languages={repo.languages}
          entryPoints={repo.entryPoints}
          fileCount={repo.fileCount}
          totalSize={repo.totalSize}
          confidence={repo.confidenceDetails?.score ?? repo.confidence}
          checklist={repo.confidenceDetails?.checklist ?? (repo.confidence >= 80
            ? ['✓ Dependency graph resolved', '✓ Entry points detected', '✓ Code structure mapped']
            : ['⚠ Partial scan completed'])}
          setActiveTab={setActiveTab}
        />
      )}

      {/* 2. EXPLORER (FILES) TAB */}
      {activeTab === 'explorer' && (
        <ScopeSelector
          files={repo.scannedFiles}
          selectedFiles={selectedFiles}
          onToggleFile={handleToggleFile}
          onToggleFolder={handleToggleFolder}
          repositoryId={repo.id}
          astMetadata={repo.astMetadata}
          dependencyGraph={repo.dependencyGraph}
          selectedExplorerFile={selectedExplorerFile}
          setSelectedExplorerFile={setSelectedExplorerFile}
        />
      )}

      {/* 3. ARCHITECTURE TAB */}
      {activeTab === 'graph' && (
        <CodeGraph
          repositoryId={repo.id}
          scannedFiles={repo.scannedFiles}
          dependencyGraph={repo.dependencyGraph}
          astMetadata={repo.astMetadata}
          investigationTarget={investigationTarget}
          setInvestigationTarget={changeInvestigationTarget}
        />
      )}

      {/* 4. EXECUTION FLOW TAB */}
      {activeTab === 'trace' && (
        <ExecutionTracing
          repositoryId={repo.id}
          scannedFiles={repo.scannedFiles}
          dependencyGraph={repo.dependencyGraph}
          astMetadata={repo.astMetadata}
          onNavigateToExplorer={(filePath: string) => {
            setSelectedExplorerFile(filePath);
            setActiveTab('explorer');
          }}
          onTriggerChatQuery={(query: string) => {
            setAutoTriggerChatPrompt(query);
            setActiveTab('chat');
          }}
        />
      )}

      {/* 5. IMPACT ANALYSIS TAB */}
      {activeTab === 'impact' && (
        <ImpactAnalysis
          repositoryId={repo.id}
          files={repo.scannedFiles}
          dependencyGraph={repo.dependencyGraph}
          astMetadata={repo.astMetadata}
          onNavigateToExplorer={(filePath: string) => {
            setSelectedExplorerFile(filePath);
            setActiveTab('explorer');
          }}
          onTriggerChatQuery={(query: string) => {
            setAutoTriggerChatPrompt(query);
            setActiveTab('chat');
          }}
        />
      )}

      {/* 6. AI ASSISTANT TAB */}
      {activeTab === 'chat' && (
        <ChatConsole
          repositoryId={repo.id}
          selectedFiles={selectedFiles}
          onToggleFile={handleToggleFile}
          isIndexed={repo.isIndexed}
          onNavigateToFile={(filePath: string) => {
            setSelectedExplorerFile(filePath);
            setActiveTab('explorer');
          }}
          autoTriggerChatPrompt={autoTriggerChatPrompt}
          onClearAutoPrompt={() => setAutoTriggerChatPrompt(null)}
        />
      )}

      {/* 7. SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="flex flex-col gap-4">
          <Panel className="p-5" variant="base">
            <Typography variant="headline" as="h3" className="mb-1">Repository Details & Metadata</Typography>
            <Typography variant="body-sm" className="mb-6">Technical specifications and metadata generated during repository ingestion.</Typography>

            <div className="space-y-6">
              {/* Repo Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Typography variant="label-caps" className="mb-1 text-[#919095] block">Repository ID</Typography>
                  <div className="bg-[#09090b] border border-[#27272a] rounded-[6px] p-2.5 font-mono text-[12px] text-[#fafafa] select-all">
                    {repo.id}
                  </div>
                </div>

                <div>
                  <Typography variant="label-caps" className="mb-1 text-[#919095] block">Ingestion Source Type</Typography>
                  <div className="bg-[#09090b] border border-[#27272a] rounded-[6px] p-2.5 text-[13px] text-[#fafafa] flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${repo.isLocal ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                    {repo.isLocal ? 'Local ZIP Upload' : `GitHub Repository (${repo.owner || 'Unknown'})`}
                  </div>
                </div>

                <div>
                  <Typography variant="label-caps" className="mb-1 text-[#919095] block">Framework / Runtime</Typography>
                  <div className="bg-[#09090b] border border-[#27272a] rounded-[6px] p-2.5 text-[13px] text-[#fafafa]">
                    {repo.framework || 'Generic Codebase / Undetected'}
                  </div>
                </div>

                <div>
                  <Typography variant="label-caps" className="mb-1 text-[#919095] block">Confidence Level</Typography>
                  <div className="bg-[#09090b] border border-[#27272a] rounded-[6px] p-2.5 text-[13px] text-[#fafafa] flex items-center gap-2">
                    <div className="flex-1 bg-[#1c1c1e] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#a855f7] h-full" style={{ width: `${repo.confidence}%` }} />
                    </div>
                    <span className="font-mono text-[12px] text-[#a855f7] font-semibold">{repo.confidence}%</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="border-t border-[#27272a] pt-5">
                <Typography variant="label-caps" className="mb-3 text-[#919095] block">Analysis Metrics</Typography>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0e0e11] border border-[#27272a] p-4 rounded-[6px] text-center">
                    <div className="text-[20px] font-mono font-bold text-[#fafafa]">{repo.fileCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[#919095] mt-1">Files Scanned</div>
                  </div>
                  <div className="bg-[#0e0e11] border border-[#27272a] p-4 rounded-[6px] text-center">
                    <div className="text-[20px] font-mono font-bold text-[#fafafa]">{(repo.totalSize / 1024).toFixed(1)} KB</div>
                    <div className="text-[10px] uppercase tracking-wider text-[#919095] mt-1">Total Size</div>
                  </div>
                  <div className="bg-[#0e0e11] border border-[#27272a] p-4 rounded-[6px] text-center">
                    <div className="text-[20px] font-mono font-bold text-[#fafafa]">{repo.languages.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[#919095] mt-1">Languages</div>
                  </div>
                  <div className="bg-[#0e0e11] border border-[#27272a] p-4 rounded-[6px] text-center">
                    <div className="text-[20px] font-mono font-bold text-[#fafafa]">{repo.entryPoints.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[#919095] mt-1">Entry Points</div>
                  </div>
                </div>
              </div>

              {/* Languages List */}
              <div className="border-t border-[#27272a] pt-5">
                <Typography variant="label-caps" className="mb-2.5 text-[#919095] block">Ingested Languages</Typography>
                <div className="flex flex-wrap gap-2">
                  {repo.languages.map((lang: string) => (
                    <span key={lang} className="bg-[#1c1c1e] border border-[#27272a] rounded-[4px] px-2.5 py-1 text-[11px] font-mono text-[#e4e1e5]">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
