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
  /**
   * What the server was able to verify about this answer's citations.
   *
   * The answer text is the model's own; this says how many of the files it
   * named actually exist in the repository. When `fabricated` is non-zero the
   * server also sends a `notice` to append, because a citation that cannot be
   * matched is a claim the reader should not take on trust.
   */
  verification?: {
    verified: number;
    fabricated: number;
    /** The paths that could not be matched, so they can be named in the aside. */
    fabricatedPaths?: string[];
    uncited: boolean;
    notice?: string | null;
    retrievalQuality?: { bestDistance: number | null; chunkCount: number };
  };
}

export interface ChatConsoleProps {
  repositoryId: string;
  selectedFiles: Set<string>;
  onToggleFile: (filePath: string) => void;
  isIndexed?: boolean;
  semanticCompleteness?: number;
  indexingStatus?: string;
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
  semanticCompleteness = 100,
  indexingStatus,
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
  const [semanticPct, setSemanticPct] = useState(semanticCompleteness);
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
  // Streaming token buffer: text accumulates here and is flushed to state once
  // per animation frame. See the note in the stream loop for why.
  const pendingTokens = useRef<string>('');
  const flushScheduled = useRef<boolean>(false);

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

  // Keep the semantic progress in sync with the parent, then poll while the
  // background embedding phase is still running so the banner stays live.
  useEffect(() => {
    setSemanticPct(semanticCompleteness);
  }, [semanticCompleteness]);

  useEffect(() => {
    if (indexingStatus !== 'structural-ready' || semanticPct >= 100) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/repos/${repositoryId}?lite=true`);
        const repo = data.data;
        if (!cancelled && typeof repo?.semanticCompleteness === 'number') {
          setSemanticPct(repo.semanticCompleteness);
        }
      } catch {
        // Non-fatal: keep showing the last known percentage.
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [repositoryId, indexingStatus, semanticPct]);

  const showSemanticBanner = indexingStatus === 'structural-ready' && semanticPct < 100;

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

  // Auto-grow textarea height. The ceiling here must match the CSS max-height on
  // `.chat__in textarea` (220px) or the smaller of the two silently wins.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 52), 220)}px`;
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

    // Declared outside the try so the catch block can flush a partial answer
    // when the user stops generation mid-stream.
    let completeText = '';
    let activeModel = '';

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

      /*
       * This fetch bypasses the shared axios instance, so it does not inherit
       * the 401 interceptor that clears the session and sends the user to the
       * sign-in page. Without handling 401 here, an expired token produced a
       * thrown JSON blob as the "message" and left the user staring at an
       * error while still nominally signed in. Handle it the same way the
       * interceptor does.
       */
      if (response.status === 401) {
        localStorage.removeItem('archon_token');
        localStorage.removeItem('archon_user');
        window.dispatchEvent(new StorageEvent('storage', { key: 'archon_token' }));
        throw new Error('Your session has expired. Please sign in again.');
      }

      if (!response.ok) {
        // The API speaks a JSON envelope; surface its message rather than the
        // raw serialised object.
        const raw = await response.text();
        let message = raw || 'AI engine failed.';
        try {
          const parsed = JSON.parse(raw);
          message = parsed?.error?.message || parsed?.message || message;
        } catch {
          /* not JSON — keep the raw text */
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('Empty stream response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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

              /* The server validates the finished answer and reports what it
                 found. The prose is already on screen and cannot be rewritten,
                 so this attaches the verdict instead: how many citations were
                 real, and the note describing any that were not. The note is
                 rendered as an aside under the answer rather than spliced into
                 the model's text, so the two are never confused. */
              if (parsed.verification) {
                setMessages(prev => {
                  const idx = prev.findIndex(m => m.id === aiMessageId);
                  if (idx === -1) return prev;
                  const nextArr = [...prev];
                  nextArr[idx] = {
                    ...nextArr[idx],
                    verification: {
                      verified: parsed.verification.verified ?? 0,
                      fabricated: parsed.verification.fabricated ?? 0,
                      fabricatedPaths: parsed.verification.fabricatedPaths ?? [],
                      uncited: !!parsed.verification.uncited,
                      notice: parsed.verification.notice ?? null,
                      retrievalQuality: parsed.verification.retrievalQuality ?? undefined,
                    },
                  };
                  return nextArr;
                });
                continue;
              }

              const tokenText = parsed.token || '';
              activeModel = parsed.modelUsed || activeModel;
              completeText += tokenText;

              /*
               * Token buffering.
               *
               * This used to call setMessages for every token. Each call ran
               * findIndex over the whole list, copied the array, spread the
               * message, and re-rendered — hundreds of times per answer, while
               * the markdown in the message was re-parsed each time. That is
               * what made generation feel laggy and stepped rather than smooth.
               *
               * Tokens now accumulate in a ref and are flushed once per animation
               * frame, so a burst of tokens arriving between two paints costs
               * exactly one render. The text is identical; only the number of
               * renders changes.
               */
              pendingTokens.current = completeText;
              if (!flushScheduled.current) {
                flushScheduled.current = true;
                requestAnimationFrame(() => {
                  flushScheduled.current = false;
                  const text = pendingTokens.current;
                  setMessages(prev => {
                    const idx = prev.findIndex(m => m.id === aiMessageId);
                    if (idx === -1) return prev;
                    const nextArr = [...prev];
                    nextArr[idx] = {
                      ...nextArr[idx],
                      message: text,
                      modelUsed: activeModel,
                    };
                    return nextArr;
                  });
                });
              }
            } catch {
              // Partial line in chunk, wait for next buffer flush
            }
          }
        }
      }

      /*
       * The stream has ended. Any tokens that arrived since the last animation
       * frame are still in `completeText` but possibly not yet rendered, and the
       * persist below would write a truncated answer to localStorage.
       *
       * The render update and the persist are done in ONE updater so the text
       * written to storage is the same text that is rendered. Two separate
       * setMessages calls in the same tick both read the pre-update state, so
       * the second would have persisted the truncated message.
       */
      const finalText = completeText;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === aiMessageId);
        const next = idx === -1
          ? prev
          : prev.map((m, i) =>
              i === idx ? { ...m, message: finalText || m.message, modelUsed: activeModel } : m,
            );
        localStorage.setItem(`archon_chat_history_${repositoryId}`, JSON.stringify(next));
        return next;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        /*
         * The user stopped generation. Whatever was received is a real, if
         * partial, answer and should be kept — but the stream aborted before the
         * end-of-stream persist ran, so nothing has been written yet. Flush the
         * buffer and persist here, or the stopped answer would silently vanish
         * on refresh.
         */
        const partial = completeText;
        if (partial) {
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === aiMessageId);
            const next = idx === -1
              ? prev
              : prev.map((m, i) =>
                  i === idx ? { ...m, message: partial, modelUsed: activeModel } : m,
                );
            localStorage.setItem(`archon_chat_history_${repositoryId}`, JSON.stringify(next));
            return next;
          });
        }
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
      if (i % 2 === 1) return <strong key={`b-${keyBase}-${i}`} className="font-semibold text-ink">{segment}</strong>;
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
                className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] border border-rule-strong bg-paper-3 px-1.5 py-0.5 font-mono text-[11.5px] text-ink transition-colors hover:border-emerald hover:text-emerald"
                title={`Inspect ${matchedFile.path}`}
              >
                <span>📁</span>
                <span>{matchedFile.path.split('/').pop()}</span>
              </button>
            );
          }

          return (
            <code key={`c-${keyBase}-${i}-${j}`} className="rounded-[2px] border border-rule bg-paper-3 px-1.5 py-0.5 font-mono text-[11.5px] text-ink">
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
            <ul key={key} className="my-3 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-2">
              {currentList}
            </ul>
          );
        } else if (listType === 'ol') {
          elements.push(
            <ol key={key} className="my-3 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-2">
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
          <div key={key} className="my-4 overflow-x-auto rounded-[3px] border border-rule">
            <table className="min-w-full divide-y divide-rule font-sans text-[13px]">
              <thead className="bg-paper-3">
                <tr>
                  {tableHeaders.map((h, idx) => (
                    <th key={idx} className="border-b border-rule px-3.5 py-2.5 text-left font-mono font-semibold text-ink">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-2 bg-paper-2">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="transition-colors hover:bg-paper-3">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-ink-2">
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
          <h4 key={i} className="mb-2 mt-5 font-mono text-[14px] font-bold tracking-tight text-ink">
            {renderInlineText(trimmed.slice(4), i)}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList(`list-before-h2-${i}`);
        elements.push(
          <h3 key={i} className="mb-2.5 mt-6 border-b border-rule pb-1 font-mono text-[16px] font-bold tracking-tight text-ink">
            {renderInlineText(trimmed.slice(3), i)}
          </h3>
        );
      } else if (trimmed.startsWith('# ')) {
        flushList(`list-before-h1-${i}`);
        elements.push(
          <h2 key={i} className="mb-3 mt-7 border-b border-rule-strong pb-1.5 font-mono text-[18px] font-bold tracking-tight text-ink">
            {renderInlineText(trimmed.slice(2), i)}
          </h2>
        );
      }
      // Blockquotes
      else if (trimmed.startsWith('> ')) {
        flushList(`list-before-bq-${i}`);
        elements.push(
          <blockquote key={i} className="my-3 rounded-r-[3px] border-l-2 border-emerald bg-paper-3 py-2 pl-4 pr-3 font-serif text-[13.5px] italic text-ink-2">
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
          <p key={i} className="my-2.5 font-sans text-[13.5px] leading-relaxed text-ink-2">
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
        <div key={`code-block-${parts.length}`} className="my-4 overflow-hidden rounded-[3px] border border-plate-3 bg-plate font-mono">
          <div className="flex select-none items-center justify-between border-b border-plate-3 bg-plate-2 px-3.5 py-1.5 font-mono text-[10.5px] text-[#82868f]">
            <span className="font-semibold uppercase tracking-wider text-[#a8adb6]">
              {langName}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(codeSnippet);
                toast.success('Code copied to clipboard');
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] text-[#82868f] transition-colors hover:text-[#e6e9ee]"
              title="Copy code snippet"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-[12.5px] leading-relaxed text-[#c8cdd6]">
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

  // Every file the assistant has cited so far, deduplicated. Derived purely from
  // the rendered transcript — the rail never asserts a citation the answer didn't.
  const groundedPreview = (() => {
    const seen = new Set<string>();
    const files: Array<{ path: string; name: string }> = [];
    for (const msg of messages) {
      if (msg.sender !== 'AI' || !msg.message) continue;
      for (const file of getGroundedEvidenceFiles(msg.message)) {
        if (seen.has(file.path)) continue;
        seen.add(file.path);
        files.push(file);
      }
    }
    return files;
  })();

  return (
    <div className="kview !pt-0">
      {/* ══ header ═══════════════════════════════════════════════════════ */}
      <div className="khead">
        <div className="khead__l">
          <div className="eyebrow">Assistant</div>
          <h1 className="khead__t">
            Ask the codebase <em className="serif-it">directly</em>.
          </h1>
          <p className="khead__d">
            Answers are grounded in the parsed trees and the resolved import graph, and stream back
            with the files they cite. Every citation below is verified against the repository before
            it is shown.
          </p>
        </div>
        <div className="khead__r">
          {repoInfo?.name && (
            <span className="st st--idle">
              <i />
              {repoInfo.name}
            </span>
          )}
          {framework && (
            <span className="st st--idle">
              <i />
              {framework}
            </span>
          )}
          {investigationTarget && (
            <span className="st st--live">
              <i />
              {investigationTarget.split('/').pop()}
            </span>
          )}
          {selectedFiles.size > 0 && (
            <span className="st st--idle">
              <i />
              {selectedFiles.size} files
            </span>
          )}
          <span className={loading ? 'st st--live' : indexed ? 'st st--ok' : 'st st--warn'}>
            <i />
            {loading ? 'Streaming' : indexed ? 'Indexed' : 'Not indexed'}
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="abtn abtn--ghost !py-1.5 !text-[10px]"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ══ conversation ═════════════════════════════════════════════════ */}
      <div className="chatw">
        <div className="chat relative">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="chat__log"
            data-lenis-prevent
          >
            {historyLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loading message="Restoring conversation state..." type="skeleton" />
              </div>
            ) : messages.length === 0 && !loading && !indexing ? (
              /* ── empty state — the four investigation starters ────────── */
              <div className="mx-auto max-w-2xl select-none py-10 text-center">
                <div className="eyebrow justify-center">Investigation starters</div>
                <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.025em] text-ink">
                  {repoInfo?.name ? `${repoInfo.name} — pick a thread` : 'Codebase intelligence'}
                </h2>
                <p className="mt-2 font-mono text-[11px] text-ink-3">
                  {repoInfo ? `${repoInfo.fileCount} files scanned` : 'Repository mapped'}
                  {framework ? ` · ${framework} architecture` : ''}
                  {investigationTarget ? ` · focus ${investigationTarget.split('/').pop()}` : ''}
                </p>
                <div className="mt-6 grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
                  {INVESTIGATION_STARTERS.map((starter) => (
                    <button
                      key={starter.title}
                      type="button"
                      onClick={() => sendMessage(starter.prompt)}
                      className="group cursor-pointer rounded-[3px] border border-rule bg-paper-2 p-3.5 text-left transition-colors hover:border-emerald"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="font-mono text-[11.5px] font-semibold text-ink transition-colors group-hover:text-emerald">
                          {starter.title}
                        </span>
                        <span className="shrink-0 font-mono text-[12px] text-rule-strong transition-colors group-hover:text-emerald">
                          →
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11.5px] leading-relaxed text-ink-3">
                        {starter.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── conversation feed ───────────────────────────────────── */
              <div>
                {messages.map((msg) => {
                  const isUser = msg.sender === 'USER';
                  const groundedFiles = !isUser ? getGroundedEvidenceFiles(msg.message) : [];
                  const contextualActions = !isUser ? getContextualActions(msg.message, groundedFiles) : [];
                  const cleanContent = isUser ? cleanMessageForDisplay(msg.message) : msg.message;

                  if (isUser) {
                    return (
                      <div key={msg.id} className="msg msg--me select-text">
                        <div className="msg__who">
                          {msg.createdAt && (
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span>You</span>
                        </div>
                        <div className="msg__txt whitespace-pre-wrap">
                          {cleanContent}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="msg msg--ai">
                      {/* speaker header */}
                      <div className="msg__who">
                        <span>Archon</span>
                        {msg.modelUsed && (
                          <span className="text-ink-3 normal-case tracking-normal">
                            {msg.modelUsed.split('/').pop()}
                          </span>
                        )}

                        {/* Citation status. A trust claim the reader can check,
                            not a decoration — so it only appears once the server
                            has actually reported back. */}
                        {msg.verification && (
                          <span
                            className={
                              'font-mono text-[10.5px] normal-case tracking-normal ' +
                              (msg.verification.fabricated > 0
                                ? 'text-red-500'
                                : 'text-ink-3')
                            }
                            title={
                              msg.verification.fabricated > 0
                                ? `${msg.verification.fabricated} cited path(s) could not be matched to a file in this repository`
                                : 'Every file this answer cited exists in the repository'
                            }
                          >
                            {msg.verification.fabricated > 0
                              ? `${msg.verification.fabricated} unverified citation${msg.verification.fabricated === 1 ? '' : 's'}`
                              : msg.verification.verified > 0
                                ? `${msg.verification.verified} citation${msg.verification.verified === 1 ? '' : 's'} verified`
                                : 'no citations'}
                          </span>
                        )}

                        {/* Retrieval strength. Distances are measured, and a
                            weak match is worth admitting: the same numbers that
                            make a good answer look confident make a poorly
                            grounded one look identical. Only shown past a
                            threshold where the match is genuinely loose. */}
                        {msg.verification?.retrievalQuality?.bestDistance != null &&
                          msg.verification.retrievalQuality.bestDistance > 0.9 && (
                            <span
                              className="font-mono text-[10.5px] normal-case tracking-normal text-ink-3"
                              title={`The closest code it found was a weak match (distance ${msg.verification.retrievalQuality.bestDistance.toFixed(2)}), so this answer rests on loosely-related files.`}
                            >
                              weak match
                            </span>
                          )}

                        {msg.message && (
                          <div className="relative ml-auto">
                            <button
                              type="button"
                              onClick={() => setActiveMenuMessageId(prev => prev === msg.id ? null : msg.id)}
                              className="cursor-pointer rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
                              title="More options"
                            >
                              •••
                            </button>

                            {activeMenuMessageId === msg.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={() => setActiveMenuMessageId(null)}
                                />
                                <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-[3px] border border-rule bg-paper-2 py-1 text-left shadow-dossier">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleCopyText(msg.message);
                                      setActiveMenuMessageId(null);
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                                  >
                                    <span>📋</span> Copy response
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuMessageId(null);
                                      sendMessage('Elaborate on this analysis with more architectural depth.');
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                                  >
                                    <span>🔍</span> Explain in depth
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuMessageId(null);
                                      sendMessage('Identify any potential edge cases or failure modes in this implementation.');
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                                  >
                                    <span>⚠️</span> Analyze edge cases
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* answer body */}
                      <div className="msg__txt select-text">
                        {renderAIContent(msg.message)}
                      </div>

                      {/* Unverified citations, stated plainly.
                          The model's prose is untouched — this is an aside, and
                          it says only what was actually checked: that some
                          named files could not be matched. */}
                      {msg.verification?.notice && (
                        <div className="mt-2 rounded-[3px] border border-rule border-l-2 border-l-red-500 bg-paper-2 px-3 py-2">
                          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-red-500">
                            Unverified citation
                            {msg.verification.fabricated === 1 ? '' : 's'}
                          </div>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                            {msg.verification.fabricated === 1
                              ? 'One path this answer named does not match any file in this repository'
                              : `${msg.verification.fabricated} paths this answer named do not match any file in this repository`}
                            {msg.verification.fabricatedPaths &&
                              msg.verification.fabricatedPaths.length > 0 && (
                                <>
                                  {' '}
                                  (
                                  {msg.verification.fabricatedPaths
                                    .map(p => `\`${p}\``)
                                    .join(', ')}
                                  )
                                </>
                              )}
                            . Treat those references as unreliable; the rest of
                            the answer is unaffected.
                          </p>
                        </div>
                      )}

                      {/* verified evidence citations */}
                      {groundedFiles.length > 0 && (
                        <div className="msg__cites">
                          {groundedFiles.map(file => (
                            <button
                              key={file.path}
                              type="button"
                              onClick={() => {
                                if (onSelectInvestigationTarget) onSelectInvestigationTarget(file.path);
                                if (onNavigateToExplorer) onNavigateToExplorer(file.path);
                                else if (onNavigateToFile) onNavigateToFile(file.path);
                              }}
                              className="msg__cite w-full cursor-pointer text-left transition-colors hover:bg-paper-3"
                              title={`Inspect ${file.path} in Explorer`}
                            >
                              <span>{file.path}</span>
                              <span className="ln">↗</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* contextual actions */}
                      {msg.message && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 select-none">
                          {contextualActions.map((action, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={action.onClick}
                              className={`abtn !py-1 !text-[10px] ${action.primary ? 'abtn--solid' : 'abtn--ghost'}`}
                            >
                              <span>{action.icon}</span>
                              <span>{action.label}</span>
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.message)}
                            className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-[2px] px-2 py-1 font-mono text-[10px] text-ink-3 transition-colors hover:text-ink"
                            title="Copy text"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>Copy</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleRegenerate}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] px-2 py-1 font-mono text-[10px] text-ink-3 transition-colors hover:text-ink"
                            title="Regenerate response"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m-3 3l-3-3" />
                            </svg>
                            <span>Regenerate</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* planner intent steps */}
                {currentPlan && loading && (
                  <div className="msg__steps select-none">
                    <div className="st-t">
                      Intent — {currentPlan.intent}
                    </div>
                    {currentPlan.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-emerald">✓</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* streaming indicator */}
                {loading && (
                  <div className="flex items-center gap-2.5 py-4 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-3 select-none">
                    <span className="st st--live">
                      <i />
                    </span>
                    <span>{loadingStep}</span>
                  </div>
                )}

                {/* connection error */}
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

                <div ref={scrollAnchorRef} className="h-4" />
              </div>
            )}
          </div>

          {/* composer */}
          <form onSubmit={handleSubmit} className="chat__in">
            <div className="flex-1">
              {(investigationTarget || selectedFiles.size > 0) && (
                <div className="mb-2 flex flex-wrap items-center gap-2 select-none">
                  {investigationTarget && (
                    <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-rule bg-paper-2 px-2 py-0.5 font-mono text-[10px] text-ink-2">
                      <span>🎯 {investigationTarget.split('/').pop()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectInvestigationTarget) onSelectInvestigationTarget('');
                        }}
                        className="ml-1 cursor-pointer font-bold text-ink-3 transition-colors hover:text-sig"
                        title="Clear focus target"
                      >
                        ✕
                      </button>
                    </span>
                  )}

                  {selectedFiles.size > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-rule bg-paper-2 px-2 py-0.5 font-mono text-[10px] text-ink-2">
                      <span>📁 {selectedFiles.size} files referenced</span>
                      <button
                        type="button"
                        onClick={() => {
                          selectedFiles.forEach(f => onToggleFile(f));
                        }}
                        className="ml-1 cursor-pointer font-bold text-ink-3 transition-colors hover:text-sig"
                        title="Clear selected files"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              )}

              {showSemanticBanner && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-[3px] border border-rule bg-paper-3 px-3 py-2 font-mono text-[10.5px] text-ink-2">
                  <span className="st st--live">
                    <i />
                    Semantic index {semanticPct}% — answers use the structural graph until embeddings finish.
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-3">{semanticPct}%</span>
                </div>
              )}

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
              />
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              {loading ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="abtn abtn--ghost !py-1.5 !text-[10px] !text-sig"
                  title="Stop generation"
                >
                  <span>■</span>
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || loading || indexing}
                  className="abtn abtn--solid !py-1.5 !text-[10px]"
                >
                  <span>Ask Archon</span>
                  <span>→</span>
                </button>
              )}
              <span className="hidden font-mono text-[9px] text-ink-3 sm:inline">↵ send · ⇧↵ newline</span>
            </div>
          </form>

          {/* floating jump-to-latest sits inside the log's own rail */}
          {!isAtBottom && messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                scrollToBottom('smooth');
                setIsAtBottom(true);
              }}
              className="pointer-events-auto absolute bottom-[68px] left-1/2 z-20 -translate-x-1/2 rounded-[3px] border border-rule-strong bg-paper-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-ink-2 shadow-dossier transition-colors hover:border-ink hover:text-ink select-none"
            >
              ↓ Jump to latest
            </button>
          )}
        </div>

        {/* ══ side rail ══════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="chat__extra">
            <div className="chat__eh">Session</div>
            <div className="chat__eb">
              <div className="ikv">
                <span className="k">Repository</span>
                <span className="v">{repoInfo?.name || '—'}</span>
              </div>
              <div className="ikv">
                <span className="k">Files</span>
                <span className="v">{repoInfo ? repoInfo.fileCount : '—'}</span>
              </div>
              <div className="ikv">
                <span className="k">Framework</span>
                <span className="v">{repoInfo?.framework || framework || '—'}</span>
              </div>
              <div className="ikv">
                <span className="k">Languages</span>
                <span className="v">{repoInfo?.languages?.join(' · ') || '—'}</span>
              </div>
              <div className="ikv">
                <span className="k">Turns</span>
                <span className="v">{messages.length}</span>
              </div>
              <div className="ikv">
                <span className="k">Index</span>
                <span className={indexed ? 'v v--em' : 'v v--risk'}>{indexed ? 'ready' : 'pending'}</span>
              </div>
              <div className="ikv">
                <span className="k">Semantic</span>
                <span className={semanticPct >= 100 ? 'v v--em' : 'v'}>{semanticPct}%</span>
              </div>
            </div>
          </div>

          <div className="chat__extra">
            <div className="chat__eh">Suggested questions</div>
            <div className="chat__eb !py-1.5">
              {INVESTIGATION_STARTERS.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => sendMessage(starter.prompt)}
                  className="qchip"
                  title={starter.prompt}
                >
                  {starter.title}
                </button>
              ))}
            </div>
          </div>

          {groundedPreview.length > 0 && (
            <div className="chat__extra">
              <div className="chat__eh">Cited files</div>
              <div className="chat__eb !p-0">
                {groundedPreview.map(file => (
                  <div key={file.path} className="mini__row">
                    <span className="ic">{file.name.slice(0, 1).toUpperCase()}</span>
                    <span className="p" title={file.path}>{file.path}</span>
                    <span className="n">{file.name.split('.').pop()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
