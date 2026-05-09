import React from 'react'
import { motion } from 'framer-motion'

const TECH = [
  { name: 'React', icon: '⚛️' },
  { name: 'Node.js', icon: '🟢' },
  { name: 'LangChain', icon: '🔗' },
  { name: 'MiniMax AI', icon: '🤖' },
  { name: 'Gemini', icon: '✨' },
  { name: 'FAISS', icon: '🔍' },
  { name: 'GitHub API', icon: '🐙' },
  { name: 'Vector Search', icon: '🧮' },
  { name: 'Vite', icon: '⚡' },
  { name: 'Express', icon: '🛠' },
]

const MARQUEE_ITEMS = [...TECH, ...TECH]

export default function TechMarquee() {
  return (
    <section style={{
      padding: '48px 0',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div className="marquee-wrapper">
        <div className="marquee-track">
          {MARQUEE_ITEMS.map((tech, i) => (
            <div key={i} className="marquee-item">
              <span style={{ fontSize: '15px' }}>{tech.icon}</span>
              <span>{tech.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
