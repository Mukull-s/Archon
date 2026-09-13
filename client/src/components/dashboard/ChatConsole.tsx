import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { Loading, ErrorState } from '../ui/DesignSystem';

export interface Message {
  id: string;
  sender: 'USER' | 'AI';
  message: string;
  modelUsed?: string | null;
  createdAt: string;
}

export interface ChatConsoleProps {
  repositoryId: string;
  selectedFiles: Set<string>;
  onToggleFile: (filePath: string) => void;
  isIndexed?: boolean;
  onNavigateToFile?: (filePath: string) => void;
  autoTriggerChatPrompt?: string | null;
  onClearAutoPrompt?: () => void;
  investigationTarget?: string | null;
  onSelectInvestigationTarget?: (target: string) => void;
  onNavigateToExplorer?: (filePath: string) => void;
  onNavigateToGraph?: () => void;
  onNavigateToImpact?: (target?: string) => void;
  onNavigateToTrace?: (traceId?: string) => void;
  scannedFiles?: Array<{ path: string; size?: number; language?: string }>;
  framework?: string | null;
}

// 4 Lightweight Investigation Starters
const INVESTIGATION_STARTERS = [
  {
    title: 'Codebase Architecture & System Boundaries',
    prompt: 'Explain the high-level architecture of this repository, its core modules, directory boundaries, and primary design patterns.',
  },
  {
    title: 'Authentication & Authorization Lifecycle',
    prompt: 'Trace the authentication and authorization lifecycle in this codebase. How are credentials validated, tokens issued, and protected routes guarded?',
  },
  {
    title: 'Core Services & Data Flow',
    prompt: 'Map the core services, data models, and database interactions. Which services handle business logic and how do they communicate?',
  },
  {
    title: 'Structural Bottlenecks & High Blast-Radius Files',
    prompt: 'Identify the most critical files in this repository with high dependency fan-in or complex coupling, and suggest regression test strategies.',
  },
];

// Production standard: Strip raw context dump prefixes from user display
function cleanMessageForDisplay(text: string): string {
  if (!text) return '';
  return text.replace(/^\[Context:[\s\S]*?\]\s*/i, '').trim();
}

export default function ChatConsole({
  repositoryId,
  selectedFiles,
  onToggleFile,
  isIndexed,
  onNavigateToFile,
  autoTriggerChatPrompt = null,
  onClearAutoPrompt,
  investigationTarget = null,
  onSelectInvestigationTarget,
  onNavigateToExplorer,
  onNavigateToGraph,
  onNavigateToImpact,
  onNavigateToTrace,
  scannedFiles = [],
  framework = null,
}: ChatConsoleProps) {
  // Synchronous cache retrieval prevents flickering
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const cached = localStorage.getItem(`archon_chat_history_${repositoryId}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState(!!isIndexed);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [loadingStep, setLoadingStep] = useState('Analyzing repository context...');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<{ intent: string; steps: string[] } | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);

  // Dedicated scroll container management (ChatGPT / Claude production standard)
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [repoInfo, setRepoInfo] = useState<{
    name: string;
    fileCount: number;
    languages: string[];
    framework: string | null;
  } | null>(null);

  // Fetch repository metadata for context
  useEffect(() => {
    let isMounted = true;
    const fetchRepoInfo = async () => {
      try {
        const { data } = await api.get(`/repos/${repositoryId}?lite=true`);
        if (data.data && isMounted) {
          const repo = data.data;
          setRepoInfo({
            name: repo.name,
            fileCount: repo.fileCount || scannedFiles.length || 0,
            languages: typeof repo.languages === 'string'
              ? JSON.parse(repo.languages)
              : (repo.languages || []),
            framework: repo.framework || framework
          });
        }
      } catch (err) {
        console.warn('Failed to fetch repository metadata:', err);
      }
    };
    fetchRepoInfo();
    return () => { isMounted = false; };
  }, [repositoryId, scannedFiles.length, framework]);

  // Sync index state
  useEffect(() => {
    if (isIndexed !== undefined) {
      setIndexed(isIndexed);
    }
  }, [isIndexed]);

  // Load chat history from backend if not already in local cache
  useEffect(() => {
    if (messages.length > 0) return;
    let isMounted = true;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data } = await api.get(`/repos/${repositoryId}/chat/history`);
        if (data.data && data.data.length > 0 && isMounted) {
          setMessages(data.data);
          setIndexed(true);
          localStorage.setItem(`archon_chat_history_${repositoryId}`, JSON.stringify(data.data));
        }
      } catch (err) {
        console.warn('History API request failed:', err);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [repositoryId]);

  // Handle external auto-trigger prompt (e.g. from Explorer, Impact, or Trace tabs)
  useEffect(() => {
    if (autoTriggerChatPrompt) {
      sendMessage(autoTriggerChatPrompt);
      if (onClearAutoPrompt) onClearAutoPrompt();
    }
  }, [autoTriggerChatPrompt]);

  // Handle scroll events in dedicated feed container
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const offset = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(offset <= 80);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior
      });
    }
  };

  // Live-edge auto scroll: follow tokens only if already at bottom
  useEffect(() => {
    if (isAtBottom && (loading || messages.length > 0)) {
      scrollToBottom('auto');
    }
  }, [messages, loading, loadingStep, isAtBottom]);

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 160)}px`;
  }, [input]);

  // Ensure codebase vector index is ready
  const ensureIndexed = async () => {
    if (indexed) return;
    setIndexing(true);
    setLoadingStep('Indexing repository schemas...');
    try {
      await api.post(`/repos/${repositoryId}/index`, {}, { timeout: 300000 });
      setIndexed(true);
    } catch (err) {
      toast.error('Failed to build vector index for codebase search.');
      throw err;
    } finally {
      setIndexing(false);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading || indexing) return;
    await sendMessage(prompt);
  };

  const sendMessage = async (promptText: string) => {
    setInput('');
    setLoading(true);
    setCurrentPlan(null);
    setAiError(null);
    setLoadingStep('Searching codebase context...');
    setIsAtBottom(true); // Engages live auto-scroll on new submission

    // Clean contextual prompt for backend (only targeted focus file if set, NEVER a 60-file dump)
    let backendPrompt = promptText;
    if (investigationTarget && !promptText.includes(investigationTarget)) {
      backendPrompt = `[Target Focus: "${investigationTarget}"]\n\n${promptText}`;
    }

    const token = localStorage.getItem('archon_token');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    // Store only clean prompt in user message for display
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'USER',
      message: promptText,
      createdAt: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    localStorage.setItem(`archon_chat_history_${repositoryId}`, JSON.stringify(updatedMessages));

    const aiMessageId = crypto.randomUUID();
    const tempAiMsg: Message = {
      id: aiMessageId,
      sender: 'AI',
      message: '',
      createdAt: new Date().toISOString()
    };

    const controller = new AbortController();
    setAbortController(controller);

    try {
      await ensureIndexed();
      setMessages(prev => [...prev, tempAiMsg]);
      setLoadingStep('Synthesizing intelligence response...');

      const response = await fetch(`${baseUrl}/repos/${repositoryId}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          message: backendPrompt,
          model: 'qwen/qwen3-coder:free'
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'AI engine failed.');
      }

      if (!response.body) {
        throw new Error('Empty stream response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completeText = '';
      let activeModel = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned || cleaned === 'data: [DONE]') continue;
          if (cleaned.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(cleaned.slice(6));
              if (parsed.error) {
                toast.error(parsed.error);
                continue;
              }

              if (parsed.plan) {
                setCurrentPlan(parsed.plan);
                continue;
              }

              const tokenText = parsed.token || '';
              activeModel = parsed.modelUsed || activeModel;
              completeText += tokenText;

              setMessages(prev => {
                const idx = prev.findIndex(m => m.id === aiMessageId);
                if (idx === -1) return prev;
                const nextArr = [...prev];
                nextArr[idx] = {
                  ...nextArr[idx],
                  message: completeText,
                  modelUsed: activeModel
                };
                return nextArr;
              });
            } catch {
              // Partial line in chunk, wait for next buffer flush
            }
          }
        }
      }

      // Persist final conversation
      setMessages(prev => {
        localStorage.setItem(`archon_chat_history_${repositoryId}`, JSON.stringify(prev));
        return prev;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Generation stopped.');
      } else {
        const errorMsg = err.message || 'AI request failed.';
        setAiError(errorMsg);
        toast.error(errorMsg);
        setMessages(prev => prev.filter(m => m.id !== aiMessageId));
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleRegenerate = async () => {
    if (messages.length < 2 || loading) return;
    let lastPromptIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'USER') {
        lastPromptIdx = i;
        break;
      }
    }
    if (lastPromptIdx === -1) return;
    const lastPrompt = cleanMessageForDisplay(messages[lastPromptIdx].message);
    setMessages(prev => prev.slice(0, lastPromptIdx));
    await sendMessage(lastPrompt);
  };

  const handleClearChat = () => {
    if (window.confirm('Clear conversation history for this repository?')) {
      setMessages([]);
      localStorage.removeItem(`archon_chat_history_${repositoryId}`);
      toast.success('Conversation history cleared.');
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Rule 6: EVIDENCE GROUNDING - Strictly verify file references against scannedFiles
  const getGroundedEvidenceFiles = (text: string): Array<{ path: string; name: string }> => {
    if (!text || !scannedFiles || scannedFiles.length === 0) return [];
    
    const candidates = new Set<string>();

    // 1. Bracket matches: [filename.ts] or [src/path.ts]
    const bracketMatches = text.match(/\[([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\]/g);
    if (bracketMatches) {
      bracketMatches.forEach(m => candidates.add(m.slice(1, -1).trim()));
    }

    // 2. Inline code matches: `filename.ts` or `src/path.ts`
    const codeMatches = text.match(/`([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)`/g);
    if (codeMatches) {
      codeMatches.forEach(m => candidates.add(m.slice(1, -1).trim()));
    }

    // 3. Path structure matches: src/... or server/... or client/...
    const pathMatches = text.match(/(?:(?:src|client|server|lib|components|routes|controllers|services|models|pages|utils)\/[a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/g);
    if (pathMatches) {
      pathMatches.forEach(m => candidates.add(m.trim()));
    }

    const verified: Array<{ path: string; name: string }> = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const normalizedCandidate = candidate.replace(/^[./\\]+/, '').replace(/\\/g, '/');
      const matched = scannedFiles.find(f => {
        const norm = f.path.replace(/\\/g, '/');
        return norm === normalizedCandidate || norm.endsWith('/' + normalizedCandidate);
      });

      if (matched && !seen.has(matched.path)) {
        seen.add(matched.path);
        verified.push({
          path: matched.path,
          name: matched.path.split('/').pop() || matched.path
        });
      }
    }

    return verified;
  };

  // Rule 5: CONTEXTUAL ACTIONS
  const getContextualActions = (text: string, groundedFiles: Array<{ path: string; name: string }>) => {
    const lower = text.toLowerCase();
    const actions: Array<{ label: string; icon: string; onClick: () => void; primary?: boolean }> = [];

    // File referenced: Inspect in Explorer & Analyze Impact
    if (groundedFiles.length > 0) {
      const primaryTarget = groundedFiles[0].path;
      actions.push({
        label: `Inspect ${groundedFiles[0].name}`,
        icon: '📁',
        primary: true,
        onClick: () => {
          if (onSelectInvestigationTarget) onSelectInvestigationTarget(primaryTarget);
          if (onNavigateToExplorer) onNavigateToExplorer(primaryTarget);
          else if (onNavigateToFile) onNavigateToFile(primaryTarget);
        }
      });

      actions.push({
        label: `Analyze Impact`,
        icon: '💥',
        onClick: () => {
          if (onSelectInvestigationTarget) onSelectInvestigationTarget(primaryTarget);
          if (onNavigateToImpact) onNavigateToImpact(primaryTarget);
        }
      });
    }

    // Execution path discussed: Trace Execution
    const discussesExecution = 
      lower.includes('execution') ||
      lower.includes('lifecycle') ||
      lower.includes('request flow') ||
      lower.includes('middleware') ||
      lower.includes('pipeline') ||
      lower.includes('trace');

    if (discussesExecution && onNavigateToTrace) {
      actions.push({
        label: 'Trace Execution',
        icon: '⚡',
        onClick: () => onNavigateToTrace()
      });
    }

    // Architecture discussed: View Architecture
    const discussesArchitecture =
      lower.includes('architecture') ||
      lower.includes('dependency graph') ||
      lower.includes('subsystem') ||
      lower.includes('module boundaries') ||
      lower.includes('layer');

    if (discussesArchitecture && onNavigateToGraph) {
      actions.push({
        label: 'View Architecture',
        icon: '🕸️',
        onClick: () => onNavigateToGraph()
      });
    }

    return actions;
  };

  // Inline text renderer for markdown
  const renderInlineText = (text: string, keyBase: number) => {
    const boldSegments = text.split(/\*\*(.*?)\*\*/g).map((segment, i) => {
      if (i % 2 === 1) return <strong key={`b-${keyBase}-${i}`} className="text-white font-semibold">{segment}</strong>;
      return segment.split(/`([^`]+)`/g).map((part, j) => {
        if (j % 2 === 1) {
          // Check if this inline code is a verified real file
          const normPart = part.replace(/^[./\\]+/, '').replace(/\\/g, '/');
          const matchedFile = scannedFiles.find(f => {
            const norm = f.path.replace(/\\/g, '/');
            return norm === normPart || norm.endsWith('/' + normPart);
          });

          if (matchedFile) {
            return (
              <button
                key={`filecode-${keyBase}-${i}-${j}`}
                type="button"
                onClick={() => {
                  if (onSelectInvestigationTarget) onSelectInvestigationTarget(matchedFile.path);
                  if (onNavigateToExplorer) onNavigateToExplorer(matchedFile.path);
                  else if (onNavigateToFile) onNavigateToFile(matchedFile.path);
                }}
                className="bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#60a5fa] px-1.5 py-0.5 rounded font-mono text-[12px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                title={`Inspect ${matchedFile.path}`}
              >
                <span>📁</span>
                <span>{matchedFile.path.split('/').pop()}</span>
              </button>
            );
          }

          return (
            <code key={`c-${keyBase}-${i}-${j}`} className="bg-[#18181b] border border-[#27272a] px-1.5 py-0.5 rounded text-[#e4e4e7] font-mono text-[12px]">
              {part}
            </code>
          );
        }
        return part;
      });
    });
    return <span key={`inline-${keyBase}`}>{boldSegments}</span>;
  };

  // Editorial Markdown parser
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const flushList = (key: string) => {
      if (currentList.length > 0) {
        if (listType === 'ul') {
          elements.push(
            <ul key={key} className="list-disc pl-5 my-3 space-y-1.5 text-[#d4d4d8] leading-relaxed text-[13.5px]">
              {currentList}
            </ul>
          );
        } else if (listType === 'ol') {
          elements.push(
            <ol key={key} className="list-decimal pl-5 my-3 space-y-1.5 text-[#d4d4d8] leading-relaxed text-[13.5px]">
              {currentList}
            </ol>
          );
        }
        currentList = [];
        listType = null;
      }
    };

    const flushTable = (key: string) => {
      if (inTable) {
        elements.push(
          <div key={key} className="my-4 overflow-x-auto border border-[#27272a] rounded-lg">
            <table className="min-w-full divide-y divide-[#27272a] text-[13px] font-sans">
              <thead className="bg-[#121215]">
                <tr>
                  {tableHeaders.map((h, idx) => (
                    <th key={idx} className="px-3.5 py-2.5 text-left font-mono font-semibold text-[#fafafa] border-b border-[#27272a]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] bg-[#0e0e11]">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#18181b]/60 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-[#d4d4d8]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeaders = [];
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Table detection
      if (trimmed.startsWith('|')) {
        flushList(`list-before-table-${i}`);
        const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
          if (i + 1 < lines.length && (lines[i + 1].includes('|-') || lines[i + 1].includes('| -'))) {
            i++;
          }
        } else {
          tableRows.push(cells);
        }
        continue;
      } else {
        flushTable(`table-before-text-${i}`);
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        flushList(`list-before-h3-${i}`);
        elements.push(
          <h4 key={i} className="text-[14px] font-mono font-bold text-white mt-5 mb-2 tracking-tight">
            {renderInlineText(trimmed.slice(4), i)}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList(`list-before-h2-${i}`);
        elements.push(
          <h3 key={i} className="text-[16px] font-mono font-bold text-white mt-6 mb-2.5 pb-1 border-b border-[#27272a]/40 tracking-tight">
            {renderInlineText(trimmed.slice(3), i)}
          </h3>
        );
      } else if (trimmed.startsWith('# ')) {
        flushList(`list-before-h1-${i}`);
        elements.push(
          <h2 key={i} className="text-[18px] font-mono font-bold text-white mt-7 mb-3 pb-1.5 border-b border-[#27272a]/60 tracking-tight">
            {renderInlineText(trimmed.slice(2), i)}
          </h2>
        );
      }
      // Blockquotes
      else if (trimmed.startsWith('> ')) {
        flushList(`list-before-bq-${i}`);
        elements.push(
          <blockquote key={i} className="border-l-2 border-[#3b82f6] bg-[#3b82f6]/5 pl-4 py-2 pr-3 my-3 rounded-r text-[#93c5fd] text-[13px] italic">
            {renderInlineText(trimmed.slice(2), i)}
          </blockquote>
        );
      }
      // Unordered Lists
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList(`list-type-ul-${i}`);
          listType = 'ul';
        }
        currentList.push(<li key={`li-${i}`}>{renderInlineText(trimmed.slice(2), i)}</li>);
      }
      // Ordered Lists
      else if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== 'ol') {
          flushList(`list-type-ol-${i}`);
          listType = 'ol';
        }
        const match = trimmed.match(/^\d+\.\s(.*)/);
        currentList.push(<li key={`li-${i}`}>{renderInlineText(match ? match[1] : trimmed, i)}</li>);
      }
      // Empty line
      else if (!trimmed) {
        flushList(`list-empty-${i}`);
      }
      // Normal Paragraph
      else {
        flushList(`list-para-${i}`);
        elements.push(
          <p key={i} className="my-2.5 leading-relaxed text-[#d4d4d8] font-sans text-[13.5px]">
            {renderInlineText(line, i)}
          </p>
        );
      }
    }

    flushList('list-final');
    flushTable('table-final');

    return elements;
  };

  // AI Content Formatter with syntax code blocks
  const renderAIContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIdx = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(
          <div key={`md-${parts.length}`}>
            {parseMarkdown(text.substring(lastIdx, match.index))}
          </div>
        );
      }
      const langName = match[1] || 'CODE';
      const codeSnippet = match[2].trim();
      parts.push(
        <div key={`code-block-${parts.length}`} className="my-4 border border-[#27272a] rounded-lg bg-[#0d0d10] overflow-hidden font-mono shadow-sm">
          <div className="flex justify-between items-center bg-[#131316] px-3.5 py-1.5 border-b border-[#27272a] text-[11px] text-[#919095] select-none">
            <span className="font-semibold text-zinc-400 tracking-wider uppercase text-[10.5px]">
              {langName}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(codeSnippet);
                toast.success('Code copied to clipboard');
              }}
              className="text-[#919095] hover:text-white flex items-center gap-1.5 cursor-pointer text-[11px] transition-colors py-0.5 px-1.5 rounded hover:bg-[#1f1f23]"
              title="Copy code snippet"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-4 text-[12.5px] text-[#e4e4e7] overflow-x-auto leading-relaxed whitespace-pre font-mono">
            <code>{codeSnippet}</code>
          </pre>
        </div>
      );
      lastIdx = codeBlockRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(
        <div key={`md-final`}>
          {parseMarkdown(text.substring(lastIdx))}
        </div>
      );
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#09090b] text-zinc-200 selection:bg-blue-500/20 font-sans">
      
      {/* 1. MINIMAL WORKSPACE HEADER */}
      <div className="h-12 border-b border-[#27272a] bg-[#0e0e11] px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-mono text-[12px] font-semibold tracking-tight uppercase">
              {repoInfo?.name || 'REPOSITORY'}
            </span>
            <span className="text-zinc-600 font-mono text-[12px]">/</span>
            <span className="text-white font-mono text-[12px] font-bold tracking-tight">
              AI ASSISTANT
            </span>
          </div>

          {/* Active Investigation Target Badge */}
          {investigationTarget && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-blue-300 font-mono text-[11px] truncate max-w-[280px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span className="truncate" title={investigationTarget}>
                Target: {investigationTarget.split('/').pop()}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onSelectInvestigationTarget) onSelectInvestigationTarget('');
                }}
                className="hover:text-white font-bold ml-1 text-zinc-400 cursor-pointer shrink-0"
                title="Clear active target"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Header Actions: Clear conversation & Discreet model badge */}
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="text-[11px] font-mono text-zinc-400 hover:text-white bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] px-2.5 py-1 rounded transition-colors cursor-pointer"
              title="Clear conversation"
            >
              Clear
            </button>
          )}

          {/* Discreet secondary model indicator */}
          <span 
            className="text-[10px] font-mono text-zinc-500 border border-[#27272a]/60 px-2 py-0.5 rounded bg-[#121215]"
            title="Active Intelligence Engine"
          >
            qwen3-coder
          </span>
        </div>
      </div>

      {/* 2. DEDICATED CONVERSATION SCROLL AREA (ChatGPT / Claude standard) */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 relative scrollbar-thin"
        data-lenis-prevent
      >
        <div className="max-w-4xl mx-auto">
          {historyLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loading message="Restoring conversation state..." type="skeleton" />
            </div>
          ) : messages.length === 0 && !loading && !indexing ? (
            /* Rule 7: EMPTY STATE - Calm, focused, spacious investigation starters */
            <div className="py-12 sm:py-16 text-center space-y-8 select-none max-w-2xl mx-auto">
              
              {/* Minimal Crest & Title */}
              <div className="space-y-3">
                <div className="w-10 h-10 mx-auto rounded-lg bg-blue-950/40 border border-blue-800/40 flex items-center justify-center text-blue-400 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight uppercase">
                  {repoInfo?.name ? `${repoInfo.name} Investigation` : 'Codebase Intelligence'}
                </h2>

                <p className="text-[12.5px] font-mono text-zinc-400">
                  {repoInfo ? `${repoInfo.fileCount} files scanned` : 'Repository mapped'}
                  {framework ? ` • ${framework} architecture` : ''}
                  {investigationTarget ? ` • Active Focus: ${investigationTarget.split('/').pop()}` : ''}
                </p>
              </div>

              {/* 4 Lightweight Investigation Starters */}
              <div className="space-y-2 text-left pt-2">
                <span className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500 font-semibold px-1 block">
                  Investigation Starters
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {INVESTIGATION_STARTERS.map((starter) => (
                    <button
                      key={starter.title}
                      type="button"
                      onClick={() => sendMessage(starter.prompt)}
                      className="p-3.5 bg-[#121215] hover:bg-[#18181b] border border-[#27272a] hover:border-blue-500/40 rounded-lg text-left transition-all duration-150 group cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-semibold text-zinc-200 group-hover:text-blue-300 transition-colors">
                          {starter.title}
                        </span>
                        <span className="text-zinc-500 group-hover:text-blue-400 font-mono text-xs transition-colors">
                          →
                        </span>
                      </div>
                      <p className="text-[11.5px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {starter.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* CONVERSATION FEED */
            <div className="space-y-6">
              {messages.map((msg) => {
                const isUser = msg.sender === 'USER';
                const groundedFiles = !isUser ? getGroundedEvidenceFiles(msg.message) : [];
                const contextualActions = !isUser ? getContextualActions(msg.message, groundedFiles) : [];
                const cleanContent = isUser ? cleanMessageForDisplay(msg.message) : msg.message;

                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end my-5 select-text px-1">
                      <div className="max-w-[80%] sm:max-w-[68%]">
                        {/* YOU label above the bubble */}
                        <div className="flex items-center justify-end gap-2 mb-1.5 select-none">
                          {msg.createdAt && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                            You
                          </span>
                        </div>
                        {/* User bubble — noticeably distinct from AI content */}
                        <div className="bg-[#1e2433] border border-[#2d3a55] text-[#e8edf8] px-4 py-3 rounded-2xl rounded-br-sm shadow-md">
                          <p className="text-[13.5px] font-sans leading-relaxed whitespace-pre-wrap text-[#dde5f5]">
                            {cleanContent}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }


                return (
                  <div key={msg.id} className="py-6 border-b border-[#27272a]/20 first:pt-2">
                    {/* Archon Speaker Header */}
                    <div className="flex items-center justify-between mb-3 select-none">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-[10px] font-bold shadow-sm">
                          ⚡
                        </div>
                        <span className="text-[11px] font-mono font-bold text-blue-400 tracking-wider uppercase">
                          ARCHON
                        </span>
                        {msg.modelUsed && (
                          <span className="text-[9px] font-mono text-zinc-500 border border-[#27272a] px-1.5 py-0.2 rounded bg-[#121215]">
                            {msg.modelUsed.split('/').pop()}
                          </span>
                        )}
                      </div>

                      {/* Secondary menu trigger for AI response */}
                      {msg.message && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveMenuMessageId(prev => prev === msg.id ? null : msg.id)}
                            className="text-zinc-500 hover:text-zinc-300 text-xs px-1.5 py-0.5 rounded hover:bg-[#18181b] cursor-pointer"
                            title="More options"
                          >
                            •••
                          </button>

                          {/* Overflow dropdown */}
                          {activeMenuMessageId === msg.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setActiveMenuMessageId(null)} 
                              />
                              <div className="absolute right-0 top-full mt-1 w-44 bg-[#121215] border border-[#27272a] rounded-lg shadow-xl py-1 z-40 text-xs font-mono">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCopyText(msg.message);
                                    setActiveMenuMessageId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-[#18181b] flex items-center gap-2 cursor-pointer"
                                >
                                  <span>📋</span> Copy response
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuMessageId(null);
                                    sendMessage('Elaborate on this analysis with more architectural depth.');
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-[#18181b] flex items-center gap-2 cursor-pointer"
                                >
                                  <span>🔍</span> Explain in depth
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuMessageId(null);
                                    sendMessage('Identify any potential edge cases or failure modes in this implementation.');
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-[#18181b] flex items-center gap-2 cursor-pointer"
                                >
                                  <span>⚠️</span> Analyze edge cases
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* AI Message Content */}
                    <div className="select-text">
                      {renderAIContent(msg.message)}
                    </div>

                    {/* Rule 6: GROUNDED EVIDENCE CHIPS (strictly verified against repository files) */}
                    {!isUser && groundedFiles.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-2 select-none">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">
                          Verified Evidence:
                        </span>
                        {groundedFiles.map(file => (
                          <button
                            key={file.path}
                            type="button"
                            onClick={() => {
                              if (onSelectInvestigationTarget) onSelectInvestigationTarget(file.path);
                              if (onNavigateToExplorer) onNavigateToExplorer(file.path);
                              else if (onNavigateToFile) onNavigateToFile(file.path);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#141418] hover:bg-[#1f1f25] border border-[#27272a] hover:border-blue-500/40 text-blue-300 font-mono text-[11px] transition-colors cursor-pointer"
                            title={`Inspect ${file.path} in Explorer`}
                          >
                            <span>📁</span>
                            <span>{file.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Rule 5: CONTEXTUAL ACTIONS (avoid button soup) */}
                    {!isUser && msg.message && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-[#27272a]/20 select-none">
                        {/* Dynamic Contextual Action Buttons */}
                        {contextualActions.map((action, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={action.onClick}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded transition-colors cursor-pointer ${
                              action.primary
                                ? 'bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 font-semibold'
                                : 'bg-[#18181b] hover:bg-[#222226] border border-[#27272a] text-zinc-300 hover:text-white'
                            }`}
                          >
                            <span>{action.icon}</span>
                            <span>{action.label}</span>
                          </button>
                        ))}

                        {/* Subtle Secondary Controls */}
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.message)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded hover:bg-[#18181b] transition-colors cursor-pointer ml-auto"
                          title="Copy text"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span>Copy</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded hover:bg-[#18181b] transition-colors cursor-pointer"
                          title="Regenerate response"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m-3 3l-3-3" />
                          </svg>
                          <span>Regenerate</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* RAG Planner Intent Step Indicator */}
              {currentPlan && loading && (
                <div className="py-4 select-none">
                  <div className="bg-[#121215] border border-[#27272a] rounded-lg p-3 max-w-md space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-mono text-blue-400 font-semibold uppercase">
                      <span>🎯 Intent: {currentPlan.intent}</span>
                      <span className="text-[10px] text-zinc-500">Plan</span>
                    </div>
                    <div className="space-y-1">
                      {currentPlan.steps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                          <span className="text-emerald-400 text-xs">✓</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Streaming Indicator */}
              {loading && (
                <div className="py-4 flex items-center gap-2.5 text-[11.5px] font-mono text-zinc-400 select-none">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span>{loadingStep.toUpperCase()}</span>
                </div>
              )}

              {/* AI Connection Error Alert */}
              {aiError && (
                <div className="py-4 select-none">
                  <ErrorState
                    title="AI Assistant Error"
                    description={aiError}
                    onRetry={() => {
                      const lastUserMsg = [...messages].reverse().find(m => m.sender === 'USER');
                      if (lastUserMsg) {
                        sendMessage(cleanMessageForDisplay(lastUserMsg.message));
                      }
                    }}
                  />
                </div>
              )}

              {/* Scroll anchor at bottom of messages */}
              <div ref={scrollAnchorRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Floating Jump to Latest Button (visible only when scrolled up inside feed) */}
        {!isAtBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              scrollToBottom('smooth');
              setIsAtBottom(true);
            }}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 bg-[#18181b] hover:bg-[#27272a] text-zinc-200 border border-[#27272a] font-mono text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-1.5 transition-all z-20 select-none cursor-pointer"
          >
            <span>↓</span>
            <span>Jump to latest</span>
          </button>
        )}
      </div>

      {/* 3. DOCKED COMPOSER AT BOTTOM (ChatGPT / Claude Standard) */}
      {/* Solid opaque background, border-t, anchored at absolute bottom of workspace */}
      <div className="shrink-0 w-full bg-[#0e0e11] border-t border-[#27272a] px-4 sm:px-6 md:px-8 py-3 z-30">
        <div className="max-w-4xl mx-auto">
          
          {/* Context indicator: ONLY target file or compact file badge, never 60 chips! */}
          {(investigationTarget || selectedFiles.size > 0) && (
            <div className="flex items-center gap-2 mb-2 text-[11px] font-mono select-none">
              {investigationTarget && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-blue-300">
                  <span>🎯 Focus: {investigationTarget.split('/').pop()}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectInvestigationTarget) onSelectInvestigationTarget('');
                    }}
                    className="hover:text-white font-bold ml-1 text-zinc-400 cursor-pointer"
                    title="Clear focus target"
                  >
                    ✕
                  </button>
                </span>
              )}

              {selectedFiles.size > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-400">
                  <span>📁 {selectedFiles.size} files referenced</span>
                  <button
                    type="button"
                    onClick={() => {
                      selectedFiles.forEach(f => onToggleFile(f));
                    }}
                    className="hover:text-red-400 font-bold ml-1 text-zinc-500 cursor-pointer"
                    title="Clear selected files"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Elevated Restrained Composer Input Box */}
          <form
            onSubmit={handleSubmit}
            className="border border-[#27272a] focus-within:border-blue-500/60 bg-[#121215] rounded-lg p-3 shadow-md transition-colors"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                indexing
                  ? 'Indexing repository schemas...'
                  : loading
                  ? 'Synthesizing response...'
                  : 'Ask an architectural question, trace execution lifecycle, or analyze blast radius...'
              }
              disabled={loading || indexing}
              className="w-full bg-transparent border-none text-[#fafafa] placeholder-zinc-500 text-[13.5px] font-sans leading-relaxed outline-none resize-none p-1 min-h-[44px] max-h-[160px]"
            />

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#27272a]/40 px-1 select-none text-[11px] font-mono text-zinc-500">
              <span className="hidden sm:inline">
                ↵ to send • Shift+↵ for new line
              </span>

              <div className="flex items-center gap-2 ml-auto">
                {loading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="bg-red-950/40 border border-red-900/50 hover:bg-red-900/40 text-red-300 px-3 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Stop generation"
                  >
                    <span>■</span>
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() || loading || indexing}
                    className={`px-3.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      input.trim()
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-[#18181b] text-zinc-600 border border-[#27272a]/50 cursor-default'
                    }`}
                  >
                    <span>Ask Archon</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
