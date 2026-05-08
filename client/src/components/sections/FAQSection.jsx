import React, { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const FAQS = [
  {
    q: 'What types of repositories does Archon support?',
    a: 'Archon works with any public GitHub repository regardless of language or framework. We support JavaScript, TypeScript, Python, Go, Rust, Java, C++, and more. Private repository support is available on Pro and Team plans.',
  },
  {
    q: 'How does the AI analysis work?',
    a: 'Archon clones your repository, splits every file into semantically meaningful chunks, and generates vector embeddings using state-of-the-art language models. These embeddings are indexed into a FAISS vector store, creating a knowledge graph that maps relationships between functions, modules, and patterns.',
  },
  {
    q: 'Is my code secure and private?',
    a: 'Your code is processed in isolated, ephemeral environments and is never stored permanently on our servers. Embeddings are encrypted at rest. We do not use your code for model training. Enterprise customers can opt for on-premise deployment.',
  },
  {
    q: 'Can Archon generate documentation automatically?',
    a: 'Yes. Archon can generate comprehensive README files, API documentation, architecture overviews, and onboarding guides based on its understanding of your codebase. All generated documentation includes accurate file references and line numbers.',
  },
  {
    q: 'How accurate is the code understanding?',
    a: 'Archon achieves 98% accuracy on code retrieval benchmarks. Our RAG pipeline uses multi-pass retrieval with re-ranking to ensure the most relevant code chunks are surfaced. Every answer includes source file references so you can verify.',
  },
  {
    q: 'Can my team collaborate on the same repository?',
    a: 'Team plans allow multiple members to access the same analyzed repositories, share chat sessions, and collaborate on documentation. Each team member gets their own chat context while sharing the underlying knowledge base.',
  },
  {
    q: 'What integrations are available?',
    a: 'Archon integrates with GitHub (OAuth + API), VS Code (extension coming soon), and offers a REST API for custom integrations. Webhook support for CI/CD pipelines is available on Team plans.',
  },
  {
    q: 'How long does analysis take?',
    a: 'Most repositories under 5,000 files are analyzed in under 30 seconds. Larger monorepos may take 1-2 minutes. Once analyzed, queries are answered in real-time with sub-second latency.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0)
  const sectionRef = useRef(null)
  const itemsRef = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      itemsRef.current.forEach((item) => {
        if (!item) return
        gsap.from(item, {
          y: 30, opacity: 0,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: item,
            start: 'top 88%',
            end: 'top 65%',
            scrub: 0.5,
          },
        })
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} style={{ padding: '120px 24px 140px', position: 'relative' }}>
      {/* Atmospheric glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(176,38,255,0.03) 0%, transparent 60%)',
      }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative' }}>
        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <p style={{
            fontSize: '12px', fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-muted)',
            marginBottom: '16px',
          }}>
            Frequently Asked Questions
          </p>
          <h2 style={{
            fontSize: 'clamp(24px, 3.5vw, 34px)',
            fontWeight: 800, letterSpacing: '-0.03em',
            lineHeight: 1.15, color: '#fff',
          }}>
            Everything you need to know
          </h2>
        </div>

        {/* Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {FAQS.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
              ref={el => itemsRef.current[i] = el}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQItem = React.forwardRef(({ faq, isOpen, onToggle }, ref) => {
  const contentRef = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0)
    }
  }, [isOpen])

  return (
    <div
      ref={ref}
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 0',
          background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{
          fontSize: '15px', fontWeight: 600, color: '#fff',
          letterSpacing: '-0.01em', paddingRight: '24px',
          lineHeight: 1.4,
        }}>
          {faq.q}
        </span>
        <span style={{
          flexShrink: 0, width: '24px', height: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)',
          color: isOpen ? 'var(--accent-light)' : 'var(--text-muted)',
          fontSize: '14px', fontWeight: 300,
          transition: 'all 0.3s ease',
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
        }}>
          +
        </span>
      </button>

      <div style={{
        maxHeight: `${height}px`,
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div ref={contentRef} style={{
          paddingBottom: '20px',
          fontSize: '14px', color: 'var(--text-secondary)',
          lineHeight: 1.7, maxWidth: '560px',
        }}>
          {faq.a}
        </div>
      </div>
    </div>
  )
})
