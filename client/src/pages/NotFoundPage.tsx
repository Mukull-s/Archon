import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';

export default function NotFoundPage() {
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
          <Link
            to="/"
            className="btn-primary"
            style={{ padding: '9px 22px', fontSize: '13px', textDecoration: 'none' }}
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
