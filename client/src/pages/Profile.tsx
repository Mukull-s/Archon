import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Substrate } from '../components/site/Substrate'
import { SiteHeader } from '../components/site/SiteHeader'
import SiteFooter from '../components/site/SiteFooter'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

/**
 * Account.
 *
 * Organised by what someone came here to do, not by which endpoint the data
 * came from. There are three jobs on this page and they are in order:
 *
 *   1. Am I near a limit?      → the capacity meters
 *   2. Change something about me → display name, password
 *   3. Where is my work?        → the repositories, linked out
 *
 * No tabs. Tabs hide two thirds of a page this short and make the reader click
 * to find out whether the thing they want is even here. Everything is on one
 * scroll instead, separated by rules, with the headings numbered so the order
 * is legible from the top.
 *
 * ── what is deliberately absent ──────────────────────────────────────────
 * The old settings page offered "default branch", "auto re-index on push" and
 * "telemetry". The server has no fields for any of them — `PATCH /auth/profile`
 * accepts a name and an avatar URL and nothing else — so they were written to
 * localStorage and read by nothing. A control that does nothing is worse than
 * a control that is missing, so they are gone, and the third section says why.
 */

interface UsageLimits {
  displayName?: string
  name?: string
  lifetimeAnalyses?: number
  maxActiveCodebases?: number
  maxFilesPerRepo?: number
  maxRepoSizeBytes?: number
  monthlyAiQuestions?: number
  monthlyReindexes?: number
}
interface UsageCounters {
  lifetimeAnalysesUsed?: number
  activeCodebases?: number
  monthlyAiQuestionsUsed?: number
  monthlyReindexesUsed?: number
}
interface UsageData {
  plan?: string
  limits?: UsageLimits
  usage?: UsageCounters
}
interface RepoRow {
  id: string
  name: string
  owner: string | null
  isLocal: boolean
  fileCount: number
  confidence: number
  indexingStatus: string
  isArchived?: boolean
}

/** `2,000` and `15 MB` — one place, so the page never mixes formats. */
function formatCount(n: number | undefined): string {
  return n == null ? '—' : n.toLocaleString()
}
function formatMb(bytes: number | undefined): string {
  if (bytes == null) return '—'
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

/**
 * One capacity meter.
 *
 * The bar only appears when there is a ceiling to be near. On Architect,
 * analyses are unlimited — drawing a full bar for "unlimited" would read as
 * "you are at the limit", which is the opposite of what it means.
 */
function Meter({
  label,
  used,
  limit,
  unit,
  note,
}: {
  label: string
  used: number | undefined
  limit: number | undefined
  unit?: string
  note?: string
}) {
  const known = used != null && limit != null
  const unlimited = known && (limit as number) > 100000
  const pct = known && !unlimited ? Math.min(100, Math.round(((used as number) / Math.max(1, limit as number)) * 100)) : 0
  const atLimit = known && !unlimited && (used as number) >= (limit as number)
  const nearLimit = known && !unlimited && pct >= 80 && !atLimit

  const tone = atLimit ? 'text-sig' : nearLimit ? 'text-amber' : 'text-ink'

  return (
    <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[minmax(0,1.4fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <div className="text-[13.5px] text-ink">{label}</div>
        {note && <div className="mt-0.5 font-mono text-[9px] leading-[1.6] text-ink-3">{note}</div>}
      </div>

      <div className="sm:min-w-[220px]">
        {!known ? (
          <div className="text-right font-mono text-[12px] text-ink-3">—</div>
        ) : unlimited ? (
          <div className="text-right font-mono text-[12px] text-emerald">no ceiling</div>
        ) : (
          <>
            <div className="flex items-baseline justify-end gap-1.5">
              <span className={`font-mono text-[13px] tabular-nums ${tone}`}>{used}</span>
              <span className="font-mono text-[11px] text-ink-3">
                / {limit}
                {unit ? ` ${unit}` : ''}
              </span>
            </div>
            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-rule">
              <div
                className={`h-full rounded-full ${atLimit ? 'bg-sig' : nearLimit ? 'bg-amber' : 'bg-emerald'}`}
                style={{ width: `${used === 0 ? 0 : Math.max(pct, 3)}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [usage, setUsage] = useState<UsageData | null>(null)
  const [repos, setRepos] = useState<RepoRow[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  /** False once the component unmounts, so late fetches stop setting state. */
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])


  const load = useCallback(async () => {
    setLoading(true)
    const [u, r] = await Promise.allSettled([api.get('/auth/usage'), api.get('/repos')])
    // The component may have unmounted while those two requests were in flight
    // (the user navigated away), in which case setting state is a no-op that
    // React warns about. Bail out instead.
    if (!aliveRef.current) return
    if (u.status === 'fulfilled') setUsage(u.value.data?.data ?? null)
    if (r.status === 'fulfilled') setRepos(r.value.data?.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Deferred a tick so the fetch (and its `setLoading`) lands after the first
    // paint rather than forcing a second synchronous render during mount.
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('A display name cannot be empty.')
      return
    }
    if (trimmed === (user?.name ?? '')) return
    setSavingName(true)
    try {
      await api.patch('/auth/profile', { name: trimmed })
      toast.success('Name updated.')
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not save that name.',
      )
    } finally {
      setSavingName(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('The two new passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Use at least 8 characters.')
      return
    }
    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      toast.success('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not change the password.',
      )
    } finally {
      setSavingPassword(false)
    }
  }

  const limits = usage?.limits
  const used = usage?.usage
  const isPro = usage?.plan === 'pro' || user?.plan === 'pro'
  const provider = user?.provider || 'email'
  const isEmailAccount = provider === 'email'

  const activeRepos = useMemo(() => repos.filter((r) => !r.isArchived), [repos])
  const totalFiles = useMemo(() => repos.reduce((s, r) => s + (r.fileCount || 0), 0), [repos])
  const initial = (user?.name || user?.email || 'A').charAt(0).toUpperCase()

  const passwordMismatch = Boolean(confirmPassword) && confirmPassword !== newPassword
  const canSavePassword =
    isEmailAccount && !savingPassword && currentPassword.length > 0 && newPassword.length > 0 && !passwordMismatch

  return (
    <div className="relative min-h-[100dvh] bg-paper text-ink">
      <Substrate />

      <div className="relative z-[1] flex min-h-[100dvh] flex-col">
        <SiteHeader />

        <main className="mx-auto w-full max-w-site flex-1 px-6 pb-24 pt-14 md:px-10 lg:px-14">
          {/* ══ who this is ═════════════════════════════════════════════ */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-5 border-b border-rule-strong pb-8">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-20 w-20 flex-none rounded-full object-cover" />
            ) : (
              <span className="grid h-20 w-20 flex-none place-items-center rounded-full bg-forest text-[26px] font-semibold text-[#f0f6f2]">
                {initial}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.036em]">
                {user?.name || 'Your account'}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="truncate font-mono text-[11.5px] text-ink-2">{user?.email}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                  signed in with {provider}
                </span>
                <span className={isPro ? 'st st--ok' : 'st st--idle'}>
                  <i />
                  {limits?.displayName ?? (isPro ? 'Architect' : 'Explorer')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/history" className="abtn abtn--ghost">
                Your repositories
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="abtn abtn--ghost"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* ══ 01 · capacity ═══════════════════════════════════════════ */}
          <section className="mt-11" aria-labelledby="s-capacity">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] text-ink-3">01</span>
                <h2 id="s-capacity" className="text-[19px] font-semibold tracking-[-0.028em]">
                  What you have used
                </h2>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                {loading ? 'reading…' : `against your ${limits?.displayName ?? 'plan'} limits`}
              </span>
            </div>

            <div className="mt-5 divide-y divide-rule-2 border-y border-rule">
              <Meter
                label="Codebase analyses"
                used={used?.lifetimeAnalysesUsed}
                limit={limits?.lifetimeAnalyses}
                note="Counted across the life of the account, not monthly."
              />
              <Meter
                label="Active codebases"
                used={used?.activeCodebases}
                limit={limits?.maxActiveCodebases}
                note="Archive one to free its slot."
              />
              <Meter
                label="AI questions this month"
                used={used?.monthlyAiQuestionsUsed}
                limit={limits?.monthlyAiQuestions}
                unit="questions"
              />
              <Meter
                label="Re-indexes this month"
                used={used?.monthlyReindexesUsed}
                limit={limits?.monthlyReindexes}
                unit="re-indexes"
              />
            </div>

            {/* per-repository ceilings: stated, not metered, because they apply
                to each repository rather than accumulating */}
            <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-3">
              <div>
                <div className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3">
                  Files per repository
                </div>
                <div className="mt-1 font-mono text-[13px] text-ink">{formatCount(limits?.maxFilesPerRepo)}</div>
              </div>
              <div>
                <div className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3">
                  Repository size
                </div>
                <div className="mt-1 font-mono text-[13px] text-ink">{formatMb(limits?.maxRepoSizeBytes)}</div>
              </div>
              <div>
                <div className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3">
                  When a ceiling is hit
                </div>
                <div className="mt-1 font-mono text-[13px] text-ink-3">
                  refused, and named
                </div>
              </div>
            </div>

            {!isPro && (
              <div className="mt-6 flex flex-wrap items-center gap-4 border border-rule bg-paper-2 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] text-ink">Architect raises every one of these.</div>
                  <p className="mt-1 font-mono text-[9px] leading-[1.6] text-ink-3">
                    Billing is not open yet. Plan changes will come from the payment provider, not
                    from this page.
                  </p>
                </div>
                <Link to="/pricing" className="abtn abtn--ghost flex-none">
                  See the limits
                </Link>
              </div>
            )}
          </section>

          {/* ══ 02 · what you can change ════════════════════════════════ */}
          <section className="mt-14" aria-labelledby="s-details">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] text-ink-3">02</span>
              <h2 id="s-details" className="text-[19px] font-semibold tracking-[-0.028em]">
                Your details
              </h2>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
              {/* name */}
              <form onSubmit={saveName}>
                <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  Display name
                </div>
                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-ink-2">
                  Shown in the header and beside your repositories. Anything you like.
                </p>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  aria-label="Display name"
                  className="mt-3 w-full border border-rule-strong bg-paper-2 px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-emerald"
                />

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingName || !name.trim() || name.trim() === (user?.name ?? '')}
                    className="abtn abtn--solid disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {savingName ? 'Saving…' : 'Save'}
                  </button>
                  {name.trim() !== (user?.name ?? '') && !savingName && (
                    <button
                      type="button"
                      onClick={() => setName(user?.name ?? '')}
                      className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink-3 transition-colors hover:text-ink"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </form>

              {/* email — read-only, and says why */}
              <div>
                <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  Email
                </div>
                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-ink-2">
                  Your sign-in identity. It cannot be changed here.
                </p>
                <div
                  className="mt-3 flex items-center gap-3 border border-rule bg-paper-3 px-3 py-2.5"
                  aria-describedby="email-why"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-2">
                    {user?.email}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="flex-none text-ink-3"
                    aria-hidden="true"
                  >
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </div>
                <p id="email-why" className="mt-2 font-mono text-[9px] leading-[1.6] text-ink-3">
                  Changing it would break the link between this account and its repositories.
                </p>
              </div>
            </div>

            {/* password — its own row, because it is a different kind of change */}
            <div className="mt-11 border-t border-rule pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  Password
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-3">
                  {isEmailAccount ? 'email account' : `managed by ${provider}`}
                </span>
              </div>

              {!isEmailAccount ? (
                <p className="mt-3 max-w-[62ch] text-[13px] leading-[1.65] text-ink-2">
                  This account signs in with <span className="font-mono text-ink">{provider}</span>,
                  so there is no password stored here. Change your credentials with that provider.
                </p>
              ) : (
                <form onSubmit={savePassword} className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="pw-current"
                      className="mb-1.5 block font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3"
                    >
                      Current
                    </label>
                    <input
                      id="pw-current"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full border border-rule-strong bg-paper-2 px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-emerald"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pw-new"
                      className="mb-1.5 block font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3"
                    >
                      New
                    </label>
                    <input
                      id="pw-new"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full border border-rule-strong bg-paper-2 px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-emerald"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pw-confirm"
                      className="mb-1.5 block font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3"
                    >
                      Repeat new
                    </label>
                    <input
                      id="pw-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={passwordMismatch || undefined}
                      aria-describedby="pw-rules"
                      className={`w-full border bg-paper-2 px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-emerald ${
                        passwordMismatch ? 'border-sig' : 'border-rule-strong'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3">
                    <p id="pw-rules" className="font-mono text-[9px] leading-[1.6] text-ink-3">
                      {passwordMismatch
                        ? 'The two new passwords do not match yet.'
                        : 'At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.'}
                    </p>
                    <button
                      type="submit"
                      disabled={!canSavePassword}
                      className="abtn abtn--solid flex-none disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {savingPassword ? 'Changing…' : 'Change password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* ══ 03 · your work ══════════════════════════════════════════ */}
          <section className="mt-14" aria-labelledby="s-work">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] text-ink-3">03</span>
                <h2 id="s-work" className="text-[19px] font-semibold tracking-[-0.028em]">
                  What you have indexed
                </h2>
              </div>
              {!loading && repos.length > 0 && (
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                  {activeRepos.length} active · {repos.length - activeRepos.length} archived ·{' '}
                  {totalFiles.toLocaleString()} files
                </span>
              )}
            </div>

            {loading ? (
              <div className="mt-5 border-y border-rule py-5 font-mono text-[10.5px] text-ink-3">
                Reading registry…
              </div>
            ) : repos.length === 0 ? (
              <div className="mt-5 border border-rule bg-paper-2 px-6 py-8">
                <p className="max-w-[52ch] text-[13.5px] leading-[1.65] text-ink-2">
                  Nothing indexed yet. Paste a repository URL and Archon will read every file in
                  it — it appears here the moment the index completes.
                </p>
                <Link to="/" className="abtn abtn--solid mt-4">
                  Index a repository
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : (
              <div className="mt-5 border-y border-rule">
                {repos.slice(0, 6).map((r) => (
                  <Link
                    key={r.id}
                    to={`/dashboard/${r.id}`}
                    className="group flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-rule-2 py-3.5 transition-colors last:border-b-0 hover:bg-paper-3"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink group-hover:text-emerald">
                      {r.owner ? `${r.owner}/${r.name}` : r.name}
                    </span>
                    {r.isArchived && (
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.13em] text-ink-3">
                        archived
                      </span>
                    )}
                    <span className="font-mono text-[10.5px] text-ink-3">
                      {r.fileCount?.toLocaleString() ?? '—'} files
                    </span>
                    <span className="w-14 text-right font-mono text-[10.5px] text-ink-3">
                      {r.confidence > 0 ? `${r.confidence}/100` : '—'}
                    </span>
                    <span
                      className="font-mono text-[10px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </Link>
                ))}

                <Link
                  to="/history"
                  className="block w-full py-3 font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-3 transition-colors hover:text-ink"
                >
                  {repos.length > 6
                    ? `All ${repos.length} repositories in the hub →`
                    : 'Open the repository hub →'}
                </Link>
              </div>
            )}
          </section>

          {/* ══ what is not here, and why ══════════════════════════════ */}
          <section className="mt-14 border-t border-rule pt-8" aria-labelledby="s-absent">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] text-ink-3">04</span>
              <h2 id="s-absent" className="text-[19px] font-semibold tracking-[-0.028em]">
                Not here yet
              </h2>
            </div>
            <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.6] text-ink-2">
              Three settings existed before and have been removed rather than restyled, because
              none of them did anything.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-3">
              {[
                {
                  k: 'Default branch',
                  v: 'Archon indexes the branch it is given rather than picking one, so there is nothing to choose.',
                },
                {
                  k: 'Auto re-index on push',
                  v: 'The server does not accept a webhook yet. Re-indexing runs when you ask for it.',
                },
                {
                  k: 'Telemetry',
                  v: 'No usage data leaves your instance. There is no switch because there is nothing to switch off.',
                },
              ].map((c) => (
                <div key={c.k}>
                  <div className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3">
                    {c.k}
                  </div>
                  <p className="mt-2 text-[12.5px] leading-[1.65] text-ink-2">{c.v}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
