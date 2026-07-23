import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import api from '../../lib/api'
import { toast } from 'sonner'



const STAGES = [
  { id: 0, label: 'Download Codebase', desc: 'Fetching ZIP archive from GitHub API' },
  { id: 1, label: 'Decompress & Scan', desc: 'Unpacking repository and scanning file trees' },
  { id: 2, label: 'Compile AST Nodes', desc: 'Parsing classes, functions, and symbols' },
  { id: 3, label: 'Resolve Import Links', desc: 'Building file dependency and execution trees' },
  { id: 4, label: 'Sync Cache Database', desc: 'Indexing code chunks into pgvector database' }
];

const INTELLIGENCE_MESSAGES = [
  'Parsing source files...',
  'Building dependency graph...',
  'Resolving imports...',
  'Detecting framework patterns...',
  'Extracting AST symbols...',
  'Mapping module boundaries...',
  'Measuring dependency density...',
  'Computing class hierarchy maps...',
  'Extracting execution paths...',
  'Analyzing import relationships...',
  'Preparing codebase overview...',
  'Finalizing vector store chunks...'
];

const parseRepoUrl = (url: string) => {
  try {
    const cleaned = url.trim().replace(/\/$/, '');
    const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/i);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (e) {}
  return null;
};

export default function HeroSection() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [repoUrl, setRepoUrl] = useState('')
  const [focused, setFocused] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [scannedInfo, setScannedInfo] = useState<{
    name: string;
    owner?: string;
    fileCount?: number;
    languages?: Record<string, number>;
    size?: number;
    framework?: string;
  } | null>(null)

  const sectionRef = useRef<HTMLElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const subtextRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)
  const socialRef = useRef<HTMLDivElement>(null)

  const backendFinishedRef = useRef(false)
  const backendDataRef = useRef<any>(null)
  const progressIntervalRef = useRef<any>(null)
  const messageIntervalRef = useRef<any>(null)

  // Derived current stage from overallProgress (0 to 4 while pacing, 5 on completion)
  const currentStage = overallProgress === 100 ? 5 : (
    overallProgress < 20 ? 0 : (
      overallProgress < 40 ? 1 : (
        overallProgress < 65 ? 2 : (
          overallProgress < 85 ? 3 : 4
        )
      )
    )
  );

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (headlineRef.current) {
        gsap.to(headlineRef.current, {
          y: -80, opacity: 0, ease: 'none',
          scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: 0.8 },
        })
      }
      if (subtextRef.current) {
        gsap.to(subtextRef.current, {
          y: -50, opacity: 0, ease: 'none',
          scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: '70% top', scrub: 0.6 },
        })
      }
      if (inputRef.current) {
        gsap.to(inputRef.current, {
          y: -20, opacity: 0, ease: 'none',
          scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: '60% top', scrub: 0.5 },
        })
      }
      if (socialRef.current) {
        gsap.to(socialRef.current, {
          y: -10, opacity: 0, ease: 'none',
          scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: '50% top', scrub: 0.4 },
        })
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  // Smooth progress loop
  useEffect(() => {
    if (!isAnalyzing) {
      setOverallProgress(0)
      backendFinishedRef.current = false
      backendDataRef.current = null
      return
    }

    messageIntervalRef.current = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % INTELLIGENCE_MESSAGES.length)
    }, 2800)

    let currentProgress = 0
    let isFastForwarding = false

    progressIntervalRef.current = setInterval(() => {
      if (backendFinishedRef.current) {
        isFastForwarding = true
      }

      if (isFastForwarding) {
        currentProgress += 3.5 // Race smoothly to 100%
        if (currentProgress >= 100) {
          currentProgress = 100
          clearInterval(progressIntervalRef.current)
          
          if (backendDataRef.current) {
            const repo = backendDataRef.current;
            setScannedInfo(prev => ({
              ...prev,
              name: repo.name,
              owner: repo.owner || prev?.owner,
              fileCount: repo.fileCount,
              languages: typeof repo.languages === 'string' ? JSON.parse(repo.languages) : repo.languages,
              size: repo.totalSize,
              framework: repo.framework
            }));
          }
        }
      } else {
        // Normal continuous progress pacing
        if (currentProgress < 20) {
          currentProgress += 0.35 // Stage 0
        } else if (currentProgress < 40) {
          currentProgress += 0.42 // Stage 1
        } else if (currentProgress < 65) {
          currentProgress += 0.28 // Stage 2
        } else if (currentProgress < 85) {
          currentProgress += 0.3 // Stage 3
        } else if (currentProgress < 98) {
          if (currentProgress < 95) {
            currentProgress += 0.05 // Stage 4 initial
          } else {
            currentProgress += 0.004 // Crawl infinitely to keep visually active
          }
        }
      }

      setOverallProgress(Math.min(currentProgress, 100))
    }, 50)

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current)
    }
  }, [isAnalyzing])

  // Redirection when finished
  useEffect(() => {
    if (isAnalyzing && overallProgress === 100 && backendDataRef.current) {
      const timer = setTimeout(() => {
        const repoId = backendDataRef.current.id
        setIsAnalyzing(false)
        navigate(`/dashboard/${repoId}`)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [isAnalyzing, overallProgress, navigate])

  const handleAnalyze = async () => {
    if (!repoUrl.trim()) return
    if (isAnalyzing) return

    if (!isAuthenticated) {
      toast.error('Please sign in to analyze repositories.')
      navigate('/auth')
      return
    }

    const parsed = parseRepoUrl(repoUrl)
    if (parsed) {
      setScannedInfo({
        name: parsed.repo,
        owner: parsed.owner,
      })
    } else {
      const segments = repoUrl.trim().replace(/\/$/, '').split('/')
      setScannedInfo({
        name: segments[segments.length - 1] || 'repository',
      })
    }

    setIsAnalyzing(true)
    setOverallProgress(0)

    try {
      const { data } = await api.post('/repos/scan-url', { url: repoUrl }, { timeout: 300000 })
      backendDataRef.current = data.data
      backendFinishedRef.current = true
    } catch (err: any) {
      setIsAnalyzing(false)
      toast.error(err.response?.data?.error?.message || 'Failed to scan repository.')
    }
  }

  return (
    <section id="hero" ref={sectionRef} style={{
      position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '120px 24px 60px',
    }}>
      {/* Smooth blending overlays */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '150px',
        background: 'linear-gradient(to bottom, transparent, rgba(5,3,8,0.4))', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5,3,8,0.3) 100%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '760px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }} style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div ref={socialRef}>
            <span className="badge" style={{ background: 'rgba(176,38,255,0.12)', borderColor: 'rgba(176,38,255,0.25)', color: '#D98CFF' }}>
              <span className="badge-dot" style={{ background: '#D98CFF' }} />
              Now in Beta
            </span>
          </div>
        </motion.div>

        <div ref={headlineRef} style={{ willChange: 'transform' }}>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: 'clamp(42px, 7vw, 72px)', fontWeight: 800, lineHeight: 1.1,
              letterSpacing: '-0.04em', marginBottom: '24px', color: '#ffffff' }}
          >
            Your AI <span className="text-gradient" style={{ display: 'inline' }}>Codebase</span><br />
            Co-Pilot
          </motion.h1>
        </div>

        <div ref={subtextRef}>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65, duration: 0.6 }}>
            <span style={{ fontSize: 'clamp(15px, 2vw, 17px)', color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.65, display: 'block', maxWidth: '540px', margin: '0 auto 40px', letterSpacing: '-0.01em',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              Paste a GitHub link. Archon ingests the entire repository,
              builds a knowledge graph, and becomes an expert you can ask anything.
            </span>
          </motion.p>
        </div>

        <div ref={inputRef} style={{ willChange: 'transform' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }} style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
            <div className="repo-input-wrapper" style={{
              alignItems: 'center',
              boxShadow: focused ? '0 0 0 3px rgba(176,38,255,0.18), 0 0 40px rgba(176,38,255,0.3)' : 'var(--shadow-md)',
              background: 'rgba(12, 12, 18, 0.9)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: 'rgba(255,255,255,0.6)' }}>
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 18c-4.51 2-5-2-7-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input className="repo-input" type="text" placeholder="github.com/owner/repository"
                value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                disabled={isAnalyzing}
                style={{ color: '#ffffff' }} />
              <button className="btn-primary" onClick={handleAnalyze} disabled={isAnalyzing}
                style={{ borderRadius: 'var(--radius-md)', padding: '8px 18px', fontSize: '13px', whiteSpace: 'nowrap', opacity: isAnalyzing ? 0.7 : 1 }}>
                {isAnalyzing ? 'Scanning...' : 'Analyze'}
                {!isAnalyzing && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 0.5 }}
            style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '48px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', alignSelf: 'center', fontWeight: 500 }}>Try:</span>
            {['vercel/next.js', 'facebook/react', 'microsoft/vscode'].map((repo) => (
              <button key={repo} onClick={() => setRepoUrl(`github.com/${repo}`)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '100px', padding: '4px 14px', color: 'rgba(255,255,255,0.85)',
                  fontSize: '12px', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { const t = e.target as HTMLButtonElement; t.style.borderColor = 'rgba(176,38,255,0.5)'; t.style.color = '#FF9FFC'; t.style.background = 'rgba(176,38,255,0.15)' }}
                onMouseLeave={(e) => { const t = e.target as HTMLButtonElement; t.style.borderColor = 'rgba(255,255,255,0.15)'; t.style.color = 'rgba(255,255,255,0.85)'; t.style.background = 'rgba(255,255,255,0.06)' }}>
                {repo}
              </button>
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
            fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              500+ repos analyzed
            </span>
            <span style={{ opacity: 0.3 }}>·</span><span>Open source</span>
            <span style={{ opacity: 0.3 }}>·</span><span>Free to use</span>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} transition={{ delay: 1.2, duration: 0.6 }}
        style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
      </motion.div>

      {/* Full-screen loading stepper */}
      {isAnalyzing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: '#050308',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 80%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', padding: '24px', overflowY: 'auto'
        }}>
          
          {/* Top Progress Block */}
          <div style={{ width: '100%', maxWidth: '800px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  System Analysis
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginTop: '2px' }}>
                  {currentStage === 5 ? 'Analysis Complete' : 'Compiling Codebase Intelligence...'}
                </h3>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                {Math.round(overallProgress)}
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>%</span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div style={{
              width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)',
              borderRadius: '99px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #b026ff 100%)',
                width: `${overallProgress}%`,
                transition: 'width 0.1s linear',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
                borderRadius: '99px'
              }} />
            </div>
          </div>

          {/* Main Dashboard Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '24px',
            width: '100%',
            maxWidth: '800px',
            minHeight: '360px',
            marginBottom: '32px'
          }} className="dashboard-grid">

            {/* Left Column: Timeline */}
            <div style={{
              background: 'rgba(12, 12, 18, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', gap: '20px' }}>
                
                {/* Steps mapping */}
                {STAGES.map((step, idx) => {
                  const isActive = currentStage === idx;
                  const isDone = overallProgress >= (idx + 1) * 20 || currentStage === 5;
                  
                  // Stage colors
                  const iconBorderColor = isDone ? '#10b981' : (isActive ? '#3b82f6' : 'rgba(255,255,255,0.08)');
                  const iconBg = isDone ? 'rgba(16, 185, 129, 0.1)' : (isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)');
                  const iconColor = isDone ? '#10b981' : (isActive ? '#3b82f6' : 'rgba(255,255,255,0.3)');
                  const labelColor = isActive ? '#fff' : (isDone ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)');
                  const descColor = isActive ? 'rgba(255,255,255,0.6)' : (isDone ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)');

                  // Flow Line Connector between steps
                  const showConnector = idx < STAGES.length - 1;
                  const connectorProgress = Math.max(0, Math.min(1, (overallProgress - (idx * 20)) / 20));

                  return (
                    <div key={idx} style={{ display: 'flex', gap: '16px', position: 'relative', alignItems: 'flex-start' }}>
                      
                      {/* Flow Connector Line */}
                      {showConnector && (
                        <div style={{
                          position: 'absolute',
                          left: '17px',
                          top: '36px',
                          bottom: '-20px',
                          width: '2px',
                          background: 'rgba(255,255,255,0.04)',
                          zIndex: 1
                        }}>
                          <div style={{
                            width: '100%',
                            height: `${connectorProgress * 100}%`,
                            background: isDone ? '#10b981' : '#3b82f6',
                            transition: 'height 0.1s linear'
                          }} />
                        </div>
                      )}

                      {/* Icon Indicator */}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        border: `1.5px solid ${iconBorderColor}`,
                        background: iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: iconColor,
                        zIndex: 2,
                        flexShrink: 0,
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        boxShadow: isActive ? '0 0 15px rgba(59, 130, 246, 0.25)' : 'none'
                      }}>
                        {isDone ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : idx === 0 ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        ) : idx === 1 ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        ) : idx === 2 ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        ) : idx === 3 ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                          </svg>
                        )}
                      </div>

                      {/* Text details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: labelColor, transition: 'color 0.2s' }}>
                          {step.label}
                        </span>
                        <span style={{ fontSize: '11px', color: descColor, lineHeight: '1.4', transition: 'color 0.2s' }}>
                          {step.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Repository Information Card */}
            <div style={{
              background: 'rgba(12, 12, 18, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              
              {/* Decorative scan overlay when active */}
              {currentStage !== 5 && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, height: '2px',
                  background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                  animation: 'radar-scan 2.8s linear infinite',
                  zIndex: 3
                }} />
              )}

              {/* Repo Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>REPOSITORY</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    {scannedInfo?.owner ? `${scannedInfo.owner}/${scannedInfo.name}` : scannedInfo?.name}
                  </span>
                </div>
              </div>

              {/* Data Panel */}
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {currentStage === 5 ? (
                  // Completed stats view
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>FILES INDEXED</span>
                        <span style={{ display: 'block', fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                          {scannedInfo?.fileCount}
                        </span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>FRAMEWORK</span>
                        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '12px', textTransform: 'capitalize' }}>
                          {scannedInfo?.framework || 'Vanilla JS'}
                        </span>
                      </div>
                    </div>

                    {/* Languages Distribution */}
                    {scannedInfo?.languages && Object.keys(scannedInfo.languages).length > 0 && (
                      <div>
                        <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: '10px' }}>
                          LANGUAGES DETECTED
                        </span>
                        
                        {/* GitHub-style split bar */}
                        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: '14px' }}>
                          {getLanguagesList(scannedInfo.languages).map((lang, i) => (
                            <div key={i} style={{ width: `${lang.percentage}%`, background: lang.color, height: '100%' }} />
                          ))}
                        </div>

                        {/* Languages Legend Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {getLanguagesList(scannedInfo.languages).slice(0, 4).map((lang, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: lang.color }} />
                              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                                {lang.name}
                              </span>
                              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                                {Math.round(lang.percentage)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Active scanning placeholder card
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px 0' }}>
                    
                    {/* Spinning pulse ring */}
                    <div style={{ position: 'relative', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="radar-circle" style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        border: '2px solid rgba(99,102,241,0.2)',
                        animation: 'radar-ring 1.8s cubic-bezier(0.215, 0.610, 0.355, 1) infinite'
                      }} />
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8',
                        animation: 'pulse 2s ease-in-out infinite'
                      }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'block' }}>
                        Scanning Repository Modules
                      </span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', display: 'block' }}>
                        Indexing files and generating AST profiles
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom active analysis rotating message */}
          <div style={{
            height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', color: '#818cf8', fontWeight: 500, letterSpacing: '0.01em',
            transition: 'all 0.3s ease-in-out'
          }}>
            <span style={{ display: 'inline-block', marginRight: '8px', width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', animation: 'pulse 1s infinite' }} />
            {INTELLIGENCE_MESSAGES[messageIndex]}
          </div>

          <style>{`
            @keyframes radar-scan {
              0% { transform: translateY(-100%); opacity: 0; }
              10% { opacity: 0.8; }
              90% { opacity: 0.8; }
              100% { transform: translateY(360px); opacity: 0; }
            }
            @keyframes radar-ring {
              0% { transform: scale(0.6); opacity: 0.8; }
              100% { transform: scale(1.3); opacity: 0; }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(0.95); opacity: 0.75; }
            }
            .animate-spin-slow {
              animation: spin-slow 8s linear infinite;
            }
            @keyframes spin-slow {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @media (max-width: 768px) {
              .dashboard-grid {
                grid-template-columns: 1fr !important;
                gap: 16px !important;
              }
            }
          `}</style>
        </div>
      )}

    </section>
  )
}

const getLanguagesList = (languagesMap: Record<string, number> | undefined) => {
  if (!languagesMap) return [];
  const total = Object.values(languagesMap).reduce((sum, val) => sum + val, 0);
  if (total === 0) return [];
  
  const colors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Python: '#3572a5',
    Rust: '#dea584',
    Go: '#00add8',
    C: '#555555',
    'C++': '#f34b7d',
    Shell: '#89e051'
  };

  return Object.entries(languagesMap)
    .map(([name, bytes]) => ({
      name,
      percentage: (bytes / total) * 100,
      color: colors[name] || '#8b5cf6'
    }))
    .sort((a, b) => b.percentage - a.percentage);
};
