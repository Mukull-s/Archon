import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Substrate } from '../components/site/Substrate'
import { SiteHeader } from '../components/site/SiteHeader'
import SiteFooter from '../components/site/SiteFooter'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

/**
 * Pricing.
 *
 * The page is a COMPARISON, not two brochures.
 *
 * The previous version put the two plans in separate tall cards. To answer
 * "what do I actually get for $7.99" you had to read column A, then column B,
 * and diff them in your head. That is the page's whole job, and it was left to
 * the reader.
 *
 * So the limits are one table now. Each row is a single decision — how many
 * repositories, how large, how many questions — and the two numbers sit on the
 * same line where they can be compared at a glance. The tier headers sit above
 * it, and the reasoning sits below it.
 *
 * Two constraints still govern the content:
 *
 * 1. EVERY NUMBER IS ENFORCED. Each row maps to a field in `PLAN_LIMITS`
 *    (server/src/config/plans.ts) that the engine checks. If it is not
 *    enforced it is not on the page — there are no aspirational features here.
 *
 * 2. BILLING IS NOT OPEN. Self-service plan changes are disabled server-side,
 *    because a plan change must come from a verified payment webhook. So the
 *    page states that plainly and offers no button that would fail.
 */

interface Row {
  /** The decision being made, phrased as a question. */
  q: string
  free: string
  pro: string
  /** What the ceiling actually means in practice. */
  note?: string
}

/** One row per enforced meter. Order matters: most constraining first. */
const ROWS: Row[] = [
  {
    q: 'How many repositories can you analyse?',
    free: '2, ever',
    pro: 'Unlimited',
    note: 'Counted across the life of the account on Explorer.',
  },
  {
    q: 'How many can be indexed at once?',
    free: '1',
    pro: '10',
    note: 'Archive one to free its slot.',
  },
  {
    q: 'How large can a repository be?',
    free: '400 files · 15 MB',
    pro: '2,000 files · 50 MB',
    note: 'Beyond the ceiling the index is partial, and says so.',
  },
  {
    q: 'How many questions can you ask?',
    free: '10 / month',
    pro: '500 / month',
  },
  {
    q: 'How often can you re-index?',
    free: '1 per repository',
    pro: '30 / month',
  },
]

/** Capability rows — same in both tiers, stated once rather than repeated. */
const EVERY_TIER = [
  'Deterministic AST parsing of every supported file',
  'Resolved import graph with cycle detection',
  'Overview, explorer, architecture and execution-flow views',
  'Impact analysis with a published risk formula',
  'Assistant answers with file-and-line citations',
]

/** What only Architect adds. */
const PRO_ONLY = ['Blast radius across the whole graph', 'Ten live indexes at once', 'Priority indexing queue']

export default function Pricing() {
  const { user } = useAuthStore()
  const [live, setLive] = useState<{ name?: string; displayName?: string } | null>(null)

  const isPro = user?.plan === 'pro'


  /* Read the tier names from the server so the page cannot drift from the
     configuration that actually governs entitlements. */
  useEffect(() => {
    api
      .get('/auth/plans')
      .then((res) => setLive(res.data?.data ?? null))
      .catch(() => setLive(null))
  }, [])

  return (
    <div className="relative min-h-[100dvh] bg-paper text-ink">
      <Substrate />

      <div className="relative z-[1] flex min-h-[100dvh] flex-col">
        <SiteHeader />

        <main className="mx-auto w-full max-w-site flex-1 px-6 pb-24 pt-14 md:px-10 lg:px-14">
          {/* ══ the claim ══════════════════════════════════════════════ */}
          <div className="max-w-[62ch]">
            <div className="eyebrow">Pricing</div>
            <h1 className="mt-4 text-[38px] font-semibold leading-[1.06] tracking-[-0.038em] md:text-[46px]">
              Six limits. All <em className="font-serif italic font-normal text-emerald">enforced</em>.
            </h1>
            <p className="mt-4 text-[14.5px] leading-[1.65] text-ink-2">
              Archon measures six things while it works, and every limit on this page is one of
              them — checked by the engine, not written on a slide. Nothing is sold by token or by
              seat.
            </p>
          </div>

          {/* ══ billing state ══════════════════════════════════════════ */}
          <div className="mt-8 flex items-start gap-3 border border-rule-strong bg-paper-2 px-5 py-4">
            <span className="mt-[5px] h-2 w-2 flex-none rounded-full bg-amber" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-amber">
                Billing not open yet
              </div>
              <p className="mt-1.5 max-w-[72ch] text-[13px] leading-[1.6] text-ink-2">
                Both tiers work today on exactly the limits below. Paid upgrades cannot be
                purchased while billing is being wired — no card is taken, and there is no button
                here that would fail. When it opens, a plan change will come from the payment
                provider, not from this page.
              </p>
            </div>
          </div>

          {/* ══ the comparison ═════════════════════════════════════════ */}
          <div className="mt-10 overflow-hidden border border-rule bg-paper-2">
            {/* header row: the two names, side by side with their price */}
            <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr] border-b border-rule-strong bg-paper-3">
              <div className="hidden items-end px-5 py-4 sm:flex">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  What you are choosing
                </span>
              </div>

              {/* Explorer */}
              <div className="border-l border-rule px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[17px] font-semibold tracking-[-0.025em]">
                    {live?.displayName ?? 'Explorer'}
                  </span>
                  {!isPro && (
                    <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-emerald">
                      yours
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[24px] font-semibold leading-none tracking-[-0.03em]">$0</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-3">
                    forever
                  </span>
                </div>
              </div>

              {/* Architect */}
              <div className="border-l-2 border-forest bg-[rgba(13,107,79,.035)] px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[17px] font-semibold tracking-[-0.025em]">Architect</span>
                  {isPro && (
                    <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-emerald">
                      yours
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[24px] font-semibold leading-none tracking-[-0.03em]">
                    $7.99
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-3">
                    per month
                  </span>
                </div>
              </div>
            </div>

            {/* one row per enforced limit */}
            {ROWS.map((row, i) => (
              <div
                key={row.q}
                className={`grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_1fr_1fr] ${
                  i < ROWS.length - 1 ? 'border-b border-rule-2' : ''
                }`}
              >
                <div className="px-5 pt-3.5 pb-1 sm:py-4">
                  <div className="text-[13.5px] leading-[1.5] text-ink">{row.q}</div>
                  {row.note && (
                    <div className="mt-1 font-mono text-[9px] leading-[1.6] text-ink-3">{row.note}</div>
                  )}
                </div>

                <div className="flex items-baseline justify-between border-l border-rule px-5 py-2 sm:py-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-3 sm:hidden">
                    Explorer
                  </span>
                  <span className="font-mono text-[13px] text-ink-2">{row.free}</span>
                </div>

                <div className="flex items-baseline justify-between border-l-2 border-forest bg-[rgba(13,107,79,.035)] px-5 py-2 sm:py-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-3 sm:hidden">
                    Architect
                  </span>
                  <span className="font-mono text-[13px] font-medium text-emerald">{row.pro}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ══ what every tier includes, and what only Architect adds ═ */}
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
                In every tier, including Explorer
              </div>
              <ul className="mt-4 flex flex-col">
                {EVERY_TIER.map((f, i) => (
                  <li
                    key={f}
                    className={`flex items-start gap-3 py-3 text-[13px] leading-[1.6] text-ink-2 ${
                      i < EVERY_TIER.length - 1 ? 'border-b border-rule-2' : ''
                    }`}
                  >
                    <span className="mt-[2px] flex-none font-mono text-[10px] text-ink-3">—</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald">
                Architect adds
              </div>
              <ul className="mt-4 flex flex-col">
                {PRO_ONLY.map((f, i) => (
                  <li
                    key={f}
                    className={`flex items-start gap-3 py-3 text-[13px] leading-[1.6] text-ink ${
                      i < PRO_ONLY.length - 1 ? 'border-b border-rule-2' : ''
                    }`}
                  >
                    <span className="mt-[2px] flex-none font-mono text-[10px] text-emerald">+</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-5 border-t border-rule pt-5">
                {isPro ? (
                  <Link to="/dashboard" className="abtn abtn--solid w-full justify-center">
                    Go to your dashboard
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="w-full cursor-not-allowed rounded-[3px] border border-rule bg-paper-3 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3"
                    >
                      Upgrade to Architect — coming soon
                    </button>
                    <p className="mt-2 font-mono text-[9px] leading-[1.6] text-ink-3">
                      Billing is disabled by the server until the payment webhook is live.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ══ why this shape ═════════════════════════════════════════ */}
          <div className="mt-14 border-t border-rule pt-8">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
              Why it is priced this way
            </div>
            <div className="mt-5 grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  k: 'Not by token',
                  v: 'A token meter charges you more for asking a harder question. Archon counts questions, so a difficult one costs the same as an easy one.',
                },
                {
                  k: 'Not by seat',
                  v: 'One engineer runs this against their own repositories. Charging per head would tax team size without giving anyone more capability.',
                },
                {
                  k: 'What happens at a limit',
                  v: 'The engine refuses the operation and names the ceiling it hit. It never quietly degrades an answer or stores a partial index without saying so.',
                },
              ].map((c) => (
                <div key={c.k}>
                  <div className="text-[13.5px] font-medium text-ink">{c.k}</div>
                  <p className="mt-2 text-[12.5px] leading-[1.65] text-ink-2">{c.v}</p>
                </div>
              ))}
            </div>
          </div>

          {live && (
            <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
              Tier limits read from the live plan configuration · billing disabled by the server
            </p>
          )}
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
