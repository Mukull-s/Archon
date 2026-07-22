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

const STARTER_QUESTIONS = [
  'Explain this repository.',
  'Where should I start?',
  'Find circular dependencies.',
  'Explain this module.',
  'Suggest refactoring opportunities.',
];

// Custom SVGs for Avatars & Icons
const PersonIcon = () => (
  <svg className="w-3.5 h-3.5 text-[#e4e1e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const BoltIcon = () => (
  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A4.5 4.5 0 0112 5.072 4.5 4.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState(!!isIndexed);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Auto-trigger chat prompt from external tabs
  useEffect(() => {
    if (autoTriggerChatPrompt) {
      sendMessage(autoTriggerChatPrompt);
      if (onClearAutoPrompt) onClearAutoPrompt();
    }
  }, [autoTriggerChatPrompt]);

  // Dynamic loading message
  const [loadingStep, setLoadingStep] = useState('Retrieving repository context...');

  // Live Query Planner State
  const [currentPlan, setCurrentPlan] = useState<{ intent: string; steps: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [historyLoading, setHistoryLoading] = useState(true);

  // Load chat history on mount (with localStorage caching fallback)
  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data } = await api.get(`/repos/${repositoryId}/chat/history`);
        if (data.data && data.data.length > 0) {
          setMessages(data.data);
          setIndexed(true);
          // Cache in localStorage
          localStorage.setItem(`archon_chat_history_${repositoryId}`, JSON.stringify(data.data));
          setHistoryLoading(false);
          return;
        }
      } catch (err) {
        console.warn('History API request failed. Reverting to cache.');
      }

      // Read fallback cache
      try {
        const cached = localStorage.getItem(`archon_chat_history_${repositoryId}`);
        if (cached) {
          setMessages(JSON.parse(cached));
          setIndexed(true);
        }
      } catch (e) {
        console.error('Failed to read cached chat:', e);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [repositoryId]);

  // Auto-scroll on messages or loading step updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, loadingStep]);

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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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

    const token = localStorage.getItem('archon_token');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'USER',
      message: prompt,
      createdAt: new Date().toISOString()
    };
    
    // Add user message immediately
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
    // Find last user prompt
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

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied conversation block.');
  };

  // Helper: Extract source files from text tags like [src/index.tsx]
  const referencedFiles = useMemo(() => {
    if (messages.length === 0) return [];
    // Accumulate all references in the chat
    const allRefs = new Set<string>();
    messages.forEach(msg => {
      const matches = msg.message.match(/\[([a-zA-Z0-9_\-\.\/]+)\]/g);
      if (matches) {
        matches.forEach(m => allRefs.add(m.slice(1, -1)));
      }
    });
    return Array.from(allRefs);
  }, [messages]);

  // Qualitative confidence score based on sources
  const qualitativeConfidence = useMemo(() => {
    if (referencedFiles.length === 0) return null;
    if (referencedFiles.length >= 5) return 'High evidence';
    if (referencedFiles.length >= 2) return 'Medium evidence';
    return 'Limited evidence';
  }, [referencedFiles]);

  const renderInlineText = (text: string, keyBase: number) => {
    const boldified = text.split(/\*\*(.*?)\*\*/g).map((segment, i) => {
      if (i % 2 === 1) return <strong key={`b-${keyBase}-${i}`} className="text-white font-semibold">{segment}</strong>;
      return segment.split(/`([^`]+)`/g).map((part, j) => {
        if (j % 2 === 1) {
          return <code key={`c-${keyBase}-${i}-${j}`} className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-1 py-0.5 rounded text-[#93c5fd] font-mono text-[12px]">{part}</code>;
        }
        return part.split(/\[([a-zA-Z0-9_\-\.\/]+)\]/g).map((fp, k) => {
          if (k % 2 === 1) {
            return (
              <button
                key={`f-${keyBase}-${i}-${j}-${k}`}
                onClick={() => onNavigateToFile(fp)}
                className="bg-[#3b82f6]/5 hover:bg-[#3b82f6]/15 border border-[#3b82f6]/20 text-[#60a5fa] font-mono text-[12px] px-1.5 py-0.5 rounded cursor-pointer inline transition-colors"
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

  const renderAIContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIdx = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(renderInlineText(text.substring(lastIdx, match.index), parts.length));
      }
      const codeSnippet = match[2].trim();
      parts.push(
        <div key={`code-container-${parts.length}`} className="my-3 border border-[#27272a] rounded-[6px] bg-[#09090b]/80 overflow-hidden font-mono">
          <div className="flex justify-between items-center bg-[#0e0e11] px-4 py-1.5 border-b border-[#27272a] text-[11px] text-[#919095]">
            <span>CODE BLOCK</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(codeSnippet);
                toast.success('Copied code snippet');
              }}
              className="text-[#3b82f6] hover:text-[#fafafa] flex items-center gap-1 cursor-pointer"
            >
              <CopyIcon /> Copy
            </button>
          </div>
          <pre className="p-3 text-[12px] text-[#fafafa] overflow-x-auto leading-relaxed whitespace-pre pr-1">
            <code>{codeSnippet}</code>
          </pre>
        </div>
      );
      lastIdx = codeBlockRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(renderInlineText(text.substring(lastIdx), parts.length));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)] lg:h-[calc(100vh-160px)] relative overflow-hidden">
      
      {/* LEFT COLUMN: CONVERSATION PANEL */}
      <div className="w-full lg:w-7/12 bg-[#131316] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden flex-shrink-0">
        
        {/* Messages Scrolling Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin" data-lenis-prevent>
          {historyLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loading message="Preparing AI assistant..." type="skeleton" />
            </div>
          ) : messages.length === 0 && !loading && !indexing ? (
            <div className="h-full flex items-center justify-center">
              <Empty
                title="Cognitive Codebase Co-Pilot"
                description="Ask a question about your repository to begin vector search retrieval planning across AST scopes."
                action={
                  <div className="w-full flex flex-col gap-2 max-w-xs mx-auto mt-2">
                    {STARTER_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="w-full text-left bg-[#0e0e11] hover:bg-[#1f1f22]/70 border border-[#27272a] hover:border-[#3b82f6]/40 p-2 py-1.5 px-3 rounded-[6px] text-[12px] text-[#c8c5ca] hover:text-[#fafafa] font-mono cursor-pointer transition-all duration-150"
                        title={`Ask: ${q}`}
                        aria-label={`Ask: ${q}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                }
              />
            </div>
          ) : (
            /* Message Bubbles list */
            <div className="space-y-6">
              {messages.map((msg) => {
                const isUser = msg.sender === 'USER';
                return (
                  <div key={msg.id} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    
                    {/* Avatar Icon */}
                    {!isUser && (
                      <div className="w-7 h-7 rounded-[4px] bg-[#3b82f6] flex items-center justify-center shrink-0 border border-[#3b82f6]/30">
                        <BoltIcon />
                      </div>
                    )}

                    <div className="max-w-[85%] flex flex-col gap-1.5">
                      
                      {/* Name/Model Header */}
                      <div className="flex items-center gap-2 text-[10px] font-mono text-[#919095]">
                        <span>{isUser ? 'You' : 'Archon AI'}</span>
                      </div>

                      {/* Bubble */}
                      <div className={`p-4 rounded-[8px] border text-[13px] leading-relaxed relative group ${
                        isUser
                          ? 'bg-[#3b82f6]/5 border-[#3b82f6]/10 text-[#dbeafe] rounded-tr-none'
                          : 'bg-[#1f1f22]/20 border-[#27272a] text-[#c8c5ca] rounded-tl-none'
                      }`}>
                        
                        {/* Evidence Badge (for AI) */}
                        {!isUser && qualitativeConfidence && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#3b82f6] bg-[#3b82f6]/5 w-fit px-2 py-0.5 rounded border border-[#3b82f6]/15 mb-3">
                            <span>✓</span>
                            <span>{qualitativeConfidence.toUpperCase()}</span>
                          </div>
                        )}

                        <div className="break-all whitespace-pre-wrap">
                          {isUser ? msg.message : renderAIContent(msg.message)}
                        </div>

                        {/* Copy / Action overlay buttons */}
                        {!isUser && msg.message && (
                          <div className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 flex gap-1 transition-opacity">
                            <button
                              onClick={() => handleCopyText(msg.message)}
                              className="p-1 rounded bg-[#0e0e11] border border-[#27272a] text-[#919095] hover:text-[#fafafa] cursor-pointer"
                              title="Copy response text"
                            >
                              <CopyIcon />
                            </button>
                          </div>
                        )}
                      </div>

                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-[4px] bg-[#27272a] flex items-center justify-center shrink-0 border border-[#39393c]">
                        <PersonIcon />
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Cognitive Planner Plan Steps */}
              {currentPlan && loading && (
                <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/15 rounded-[8px] p-4 max-w-sm ml-10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono font-bold text-[#60a5fa] uppercase">🎯 Intent: {currentPlan.intent}</span>
                    <span className="text-[9px] font-mono text-[#919095]">RAG Planner</span>
                  </div>
                  <div className="space-y-1.5">
                    {currentPlan.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-[#919095] font-mono">
                        <span className="text-emerald-400">✓</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming loading state */}
              {loading && (
                <div className="flex gap-3.5 items-center ml-10">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-mono text-[#919095] tracking-wide">{loadingStep}</span>
                </div>
              )}

              {aiError && (
                <div className="p-2 ml-10">
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

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Controls Area */}
        <div className="p-3 border-t border-[#27272a] bg-[#0e0e11]">
          
          {/* Removable selected context chips */}
          {selectedFiles.size > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none max-w-full whitespace-nowrap">
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

          {/* Chat input form container */}
          <form onSubmit={handleSubmit} className="relative border border-[#27272a] focus-within:border-[#3b82f6] bg-[#09090b] rounded-[6px] p-2">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={indexing ? 'Retrieving repository context...' : loading ? 'Thinking...' : 'Ask anything about the architecture or files...'}
              disabled={loading || indexing}
              className="w-full bg-transparent border-none text-[#fafafa] placeholder-[#919095] text-[13px] font-mono leading-relaxed outline-none resize-none focus:ring-0 p-1"
            />

            <div className="flex justify-between items-center mt-2 px-1">
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#919095] bg-[#1f1f22]/50 border border-[#27272a]/50 px-2 py-0.5 rounded">
                  📁 {selectedFiles.size} FILES
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-[#919095] hidden md:inline">
                  ⌘ + Enter to send
                </span>
                
                {loading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="bg-[#93000a]/20 border border-[#93000a]/40 text-[#ffb4ab] px-3.5 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#93000a]/30 transition-all"
                    title="Stop generation"
                    aria-label="Stop generation"
                  >
                    STOP
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    {messages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        className="bg-[#1f1f22] border border-[#27272a] text-[#c8c5ca] hover:text-[#fafafa] px-3 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1 cursor-pointer transition-all"
                        title="Regenerate last response"
                        aria-label="Regenerate last response"
                      >
                        <RefreshIcon />
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!input.trim() || loading || indexing}
                      title="Send message"
                      aria-label="Send message"
                      className={`px-4 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        input.trim()
                          ? 'bg-[#3b82f6] text-white hover:bg-[#3b82f6]/95'
                          : 'bg-[#1f1f22] text-[#919095] border border-[#27272a]/50 opacity-50 cursor-default'
                      }`}
                    >
                      ANALYZE →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </form>

        </div>

      </div>

      {/* RIGHT COLUMN: EVIDENCE PANEL */}
      <div className="flex-1 bg-[#0e0e11] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden">
        
        {/* Evidence Header */}
        <div className="h-10 border-b border-[#27272a] bg-[#0e0e11] px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2 text-[#fafafa] font-mono text-[11px] font-bold uppercase tracking-wider">
            <svg className="w-4 h-4 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Evidence Panel
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[10px] font-mono text-[#919095]">
              {loading ? 'Retrieving evidence...' : 'Context warmed'}
            </span>
          </div>
        </div>

        {/* Evidence Scroll Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin" data-lenis-prevent>
          
          {/* referenced files list */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-mono font-bold text-[#919095] uppercase tracking-wider flex items-center gap-1.5">
              📁 Referenced Files
            </h3>
            
            {referencedFiles.length > 0 ? (
              <div className="space-y-2">
                {referencedFiles.map(filePath => (
                  <div
                    key={filePath}
                    onClick={() => onNavigateToFile(filePath)}
                    className="p-3 border border-[#27272a] bg-[#131316]/50 rounded-[6px] hover:border-[#3b82f6] transition-colors cursor-pointer group flex flex-col gap-0.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[12.5px] font-mono font-semibold text-[#fafafa] group-hover:text-[#3b82f6]">
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
                  <div className="text-[#fafafa]">Incoming checkout trace ID: <span className="text-[#3b82f6]">tx_8f2a9c1</span></div>
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
                  <div className="text-[#fafafa]">Query executed <span className="text-emerald-400">SELECT inventory</span> (Latency: 92ms)</div>
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

    </div>
  );
}
