import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import FAQSection from '../components/sections/FAQSection';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { Button, Badge, Modal } from '../components/ui/DesignSystem';

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
    <div id="pricing-wrapper" className="relative z-10 min-h-screen bg-bg-base text-text-primary overflow-x-hidden font-sans">
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-16 text-center relative">
        {/* Atmospheric ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,var(--tw-gradient-stops))] from-accent/10 to-transparent"
          aria-hidden="true"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative max-w-2xl mx-auto px-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated/70 border border-border-subtle mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-accent">
              Transparent Engineering Tiers
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-text-primary mb-4 leading-tight">
            Predictable limits for production engineering.
          </h1>
          <p className="text-[15px] text-text-secondary leading-relaxed tracking-tight">
            Start with deep architecture inspection at zero cost. Upgrade to Architect to keep multiple repositories continuously synchronized and indexed.
          </p>
        </motion.div>
      </section>

      {/* Pricing Grid */}
      <section className="px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6 justify-center items-stretch">
          {PLANS.map((plan, i) => {
            const isCurrent = isAuthenticated && currentPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                className="flex"
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
      <Modal
        isOpen={showConfirmModal}
        onClose={() => !upgrading && setShowConfirmModal(false)}
        title="Upgrade to Archon Architect"
        description="$7.99 / month — Instant entitlement activation"
        maxWidth="md"
        className="border-accent/30 shadow-2xl"
      >
        <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-4 text-[13px] text-text-secondary leading-relaxed mb-6">
          <div className="font-semibold text-text-primary mb-2">
            What activates immediately:
          </div>
          <ul className="pl-4.5 m-0 flex flex-col gap-1.5 list-disc">
            <li><strong className="text-text-primary">10 active codebases</strong> retained with full index state</li>
            <li><strong className="text-text-primary">2,000 files & 50 MB</strong> capacity per repository</li>
            <li><strong className="text-text-primary">500 monthly AI questions</strong> & 30 re-indexes</li>
            <li><strong className="text-text-primary">Deep Impact & Blast Radius</strong> change simulations</li>
            <li><strong className="text-text-primary">Priority indexing queue</strong> with accelerated AST generation</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={upgrading}
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={upgrading}
            isLoading={upgrading}
            onClick={confirmUpgrade}
          >
            {upgrading ? 'Activating...' : 'Activate Architect Plan ($7.99/mo)'}
          </Button>
        </div>
      </Modal>

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
      className={`relative flex flex-col w-full rounded-2xl p-7 sm:p-8 transition-all duration-200 ${
        plan.popular
          ? 'bg-surface-elevated/90 border-2 border-accent/40 shadow-xl hover:border-accent/60 hover:-translate-y-1'
          : 'bg-surface-subtle/60 border border-border-subtle hover:border-border-default hover:-translate-y-1'
      }`}
    >
      {/* Top accent line for Architect */}
      {plan.popular && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent rounded-t-2xl"
          aria-hidden="true"
        />
      )}

      {/* Badge area */}
      <div className="flex justify-between items-center min-h-[26px] mb-4">
        <Badge
          variant={plan.popular ? 'purple' : 'neutral'}
          className="uppercase text-[11px] font-bold tracking-wider px-3 py-1"
        >
          {plan.badge}
        </Badge>

        {isCurrent && (
          <Badge
            variant="success"
            className="text-[11px] font-bold px-2.5 py-0.5"
          >
            ✓ Active Tier
          </Badge>
        )}
      </div>

      {/* Title and Purpose */}
      <h3 className="text-xl font-heading font-extrabold text-text-primary mb-1 tracking-tight">
        {plan.name}
      </h3>
      <div className="text-xs text-accent font-medium mb-3.5 italic">
        "{plan.purpose}"
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-4xl sm:text-5xl font-extrabold text-text-primary tracking-tight leading-none">
          {plan.price}
        </span>
        <span className="text-sm text-text-muted">
          {plan.period}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-text-secondary mb-7 leading-relaxed min-h-[40px]">
        {plan.desc}
      </p>

      {/* CTA Button */}
      <Button
        variant={isButtonDisabled ? 'secondary' : plan.popular ? 'primary' : 'secondary'}
        size="lg"
        disabled={isButtonDisabled}
        onClick={onAction}
        className="w-full mb-8 font-semibold"
      >
        {buttonLabel}
      </Button>

      {/* Features List */}
      <div className="flex flex-col gap-2.5 flex-1">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-0.5">
          Included Capabilities:
        </div>
        <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
          {plan.features.map((feat) => (
            <li
              key={feat.text}
              className={`flex items-center gap-2.5 text-xs ${
                feat.included
                  ? feat.highlight
                    ? 'text-text-primary font-semibold'
                    : 'text-text-secondary font-normal'
                  : 'text-text-muted opacity-50'
              }`}
            >
              <span
                className={`w-4 h-4 flex items-center justify-center text-xs shrink-0 ${
                  feat.included ? 'text-status-success' : 'text-text-muted'
                }`}
                aria-hidden="true"
              >
                {feat.included ? '✓' : '—'}
              </span>
              <span>{feat.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
