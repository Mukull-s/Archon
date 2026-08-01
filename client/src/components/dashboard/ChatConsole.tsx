import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { toast } from 'sonner';
import { Loading, Empty, ErrorState, Typography } from '../ui/DesignSystem';

interface Message {
  id: string;
  sender: 'USER' | 'AI';
  message: string;
  modelUsed?: string | null;
  createdAt: string;
}

interface ChatConsoleProps {
  repositoryId: string;
  selectedFiles: Set<string>;
  onToggleFile: (filePath: string) => void;
  isIndexed?: boolean;
  onNavigateToFile: (filePath: string) => void;
  autoTriggerChatPrompt?: string | null;
  onClearAutoPrompt?: () => void;
}

const SUGGESTED_PROMPTS = [
  'Explain this repository',
  'Explain authentication',
  'Explain architecture',
  'Find performance bottlenecks',
  'Find security issues',
  'Explain request lifecycle',
  'Explain database schema',
  'Find dead code',
];

// Custom SVGs for Avatars & Icons
const PersonIcon = () => (
  <svg className="w-3.5 h-3.5 text-[#e4e1e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const BoltIcon = () => (
  <svg className="w-3.5 h-3.5 text-[#60a5fa]" fill="currentColor" viewBox="0 0 24 24">
    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A4.5 4.5 0 0112 5.072 4.5 4.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m-3 3l-3-3" />
  </svg>
);

export default function ChatConsole({
  repositoryId,
  selectedFiles,
  onToggleFile,
  isIndexed,
  onNavigateToFile,
  autoTriggerChatPrompt = null,
  onClearAutoPrompt
}: ChatConsoleProps) {
  // lazy initializer loads history synchronously preventing blank screens during tab switches
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
  const [loadingStep, setLoadingStep] = useState('Retrieving repository context...');
  
  // Custom states for redesign
  const [devMode, setDevMode] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [repoInfo, setRepoInfo] = useState<{
    name: string;
    fileCount: number;
    languages: string[];
    framework: string | null;
  } | null>(null);

  // Live Query Planner State
  const [currentPlan, setCurrentPlan] = useState<{ intent: string; steps: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch Repository metadata for empty state & context overview
  useEffect(() => {
    const fetchRepoInfo = async () => {
      try {
        const { data } = await api.get(`/repos/${repositoryId}?lite=true`);
        if (data.data) {
          const repository = data.data;
          setRepoInfo({
            name: repository.name,
            fileCount: repository.fileCount || 0,
            languages: typeof repository.languages === 'string'
              ? JSON.parse(repository.languages)
              : (repository.languages || []),
            framework: repository.framework
          });
        }
      } catch (err) {
        console.error('Failed to fetch repository metadata:', err);
      }
    };
    fetchRepoInfo();
  }, [repositoryId]);

  // Sync index state
  useEffect(() => {
    if (isIndexed !== undefined) {
      setIndexed(isIndexed);
    }
  }, [isIndexed]);

  // Load chat history from backend if not already cached
  useEffect(() => {
    if (messages.length > 0) return; // already loaded by lazy initializer
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data } = await api.get(`/repos/${repositoryId}/chat/history`);
        if (data.data && data.data.length > 0) {
          setMessages(data.data);
          setIndexed(true);
          localStorage.setItem(`archon_chat_history_${repositoryId}`, JSON.stringify(data.data));
        }
      } catch (err) {
        console.warn('History API request failed.');
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [repositoryId]);

  // Auto-scroll logic matching ChatGPT (only scroll if user is near bottom)
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const offset = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsAtBottom(offset <= 100);
  };

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom('auto');
    }
  }, [messages, loading, loadingStep]);

  // Auto-trigger chat prompt from external tabs
  useEffect(() => {
    if (autoTriggerChatPrompt) {
      sendMessage(autoTriggerChatPrompt);
      if (onClearAutoPrompt) onClearAutoPrompt();
    }
  }, [autoTriggerChatPrompt]);

  // Auto-grow textarea height on content change
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  // Ensure vector search index is ready
  const ensureIndexed = async () => {
    if (indexed) return;
    setIndexing(true);
    setLoadingStep('Retrieving repository context...');
    try {
      await api.post(`/repos/${repositoryId}/index`, {}, { timeout: 300000 });
      setIndexed(true);
    } catch (err: any) {
      toast.error('Failed to build vector index for codebase search.');
      throw err;
    } finally {
      setIndexing(false);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter key submits prompt; Shift+Enter creates a new line
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

  const sendMessage = async (prompt: string) => {
    setInput('');
    setLoading(true);
    setCurrentPlan(null);
    setAiError(null);
    setLoadingStep('Searching dependency graph...');
    setIsAtBottom(true); // force auto-scroll on new questions

    const token = localStorage.getItem('archon_token');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'USER',
      message: prompt,
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
      setLoadingStep('Generating response...');

      const response = await fetch(`${baseUrl}/repos/${repositoryId}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          message: prompt,
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
                const updated = [...prev];
                updated[idx] = {
                  ...updated[idx],
                  message: completeText,
                  modelUsed: activeModel
                };
                return updated;
              });
            } catch (e) {
              // Partial line
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
        setAiError(err.message || 'Cognitive search failed.');
        toast.error(err.message || 'Cognitive search failed.');
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
    const userPrompts = messages.filter(m => m.sender === 'USER');
    if (userPrompts.length === 0) return;
    let lastPromptIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'USER') {
        lastPromptIdx = i;
        break;
      }
    }
    const lastPrompt = messages[lastPromptIdx].message;
    setMessages(prev => prev.slice(0, lastPromptIdx));
    await sendMessage(lastPrompt);
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear this conversation history?')) {
      setMessages([]);
      localStorage.removeItem(`archon_chat_history_${repositoryId}`);
      toast.success('Conversation history cleared.');
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied text to clipboard.');
  };

  const handleActionPrompt = (promptText: string) => {
    sendMessage(promptText);
  };

  // Helper to extract file references inline
  const extractFileReferences = (text: string) => {
    const matches = text.match(/\[([a-zA-Z0-9_\-\.\/]+)\]/g);
    if (!matches) return [];
    const refs = matches.map(m => m.slice(1, -1));
    return Array.from(new Set(refs)).filter(r => {
      return r.includes('.') || r.includes('/') || r.endsWith('ts') || r.endsWith('js') || r.includes('Service') || r.includes('Controller') || r.includes('routes');
    });
  };

  // Global referenced files list for DevMode
  const globalReferencedFiles = useMemo(() => {
    if (messages.length === 0) return [];
    const allRefs = new Set<string>();
    messages.forEach(msg => {
      const matches = msg.message.match(/\[([a-zA-Z0-9_\-\.\/]+)\]/g);
      if (matches) {
        matches.forEach(m => allRefs.add(m.slice(1, -1)));
      }
    });
    return Array.from(allRefs);
  }, [messages]);

  const renderInlineText = (text: string, keyBase: number) => {
    const boldified = text.split(/\*\*(.*?)\*\*/g).map((segment, i) => {
      if (i % 2 === 1) return <strong key={`b-${keyBase}-${i}`} className="text-white font-semibold">{segment}</strong>;
      return segment.split(/`([^`]+)`/g).map((part, j) => {
        if (j % 2 === 1) {
          return <code key={`c-${keyBase}-${i}-${j}`} className="bg-[#1f1f22] border border-[#27272a] px-1 py-0.5 rounded text-[#e4e1e5] font-mono text-[12px]">{part}</code>;
        }
        return part.split(/\[([a-zA-Z0-9_\-\.\/]+)\]/g).map((fp, k) => {
          if (k % 2 === 1) {
            return (
              <button
                key={`f-${keyBase}-${i}-${j}-${k}`}
                onClick={() => onNavigateToFile(fp)}
                className="bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#60a5fa] font-mono text-[12px] px-1.5 py-0.5 rounded cursor-pointer inline transition-all"
                title="Click to view file details"
              >
                {fp.split('/').pop()}
              </button>
            );
          }
          return fp;
        });
      });
    });
    return <span key={`t-${keyBase}`}>{boldified}</span>;
  };

  // Improved markdown presentation parser
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
            <ul key={key} className="list-disc pl-6 my-3 space-y-1.5 text-[#c8c5ca] leading-relaxed">
              {currentList}
            </ul>
          );
        } else if (listType === 'ol') {
          elements.push(
            <ol key={key} className="list-decimal pl-6 my-3 space-y-1.5 text-[#c8c5ca] leading-relaxed">
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
          <div key={key} className="my-4 overflow-x-auto border border-[#27272a] rounded-[6px]">
            <table className="min-w-full divide-y divide-[#27272a] text-[13px]">
              <thead className="bg-[#0e0e11]">
                <tr>
                  {tableHeaders.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left font-mono font-bold text-white border-b border-[#27272a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] bg-[#131316]/10">
                {tableRows.map((row, i) => (
                  <tr key={i} className="hover:bg-[#1f1f22]/30">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-2.5 text-[#c8c5ca]">{cell}</td>
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

      // Handle Tables
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
        elements.push(<h4 key={i} className="text-[14px] font-mono font-bold text-white mt-5 mb-2 tracking-tight">{renderInlineText(trimmed.slice(4), i)}</h4>);
      } else if (trimmed.startsWith('## ')) {
        flushList(`list-before-h2-${i}`);
        elements.push(<h3 key={i} className="text-[16px] font-mono font-bold text-white mt-6 mb-3 border-b border-[#27272a]/30 pb-1 tracking-tight">{renderInlineText(trimmed.slice(3), i)}</h3>);
      } else if (trimmed.startsWith('# ')) {
        flushList(`list-before-h1-${i}`);
        elements.push(<h2 key={i} className="text-[20px] font-mono font-bold text-white mt-8 mb-4 border-b border-[#27272a]/40 pb-2 tracking-tight">{renderInlineText(trimmed.slice(2), i)}</h2>);
      }
      // Blockquotes
      else if (trimmed.startsWith('> ')) {
        flushList(`list-before-bq-${i}`);
        elements.push(
          <blockquote key={i} className="border-l-2 border-[#3b82f6] bg-[#3b82f6]/5 pl-4 py-2 pr-2 my-3 rounded-r text-[#93c5fd] italic text-[13px]">
            {renderInlineText(trimmed.slice(2), i)}
          </blockquote>
        );
      }
      // Unordered Lists
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList(`list-type-change-ul-${i}`);
          listType = 'ul';
        }
        currentList.push(<li key={`li-${i}`}>{renderInlineText(trimmed.slice(2), i)}</li>);
      }
      // Ordered Lists
      else if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== 'ol') {
          flushList(`list-type-change-ol-${i}`);
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
        elements.push(<p key={i} className="my-2.5 leading-relaxed text-[#c8c5ca] font-sans">{renderInlineText(line, i)}</p>);
      }
    }

    flushList('list-final');
    flushTable('table-final');

    return elements;
  };

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
        <div key={`code-container-${parts.length}`} className="my-4 border border-[#27272a] rounded-[6px] bg-[#09090b]/80 overflow-hidden font-mono shadow-md">
          <div className="flex justify-between items-center bg-[#0e0e11] px-4 py-2 border-b border-[#27272a] text-[11px] text-[#919095] select-none">
            <span className="font-bold tracking-wider">{langName.toUpperCase()}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(codeSnippet);
                toast.success('Copied code snippet');
              }}
              className="text-[#3b82f6] hover:text-[#fafafa] flex items-center gap-1.5 cursor-pointer font-bold transition-colors"
            >
              <CopyIcon /> Copy
            </button>
          </div>
          <pre className="p-4 text-[12.5px] text-[#e4e1e5] overflow-x-auto leading-relaxed whitespace-pre font-mono">
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

  // Check if response pertains to repo architecture/details for adding context actions
  const isRepoExplanation = (text: string) => {
    const lowercase = text.toLowerCase();
    return lowercase.includes('architecture') || 
           lowercase.includes('repository') || 
           lowercase.includes('codebase') || 
           lowercase.includes('directory') || 
           lowercase.includes('structure') ||
           lowercase.includes('component');
  };

  return (
    <div className="flex w-full h-[calc(100vh-120px)] lg:h-[calc(100vh-160px)] relative overflow-hidden bg-[#09090b] rounded-[8px] border border-[#27272a]">
      
      {/* LEFT COLUMN: CONVERSATION PANEL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Minimal Premium Header */}
        <div className="h-14 border-b border-[#27272a] bg-[#0e0e11] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#fafafa] font-mono text-[12px] font-bold tracking-tight">
              {repoInfo?.name ? `${repoInfo.name.toUpperCase()} / ` : ''}AI ASSISTANT
            </span>
          </div>

          <div className="flex items-center gap-2 select-none">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-[11px] font-mono text-[#919095] hover:text-[#fafafa] bg-[#1f1f22]/50 hover:bg-[#1f1f22] border border-[#27272a] px-2.5 py-1.5 rounded transition-all cursor-pointer"
                title="Clear conversation"
              >
                Clear History
              </button>
            )}
            
            <button
              onClick={() => setDevMode(!devMode)}
              className={`text-[11px] font-mono px-2.5 py-1.5 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                devMode
                  ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#60a5fa]'
                  : 'bg-[#1f1f22]/50 border-[#27272a] text-[#919095] hover:text-[#fafafa]'
              }`}
              title="Toggle Developer mode drawer"
            >
              ⚡ Inspector Mode
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex-1 overflow-y-auto scrollbar-thin relative pb-28 pt-4 px-6"
          data-lenis-prevent
        >
          {historyLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loading message="Restoring conversation state..." type="skeleton" />
            </div>
          ) : messages.length === 0 && !loading && !indexing ? (
            /* Premium Repository Context & Starter Prompts empty state */
            <div className="h-full flex items-center justify-center select-text">
              <div className="max-w-xl mx-auto text-center space-y-6 py-12">
                <div className="inline-flex items-center gap-2 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 px-3 py-1 rounded-full font-mono text-[12px] select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Repository Context Warmed
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-[22px] font-bold text-white font-mono tracking-tight uppercase">
                    {repoInfo?.name || 'Codebase Intelligence'}
                  </h2>
                  {repoInfo && (
                    <p className="text-[12.5px] font-mono text-[#919095] leading-relaxed">
                      {repoInfo.fileCount} files &bull; {repoInfo.languages.join(' • ') || 'Source files'}
                      {repoInfo.framework && ` &bull; ${repoInfo.framework}`}
                    </p>
                  )}
                  <p className="text-[13.5px] text-[#919095] max-w-sm mx-auto">
                    Ask architectural questions, trace data lifecycles, and explore components in depth.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-4">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-left bg-[#131316] hover:bg-[#1f1f22] border border-[#27272a] hover:border-[#3b82f6]/40 p-3.5 rounded-[6px] text-[12.5px] text-[#c8c5ca] hover:text-white font-mono cursor-pointer transition-all duration-150 shadow-sm"
                    >
                      <span className="text-[#3b82f6] mr-1.5">&bull;</span>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Premium clean conversation feed (Claude style) */
            <div className="max-w-3xl mx-auto space-y-0 divide-y divide-[#27272a]/20 select-text">
              {messages.map((msg) => {
                const isUser = msg.sender === 'USER';
                const fileRefs = !isUser ? extractFileReferences(msg.message) : [];

                return (
                  <div key={msg.id} className="py-8 first:pt-2 last:border-b-0 flex gap-5">
                    {/* Minimal Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border select-none ${
                      isUser 
                        ? 'bg-[#27272a] border-[#39393c] text-[#e4e1e5]' 
                        : 'bg-[#3b82f6]/10 border-[#3b82f6]/20 text-[#60a5fa]'
                    }`}>
                      {isUser ? <PersonIcon /> : <BoltIcon />}
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Name Header */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#919095] select-none">
                        <span>{isUser ? 'YOU' : 'ARCHON AI'}</span>
                        {msg.modelUsed && !isUser && (
                          <span className="text-[9px] border border-[#27272a] px-1.5 py-0.5 rounded text-[#52525b]">
                            {msg.modelUsed}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="text-[13.5px] leading-relaxed text-[#c8c5ca]">
                        {isUser ? (
                          <p className="whitespace-pre-wrap font-mono text-[13px] text-[#fafafa] bg-[#131316]/50 border border-[#27272a]/40 p-3 rounded-[6px]">{msg.message}</p>
                        ) : (
                          <div>{renderAIContent(msg.message)}</div>
                        )}
                      </div>

                      {/* Inline file references */}
                      {!isUser && fileRefs.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5 items-center select-none">
                          <span className="text-[10px] font-mono text-[#919095] mr-1">EVIDENCE CHIPS:</span>
                          {fileRefs.map(filePath => (
                            <button
                              key={filePath}
                              onClick={() => onNavigateToFile(filePath)}
                              className="inline-flex items-center gap-1 bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/15 hover:border-[#3b82f6]/30 text-[#60a5fa] font-mono text-[11.5px] px-2 py-0.5 rounded cursor-pointer transition-all"
                            >
                              📁 {filePath.split('/').pop()}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Premium Actions & Followup prompts */}
                      {!isUser && msg.message && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-2 border-t border-[#27272a]/10 select-none">
                          <button
                            onClick={() => handleCopyText(msg.message)}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#919095] hover:text-[#fafafa] bg-[#1f1f22]/50 hover:bg-[#1f1f22] border border-[#27272a] px-2.5 py-1 rounded transition-colors cursor-pointer"
                            title="Copy response text"
                          >
                            <CopyIcon /> Copy
                          </button>

                          <button
                            onClick={handleRegenerate}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#919095] hover:text-[#fafafa] bg-[#1f1f22]/50 hover:bg-[#1f1f22] border border-[#27272a] px-2.5 py-1 rounded transition-colors cursor-pointer"
                            title="Regenerate last response"
                          >
                            <RefreshIcon /> Regenerate
                          </button>

                          <button
                            onClick={() => handleActionPrompt('Continue explaining.')}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#919095] hover:text-[#fafafa] bg-[#1f1f22]/50 hover:bg-[#1f1f22] border border-[#27272a] px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            ➜ Continue
                          </button>

                          <button
                            onClick={() => handleActionPrompt('Explain this in more depth.')}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#919095] hover:text-[#fafafa] bg-[#1f1f22]/50 hover:bg-[#1f1f22] border border-[#27272a] px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            🔍 Explain Deeper
                          </button>

                          {isRepoExplanation(msg.message) && (
                            <>
                              <button
                                onClick={() => handleActionPrompt('Show related files for this context.')}
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#3b82f6] hover:text-[#60a5fa] bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/15 px-2.5 py-1 rounded transition-colors cursor-pointer"
                              >
                                📁 Show Related Files
                              </button>
                              <button
                                onClick={() => handleActionPrompt('Show the execution flow trace for this.')}
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#3b82f6] hover:text-[#60a5fa] bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/15 px-2.5 py-1 rounded transition-colors cursor-pointer"
                              >
                                ⚡ Show Execution Flow
                              </button>
                              <button
                                onClick={() => handleActionPrompt('Find potential architectural issues or bugs in this.')}
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#3b82f6] hover:text-[#60a5fa] bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/15 px-2.5 py-1 rounded transition-colors cursor-pointer"
                              >
                                ⚠️ Find Possible Issues
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* RAG Planner Intent Step */}
              {currentPlan && loading && (
                <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/15 rounded-[6px] p-4 max-w-sm ml-12 space-y-2 select-none">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono font-bold text-[#60a5fa] uppercase">🎯 INTENT: {currentPlan.intent}</span>
                    <span className="text-[9px] font-mono text-[#919095]">RAG Planner</span>
                  </div>
                  <div className="space-y-1">
                    {currentPlan.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[10.5px] text-[#919095] font-mono">
                        <span className="text-emerald-400">✓</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming loading state */}
              {loading && (
                <div className="flex gap-3 items-center ml-12 py-6 select-none">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-[11.5px] font-mono text-[#919095] tracking-wide">{loadingStep.toUpperCase()}</span>
                </div>
              )}

              {aiError && (
                <div className="p-2 ml-12 select-none">
                  <ErrorState
                    title="AI Assistant Connection Failed"
                    description={aiError}
                    onRetry={() => {
                      const lastUserMsg = [...messages].reverse().find(m => m.sender === 'USER');
                      if (lastUserMsg) {
                        sendMessage(lastUserMsg.message);
                      }
                    }}
                  />
                </div>
              )}

              <div />
            </div>
          )}
        </div>

        {/* Floating Scroll to Latest Button */}
        {!isAtBottom && (
          <button
            type="button"
            onClick={() => {
              scrollToBottom('smooth');
              setIsAtBottom(true);
            }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-[#3b82f6] hover:bg-[#3b82f6]/95 text-white font-mono text-[11px] font-bold px-4 py-2 rounded-full shadow-xl flex items-center gap-1.5 transition-all z-10 select-none cursor-pointer"
          >
            ⬇ JUMP TO LATEST
          </button>
        )}

        {/* Input Composer controls Area */}
        <div className="p-4 border-t border-[#27272a] bg-[#0e0e11] shrink-0">
          
          {/* Removable selected context chips */}
          {selectedFiles.size > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2.5 mb-1.5 scrollbar-none max-w-4xl mx-auto whitespace-nowrap select-none">
              {Array.from(selectedFiles).map(filePath => (
                <div
                  key={filePath}
                  className="inline-flex items-center gap-1.5 bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/15 text-[#60a5fa] text-[10.5px] font-mono px-2 py-0.5 rounded-[4px]"
                >
                  <span className="truncate max-w-[140px]">{filePath.split('/').pop()}</span>
                  <button
                    onClick={() => onToggleFile(filePath)}
                    className="hover:text-red-400 font-bold shrink-0 cursor-pointer"
                    title="Remove from context"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Composer Form */}
          <form onSubmit={handleSubmit} className="relative border border-[#27272a] focus-within:border-[#3b82f6] bg-[#09090b] rounded-[6px] p-3 max-w-4xl mx-auto shadow-md">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={indexing ? 'Indexing repository schemas...' : loading ? 'Generating engineering intelligence response...' : 'Ask a question, analyze systems, or request architectural overview... (Enter to send, Shift+Enter for new line)'}
              disabled={loading || indexing}
              className="w-full bg-transparent border-none text-[#fafafa] placeholder-[#919095] text-[13.5px] font-sans leading-relaxed outline-none resize-none focus:ring-0 p-1 min-h-[24px] max-h-[200px]"
            />

            <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#27272a]/30 px-1 select-none">
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#919095] bg-[#1f1f22]/50 border border-[#27272a]/60 px-2 py-0.5 rounded">
                  📁 {selectedFiles.size} FILES ATTACHED
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-[#919095] hidden md:inline">
                  Enter to send
                </span>
                
                {loading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="bg-red-950/20 border border-red-900/40 text-red-400 px-3.5 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-red-950/30 transition-all"
                    title="Stop generation"
                  >
                    STOP GENERATION
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() || loading || indexing}
                    className={`px-4 py-1.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      input.trim()
                        ? 'bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90'
                        : 'bg-[#1f1f22] text-[#919095] border border-[#27272a]/50 opacity-50 cursor-default'
                    }`}
                  >
                    ANALYZE →
                  </button>
                )}
              </div>
            </div>
          </form>

        </div>

      </div>

      {/* COLLAPSIBLE SIDE DRAWER: DEVELOPER INSPECTOR */}
      {devMode && (
        <div className="w-80 border-l border-[#27272a] bg-[#0e0e11] flex flex-col h-full overflow-hidden shrink-0">
          
          {/* Inspector Header */}
          <div className="h-14 border-b border-[#27272a] bg-[#0e0e11] px-4 flex items-center justify-between shrink-0 select-none">
            <span className="text-[#fafafa] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              ⚡ Developer Inspector
            </span>
            <button
              onClick={() => setDevMode(false)}
              className="text-[#919095] hover:text-white cursor-pointer font-mono font-bold text-[12px]"
            >
              ✕
            </button>
          </div>

          {/* Inspector Scroll Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin" data-lenis-prevent>
            
            {/* referenced files list */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-mono font-bold text-[#919095] uppercase tracking-wider flex items-center gap-1.5">
                📁 Referenced Files
              </h3>
              
              {globalReferencedFiles.length > 0 ? (
                <div className="space-y-2">
                  {globalReferencedFiles.map(filePath => (
                    <div
                      key={filePath}
                      onClick={() => onNavigateToFile(filePath)}
                      className="p-3 border border-[#27272a] bg-[#131316]/50 rounded-[6px] hover:border-[#3b82f6] transition-colors cursor-pointer group flex flex-col gap-0.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[12.5px] font-mono font-semibold text-[#fafafa] group-hover:text-[#3b82f6] truncate">
                          {filePath.split('/').pop()}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#919095] truncate">{filePath}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border border-[#27272a]/70 rounded-[6px] bg-[#131316]/20 text-center text-[#919095] text-[11px] font-mono">
                  No referenced files in current dialog
                </div>
              )}
            </div>

            {/* Active execution trace list */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-mono font-bold text-[#919095] uppercase tracking-wider flex items-center gap-1.5">
                ⚡ Execution Trace
              </h3>
              
              <div className="relative border-l border-[#27272a] ml-2 pl-4 space-y-4">
                <div className="relative">
                  <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 bg-[#3b82f6] rounded-full border-2 border-[#0e0e11]" />
                  <div className="bg-[#131316]/40 p-2.5 border border-[#27272a]/60 rounded-[6px] font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[#919095] mb-1">
                      <span>14:02:11.455</span>
                      <span className="bg-[#131316] border border-[#27272a] px-1 rounded text-[9px]">INGRESS</span>
                    </div>
                    <div className="text-[#fafafa] break-all">Incoming checkout trace ID: <span className="text-[#3b82f6]">tx_8f2a9c1</span></div>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 bg-[#eab308] rounded-full border-2 border-[#0e0e11]" />
                  <div className="bg-[#131316]/40 p-2.5 border border-[#27272a]/60 rounded-[6px] font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[#919095] mb-1">
                      <span>14:02:11.482</span>
                      <span className="bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20 px-1 rounded text-[9px]">MIDDLEWARE</span>
                    </div>
                    <div className="text-[#fafafa]">JWT verification claims matched role <span className="text-[#eab308]">admin</span></div>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0e0e11]" />
                  <div className="bg-[#131316]/40 p-2.5 border border-[#27272a]/60 rounded-[6px] font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[#919095] mb-1">
                      <span>14:02:11.510</span>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded text-[9px]">POSTGRES</span>
                    </div>
                    <div className="text-[#fafafa]">Query executed <span className="text-emerald-400">SELECT inventory</span> (92ms)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Context Map Graph */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-mono font-bold text-[#919095] uppercase tracking-wider flex items-center gap-1.5">
                🔗 Context Map
              </h3>
              
              <div className="aspect-video bg-[#131316]/40 border border-[#27272a] rounded-[6px] overflow-hidden relative flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full opacity-15">
                  <line x1="20%" y1="20%" x2="80%" y2="50%" stroke="#3b82f6" strokeWidth="1.5" />
                  <line x1="20%" y1="20%" x2="40%" y2="80%" stroke="#3b82f6" strokeWidth="1.5" />
                  <line x1="80%" y1="50%" x2="40%" y2="80%" stroke="#3b82f6" strokeWidth="1.5" />
                  <circle cx="20%" cy="20%" r="5" fill="#3b82f6" />
                  <circle cx="80%" cy="50%" r="5" fill="#eab308" />
                  <circle cx="40%" cy="80%" r="5" fill="#10b981" />
                </svg>
                <span className="text-[10px] font-mono font-bold text-[#919095] bg-[#0e0e11]/80 px-2.5 py-1 rounded border border-[#27272a] backdrop-blur-sm uppercase select-none">
                  VIX-THRESHOLD → RISK-MODEL
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
