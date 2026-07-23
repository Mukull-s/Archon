import { useState } from 'react'
import { motion } from 'framer-motion'

export default function GoogleMockPage() {
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')

  const handleSelect = (email: string, name: string) => {
    const urlParams = new URLSearchParams(window.location.search)
    const state = urlParams.get('state') || ''
    const params = new URLSearchParams({
      code: 'mock_google_code',
      provider: 'google',
      state,
      email,
      name,
    })
    window.location.href = `/auth/callback?${params.toString()}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customEmail.trim() || !customName.trim()) return
    handleSelect(customEmail, customName)
  }

  const mockAccounts = [
    { email: 'lodabhai.dev@gmail.com', name: 'Loda Bhai' },
    { email: 'jane.doe@google.com', name: 'Jane Doe' },
    { email: 'john.smith@gmail.com', name: 'John Smith' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '40px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Google Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#fff',
          textAlign: 'center',
          margin: '0 0 8px 0',
          letterSpacing: '-0.02em',
        }}>
          Choose an account
        </h1>
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.45)',
          textAlign: 'center',
          margin: '0 0 32px 0',
        }}>
          to continue to <strong style={{ color: '#fff' }}>Archon</strong>
        </p>

        {/* Account List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {mockAccounts.map((acc) => (
            <button
              key={acc.email}
              onClick={() => handleSelect(acc.email, acc.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '13.5px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4285F4, #a0c4ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '12px',
              }}>
                {acc.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />
          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, textTransform: 'uppercase' }}>or use another</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />
        </div>

        {/* Custom Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500, marginBottom: '6px' }}>Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500, marginBottom: '6px' }}>Email Address</label>
            <input
              type="email"
              placeholder="e.g. user@example.com"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '11px 16px',
              marginTop: '4px',
              background: '#4285F4',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#357ae8'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#4285F4'}
          >
            Confirm Simulated Login
          </button>
        </form>
      </motion.div>
    </div>
  )
}
