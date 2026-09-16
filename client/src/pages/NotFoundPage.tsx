import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e1e5', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '140px 24px 80px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '96px',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.05em',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '16px',
          }}
        >
          404
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          Route Not Found
        </h1>

        <p style={{ fontSize: '14px', color: '#919095', maxWidth: '440px', lineHeight: 1.6, marginBottom: '32px' }}>
          The page or resource you requested does not exist or may have been moved.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-primary"
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Go Back</span>
          </button>
          <Link
            to="/"
            className="btn-ghost"
            style={{ padding: '9px 20px', fontSize: '13px', textDecoration: 'none' }}
          >
            Return Home
          </Link>
          <Link
            to="/history"
            className="btn-ghost"
            style={{ padding: '9px 20px', fontSize: '13px', textDecoration: 'none' }}
          >
            My Repositories
          </Link>
          <Link
            to="/docs"
            className="btn-ghost"
            style={{ padding: '9px 20px', fontSize: '13px', textDecoration: 'none' }}
          >
            Documentation
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
