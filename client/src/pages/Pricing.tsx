import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import FAQSection from '../components/sections/FAQSection';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface Plan {
  id: 'free' | 'pro';
  name: string;
  badge: string;
  price: string;
  period: string;
  purpose: string;
  desc: string;
  popular: boolean;
  features: PlanFeature[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Explorer',
    badge: 'Standard Access',
    price: '$0',
    period: 'forever',
    purpose: 'Deep architecture exploration for individual developers.',
    desc: 'Analyze standalone codebases, uncover dependency structures, and query the codebase graph at zero cost.',
    popular: false,
    features: [
      { text: '2 lifetime codebase analyses', included: true },
      { text: '1 active codebase at a time', included: true },
      { text: 'Max 400 files per repository', included: true },
      { text: 'Max 15 MB repository size', included: true },
      { text: '10 AI questions / month', included: true },
      { text: '1 re-index per codebase', included: true },
      { text: 'Basic Architecture maps', included: true },
      { text: 'Interactive Dependency Graph', included: true },
      { text: 'Trace Flow & Identity mapping', included: true },
      { text: 'Automated Onboarding guide', included: true },
      { text: 'Codebase RAG & Semantic Search', included: true },
      { text: 'Blast Radius & Impact Simulation', included: false },
      { text: 'Multi-repository active index', included: false },
      { text: 'Priority indexing queue', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Architect',
    badge: 'Continuous Intelligence',
    price: '$7.99',
    period: '/month',
    purpose: 'Continuous codebase intelligence & living architecture maps.',
    desc: 'For professional software engineers maintaining critical repositories who need persistent graph states and blast radius analysis.',
    popular: true,
    features: [
      { text: '10 active codebases simultaneously', included: true, highlight: true },
      { text: 'Max 2,000 files per repository', included: true, highlight: true },
      { text: 'Max 50 MB repository size', included: true, highlight: true },
      { text: '500 AI questions / month', included: true, highlight: true },
      { text: '30 re-indexes / month', included: true, highlight: true },
      { text: 'Full Architecture & Module maps', included: true },
      { text: 'Interactive Dependency Graph', included: true },
      { text: 'Trace Flow & Identity mapping', included: true },
      { text: 'Automated Onboarding guide', included: true },
      { text: 'Codebase RAG & Semantic Search', included: true },
      { text: 'Deep Impact & Blast Radius Simulation', included: true, highlight: true },
      { text: 'Full Registry & Multi-codebase index', included: true, highlight: true },
      { text: 'Priority indexing pipeline', included: true, highlight: true },
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, isAuthenticated, fetchUser } = useAuthStore();
  const [upgrading, setUpgrading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);

    // Defensive listener against noisy browser extension rejections
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (e?.reason?.message && typeof e.reason.message === 'string' && e.reason.message.includes('chrome-extension://')) {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  const handlePlanAction = (targetPlan: 'free' | 'pro') => {
    if (!isAuthenticated) {
      navigate('/auth?mode=signup&redirect=/pricing');
      return;
    }

    const currentPlan = user?.plan || 'free';
    if (targetPlan === 'free') {
      if (currentPlan === 'free') {
        toast.info('You are already exploring with the Explorer plan.');
      } else {
        toast.info('Explorer capabilities are already fully included with your Architect subscription.');
      }
      return;
    }

    if (currentPlan === 'pro') {
      toast.info('You currently have an active Architect subscription.');
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmUpgrade = async () => {
    setUpgrading(true);
    try {
      await api.post('/auth/upgrade', { plan: 'pro' });
      await fetchUser();
      toast.success('Welcome to Archon Architect! 10 active codebases and 500 AI questions/mo unlocked.');
      setShowConfirmModal(false);
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Failed to update plan. Please try again.';
      toast.error(errMsg);
    } finally {
      setUpgrading(false);
    }
  };

  const currentPlan = user?.plan || 'free';

  return (
    <div id="pricing-wrapper" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: '#050308', overflowX: 'hidden' }}>
      <Navbar />

      {/* Hero */}
      <section style={{
        paddingTop: '140px', paddingBottom: '60px',
        textAlign: 'center', position: 'relative',
      }}>
        {/* Atmospheric ambient glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(176,38,255,0.08) 0%, transparent 60%)',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ position: 'relative', maxWidth: '680px', margin: '0 auto', padding: '0 24px' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '4px 12px', borderRadius: '100px',
            background: 'rgba(176,38,255,0.08)', border: '1px solid rgba(176,38,255,0.25)',
            marginBottom: '16px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b026ff' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c084fc' }}>
              Transparent Engineering Tiers
            </span>
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800, letterSpacing: '-0.04em',
            lineHeight: 1.15, color: '#fff', marginBottom: '16px',
          }}>
            Predictable limits for production engineering.
          </h1>
          <p style={{
            fontSize: '15px', color: '#a1a1aa',
            lineHeight: 1.6, letterSpacing: '-0.01em',
          }}>
            Start with deep architecture inspection at zero cost. Upgrade to Architect to keep multiple repositories continuously synchronized and indexed.
          </p>
        </motion.div>
      </section>

      {/* Pricing Grid */}
      <section style={{ padding: '0 24px 90px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 460px))',
          maxWidth: '960px',
          margin: '0 auto',
          gap: '24px',
          justifyContent: 'center',
          alignItems: 'stretch',
        }}>
          {PLANS.map((plan, i) => {
            const isCurrent = isAuthenticated && currentPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                style={{ display: 'flex' }}
              >
                <PricingCard
                  plan={plan}
                  isCurrent={isCurrent}
                  currentPlan={currentPlan}
                  isAuthenticated={isAuthenticated}
                  onAction={() => handlePlanAction(plan.id)}
                />
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Upgrade to Architect Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px',
            }}
            onClick={() => !upgrading && setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '480px', width: '100%',
                background: '#0e0a16',
                border: '1px solid rgba(176,38,255,0.3)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(176,38,255,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: 'rgba(176,38,255,0.15)', border: '1px solid rgba(176,38,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#d946ef', fontSize: '20px', fontWeight: 700,
                }}>
                  ✦
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
                    Upgrade to Archon Architect
                  </h3>
                  <p style={{ fontSize: '13px', color: '#919095', margin: '2px 0 0' }}>
                    $7.99 / month — Instant entitlement activation
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '16px 18px',
                fontSize: '13px',
                color: '#d4d4d8',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                  What activates immediately:
                </div>
                <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li><strong>10 active codebases</strong> retained with full index state</li>
                  <li><strong>2,000 files & 50 MB</strong> capacity per repository</li>
                  <li><strong>500 monthly AI questions</strong> & 30 re-indexes</li>
                  <li><strong>Deep Impact & Blast Radius</strong> change simulations</li>
                  <li><strong>Priority indexing queue</strong> with accelerated AST generation</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={upgrading}
                  onClick={() => setShowConfirmModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#a1a1aa',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={upgrading}
                  onClick={confirmUpgrade}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(176,38,255,0.3)',
                    opacity: upgrading ? 0.6 : 1,
                  }}
                >
                  {upgrading ? 'Activating...' : 'Activate Architect Plan ($7.99/mo)'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FAQSection />
      <Footer />
    </div>
  );
}

interface PricingCardProps {
  plan: Plan;
  isCurrent: boolean;
  currentPlan: 'free' | 'pro';
  isAuthenticated: boolean;
  onAction: () => void;
}

function PricingCard({ plan, isCurrent, currentPlan, isAuthenticated, onAction }: PricingCardProps) {
  const [hovered, setHovered] = useState(false);
  const isArchitectUser = isAuthenticated && currentPlan === 'pro';

  // Determine button text and disabled state
  let buttonLabel = 'Get Started';
  let isButtonDisabled = false;

  if (!isAuthenticated) {
    buttonLabel = plan.id === 'pro' ? 'Get Architect' : 'Start as Explorer';
  } else if (isCurrent) {
    buttonLabel = 'Current Plan';
    isButtonDisabled = true;
  } else if (plan.id === 'free' && isArchitectUser) {
    buttonLabel = 'Included with Architect';
    isButtonDisabled = true;
  } else if (plan.id === 'pro') {
    buttonLabel = 'Upgrade to Architect ($7.99/mo)';
    isButtonDisabled = false;
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: plan.popular
          ? 'linear-gradient(180deg, rgba(176,38,255,0.08) 0%, rgba(10,4,18,0.95) 100%)'
          : 'rgba(255,255,255,0.02)',
        border: plan.popular
          ? hovered ? '1px solid rgba(176,38,255,0.5)' : '1px solid rgba(176,38,255,0.32)'
          : hovered ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        padding: '36px 30px',
        boxShadow: plan.popular
          ? '0 0 50px rgba(176,38,255,0.12), 0 20px 60px rgba(0,0,0,0.4)'
          : '0 8px 40px rgba(0,0,0,0.2)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 0.25s ease, border-color 0.25s ease',
      }}
    >
      {/* Top accent line for Architect */}
      {plan.popular && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, #b026ff, #6366f1, transparent)',
        }} />
      )}

      {/* Badge area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '26px', marginBottom: '16px' }}>
        {plan.popular ? (
          <span style={{
            background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
            borderRadius: '100px',
            padding: '4px 12px',
            fontSize: '11px', fontWeight: 700,
            color: '#fff', letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {plan.badge}
          </span>
        ) : (
          <span style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '100px',
            padding: '4px 12px',
            fontSize: '11px', fontWeight: 600,
            color: '#a1a1aa', letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {plan.badge}
          </span>
        )}

        {isCurrent && (
          <span style={{
            border: '1px solid #22c55e',
            background: 'rgba(34,197,94,0.1)',
            color: '#4ade80',
            borderRadius: '100px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            ✓ Active Tier
          </span>
        )}
      </div>

      {/* Title and Purpose */}
      <div style={{
        fontSize: '20px', fontWeight: 800, color: '#fff',
        marginBottom: '4px', letterSpacing: '-0.02em',
      }}>
        {plan.name}
      </div>
      <div style={{ fontSize: '13px', color: '#c084fc', fontWeight: 500, marginBottom: '14px' }}>
        "{plan.purpose}"
      </div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
        <span style={{
          fontSize: '44px', fontWeight: 800, color: '#fff',
          letterSpacing: '-0.04em', lineHeight: 1,
        }}>
          {plan.price}
        </span>
        <span style={{ fontSize: '14px', color: '#71717a' }}>
          {plan.period}
        </span>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '13px', color: '#a1a1aa',
        marginBottom: '28px', lineHeight: 1.5,
        minHeight: '40px',
      }}>
        {plan.desc}
      </p>

      {/* CTA Button */}
      <button
        onClick={onAction}
        disabled={isButtonDisabled}
        style={{
          width: '100%',
          padding: '12px 0',
          fontSize: '14px',
          fontWeight: 600,
          borderRadius: '10px',
          marginBottom: '32px',
          cursor: isButtonDisabled ? 'default' : 'pointer',
          transition: 'all 0.2s',
          ...(isButtonDisabled
            ? {
                background: 'rgba(255,255,255,0.04)',
                color: '#71717a',
                border: '1px solid rgba(255,255,255,0.08)',
              }
            : plan.popular
            ? {
                background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 4px 20px rgba(176,38,255,0.3)',
              }
            : {
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)',
              }),
        }}
      >
        {buttonLabel}
      </button>

      {/* Features List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
          Included Capabilities:
        </div>
        {plan.features.map((feat) => (
          <div
            key={feat.text}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: feat.included ? (feat.highlight ? '#f4f4f5' : '#d4d4d8') : '#52525b',
              fontWeight: feat.highlight ? 600 : 400,
            }}
          >
            <span
              style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                flexShrink: 0,
                color: feat.included ? '#22c55e' : '#52525b',
                opacity: feat.included ? 1 : 0.4,
              }}
            >
              {feat.included ? '✓' : '—'}
            </span>
            <span>{feat.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
