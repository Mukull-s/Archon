import React from 'react'

interface FooterGroupProps {
  title: string
  links: string[]
}

function FooterGroup({ title, links }: FooterGroupProps) {
  return (
    <div>
      <div style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map(l => <a key={l} href="#" className="footer-link">{l}</a>)}
      </div>
    </div>
  )
}

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '48px 24px 32px' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: '40px', flexWrap: 'wrap', gap: '32px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '6px',
                background: 'var(--grad-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Archon</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '220px', lineHeight: 1.6 }}>
              AI-powered codebase intelligence.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
            <FooterGroup title="Product" links={['Features', 'How It Works', 'Changelog']} />
            <FooterGroup title="Developers" links={['GitHub', 'Docs', 'API']} />
            <FooterGroup title="Legal" links={['Privacy', 'Terms']} />
          </div>
        </div>

        <div style={{
          paddingTop: '20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '12px', color: 'var(--text-muted)',
        }}>
          <span>© {new Date().getFullYear()} Archon</span>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  )
}
