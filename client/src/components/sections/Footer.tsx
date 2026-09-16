import React from 'react'
import { Link } from 'react-router-dom'

interface FooterLinkItem {
  label: string
  href: string
  external?: boolean
}

interface FooterGroupProps {
  title: string
  links: FooterLinkItem[]
}

function FooterGroup({ title, links }: FooterGroupProps) {
  return (
    <div>
      <div style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map(l => (
          l.external ? (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              {l.label}
            </a>
          ) : (
            <Link
              key={l.label}
              to={l.href}
              className="footer-link"
            >
              {l.label}
            </Link>
          )
        ))}
      </div>
    </div>
  )
}

export default function Footer() {
  const productLinks: FooterLinkItem[] = [
    { label: 'Architecture Graph', href: '/dashboard' },
    { label: 'Pricing Plans', href: '/pricing' },
    { label: 'Documentation', href: '/docs' },
  ]

  const developerLinks: FooterLinkItem[] = [
    { label: 'GitHub Repository', href: 'https://github.com/Mukull-s/Archon', external: true },
    { label: 'API Reference', href: '/docs' },
    { label: 'Codebase Hub', href: '/history' },
  ]

  const legalLinks: FooterLinkItem[] = [
    { label: 'Privacy Policy', href: '/docs' },
    { label: 'Terms of Service', href: '/docs' },
    { label: 'System Status', href: '/docs' },
  ]

  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '48px 24px 32px' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: '40px', flexWrap: 'wrap', gap: '32px',
        }}>
          <div>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', textDecoration: 'none' }}>
              <img src="/Archonlogo.png" alt="Archon Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Archon</span>
            </Link>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '220px', lineHeight: 1.6 }}>
              AI-powered codebase intelligence.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
            <FooterGroup title="Product" links={productLinks} />
            <FooterGroup title="Developers" links={developerLinks} />
            <FooterGroup title="Resources" links={legalLinks} />
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
