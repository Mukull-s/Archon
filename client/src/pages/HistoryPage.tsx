import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Substrate } from '../components/site/Substrate'
import { SiteHeader } from '../components/site/SiteHeader'
import SiteFooter from '../components/site/SiteFooter'
import api from '../lib/api'

/**
 * Repository hub.
 *
 * The page after sign-in: every codebase you have indexed, what state each is
 * in, and the four things you can do to one (open, re-index, archive, remove).
 *
 * Everything shown is read from `GET /repos`. The four numbers across the top
 * are computed from that same response, so they can never disagree with the
 * table below them — and when you have no repositories the page says so
 * instead of showing four zeroes.
 */

interface RepoSummary {
  id: string
  name: string
  owner: string | null
  isLocal: boolean
  framework: string | null
  languages: string[]
  fileCount: number
  totalSize: number
  confidence: number
  indexingStatus: string
  isArchived?: boolean
  reindexCount?: number
  createdAt: string
}

type FilterType = 'all' | 'github' | 'local' | 'high-confidence'

/** Map the engine's status strings onto something a person reads. */
function statusMeta(status: string): { label: string; cls: string } {
  switch (status) {
    case 'completed':
      return { label: 'Indexed', cls: 'st st--ok' }
    case 'indexing':
      return { label: 'Indexing', cls: 'st st--live' }
    case 'structural-ready':
      return { label: 'Embedding', cls: 'st st--live' }
    case 'failed':
      return { label: 'Failed', cls: 'st st--risk' }
    default:
      return { label: status || 'Unknown', cls: 'st st--idle' }
  }
}

/** Confidence as a band, so the number carries a judgement with it. */
function confidenceBand(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'High', cls: 'text-emerald' }
  if (score >= 60) return { label: 'Moderate', cls: 'text-amber' }
  if (score > 0) return { label: 'Partial', cls: 'text-sig' }
  return { label: '—', cls: 'text-ink-3' }
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Relative time for anything recent, an explicit date past a week.
 *
 * Two deliberate choices:
 *  - `en-GB` rather than the browser default, so the format is the same for
 *    every reader. `toLocaleDateString(undefined, …)` renders `Nov 3, 2026`
 *    on a US machine and `3 Nov 2026` on a UK one, which makes screenshots and
 *    support conversations disagree about what the app showed.
 *  - "6d ago" rather than a date for the last week, because "when did I index
 *    this" is a relative question most of the time.
 */
function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [repos, setRepos] = useState<RepoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  const [repoToDelete, setRepoToDelete] = useState<RepoSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  /** False once the component unmounts, so late fetches stop setting state. */
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])


  const fetchRepos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/repos')
      if (!aliveRef.current) return
      setRepos(data.data || [])
    } catch (err: unknown) {
      if (!aliveRef.current) return
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not reach the repository registry.'
      setError(msg)
      toast.error(msg)
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred a tick so the fetch (and its `setLoading`) lands after the first
    // paint rather than forcing a second synchronous render during mount.
    const t = setTimeout(fetchRepos, 0)
    return () => clearTimeout(t)
  }, [fetchRepos])

  const handleDelete = async () => {
    if (!repoToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      await api.delete(`/repos/${repoToDelete.id}`)
      toast.success(`Removed ${repoToDelete.owner ? `${repoToDelete.owner}/` : ''}${repoToDelete.name}.`)
      setRepos((prev) => prev.filter((r) => r.id !== repoToDelete.id))
      setRepoToDelete(null)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not remove that repository.'
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleArchive = async (repo: RepoSummary) => {
    if (busyId) return
    setBusyId(repo.id)
    try {
      await api.post(`/repos/${repo.id}/archive`)
      toast.success(`Archived. One active slot freed.`)
      await fetchRepos()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not archive that repository.'
      toast.error(msg)
    } finally {
      setBusyId(null)
    }
  }

  const handleUnarchive = async (repo: RepoSummary) => {
    if (busyId) return
    setBusyId(repo.id)
    try {
      await api.post(`/repos/${repo.id}/unarchive`)
      toast.success('Reactivated.')
      await fetchRepos()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Active limit reached. Archive another repository first.'
      toast.error(msg)
    } finally {
      setBusyId(null)
    }
  }

  /* All four header figures come from the same array the table renders, so the
     summary and the list can never disagree. */
  const telemetry = useMemo(() => {
    const active = repos.filter((r) => !r.isArchived)
    const archived = repos.filter((r) => r.isArchived)
    const withConfidence = repos.filter((r) => r.confidence > 0)
    return {
      activeCount: active.length,
      archivedCount: archived.length,
      totalFiles: repos.reduce((sum, r) => sum + (r.fileCount || 0), 0),
      totalSize: formatSize(repos.reduce((sum, r) => sum + (r.totalSize || 0), 0)),
      avgConfidence:
        withConfidence.length > 0
          ? Math.round(withConfidence.reduce((s, r) => s + r.confidence, 0) / withConfidence.length)
          : 0,
    }
  }, [repos])

  const filteredRepos = useMemo(() => {
    return repos.filter((r) => {
      const q = searchQuery.toLowerCase().trim()
      if (q) {
        const hay = [r.name, r.owner ?? '', r.framework ?? '', ...(r.languages ?? [])]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (activeFilter === 'github') return !r.isLocal
      if (activeFilter === 'local') return r.isLocal
      if (activeFilter === 'high-confidence') return r.confidence >= 80
      return true
    })
  }, [repos, searchQuery, activeFilter])

  const FILTERS: Array<{ id: FilterType; label: string; count: number }> = [
    { id: 'all', label: 'All', count: repos.length },
    { id: 'github', label: 'From GitHub', count: repos.filter((r) => !r.isLocal).length },
    { id: 'local', label: 'Local archives', count: repos.filter((r) => r.isLocal).length },
    { id: 'high-confidence', label: 'High confidence', count: repos.filter((r) => r.confidence >= 80).length },
  ]

  const repoLabel = (r: RepoSummary) => (r.owner ? `${r.owner}/${r.name}` : r.name)

  return (
    <div className="relative min-h-[100dvh] bg-paper text-ink">
      <Substrate />
      <div className="relative z-[1]">
        <SiteHeader />

        <main className="mx-auto w-full max-w-site px-6 pb-24 pt-14 md:px-10 lg:px-14">
          {/* ── header ───────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[62ch]">
              <div className="eyebrow">Repositories</div>
              <h1 className="mt-4 text-[38px] font-semibold leading-[1.06] tracking-[-0.038em] md:text-[44px]">
                Every codebase you have <em className="font-serif italic font-normal text-emerald">indexed</em>.
              </h1>
              <p className="mt-4 text-[14.5px] leading-[1.65] text-ink-2">
                Open one to explore it, re-index it after it moves, or archive it to free an active
                slot. Removing is permanent and takes the index with it.
              </p>
            </div>
            <button type="button" onClick={() => navigate('/')} className="abtn abtn--solid">
              Index a repository
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {/* ── summary ──────────────────────────────────────────────────── */}
          {!loading && !error && repos.length > 0 && (
            <div className="kmetrics mt-9">
              <div className="kmetric">
                <div className="k">Active</div>
                <div className="v">
                  {telemetry.activeCount}
                  <small>of {repos.length}</small>
                </div>
                <div className="sub">
                  {telemetry.archivedCount > 0
                    ? `${telemetry.archivedCount} archived`
                    : 'nothing archived'}
                </div>
              </div>
              <div className="kmetric">
                <div className="k">Files across all</div>
                <div className="v">{telemetry.totalFiles.toLocaleString()}</div>
                <div className="sub">parsed into syntax trees</div>
              </div>
              <div className="kmetric">
                <div className="k">Total index size</div>
                <div className="v">{telemetry.totalSize}</div>
                <div className="sub">stored repository data</div>
              </div>
              <div className="kmetric">
                <div className="k">Mean confidence</div>
                <div className="v">
                  {repos.some((r) => r.confidence > 0) ? telemetry.avgConfidence : '—'}
                  {repos.some((r) => r.confidence > 0) && <small>/ 100</small>}
                </div>
                <div className="sub">deterministic score</div>
              </div>
            </div>
          )}

          {/* ── controls ─────────────────────────────────────────────────── */}
          {!loading && !error && repos.length > 0 && (
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 border border-rule-strong bg-paper-2 px-3 py-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-ink-3" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name, owner, language or framework"
                  className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[11.5px] text-ink outline-none placeholder:text-ink-3"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="flex-none font-mono text-[10px] text-ink-3 hover:text-ink"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id)}
                    className={`rounded-[3px] border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] transition-colors ${
                      activeFilter === f.id
                        ? 'border-forest bg-forest text-[#f0f6f2]'
                        : 'border-rule-strong bg-paper-2 text-ink-2 hover:border-ink-3 hover:text-ink'
                    }`}
                  >
                    {f.label}
                    <span className="ml-1.5 opacity-60">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── the list ─────────────────────────────────────────────────── */}
          <div className="mt-6">
            {loading ? (
              <div className="panel">
                <div className="panel__head">
                  <div className="t">Reading registry</div>
                </div>
                <div className="flex flex-col">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-5 border-b border-rule-2 px-4 py-4 last:border-b-0">
                      <span className="h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-rule-strong" />
                      <span className="h-2.5 w-40 animate-pulse-dot rounded-full bg-rule-2" />
                      <span className="h-2.5 w-24 animate-pulse-dot rounded-full bg-rule-2" />
                      <span className="ml-auto h-2.5 w-16 animate-pulse-dot rounded-full bg-rule-2" />
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="panel mx-auto max-w-[560px]">
                <div className="panel__head">
                  <div className="t">Registry unavailable</div>
                </div>
                <div className="panel__body">
                  <p className="text-[13px] leading-[1.65] text-ink-2">{error}</p>
                  <button type="button" onClick={fetchRepos} className="abtn abtn--ghost mt-4">
                    Try again
                  </button>
                </div>
              </div>
            ) : repos.length === 0 ? (
              /* Empty state: says what to do, not just that there is nothing. */
              <div className="panel">
                <div className="panel__body flex flex-col items-start gap-4 px-8 py-12">
                  <div className="eyebrow">Nothing indexed yet</div>
                  <h2 className="max-w-[42ch] text-[22px] font-semibold leading-[1.2] tracking-[-0.03em]">
                    Paste a public GitHub URL and Archon will read every file in it.
                  </h2>
                  <p className="max-w-[56ch] text-[13.5px] leading-[1.65] text-ink-2">
                    Parsing, graph resolution and embedding run in the background. The repository
                    appears here the moment the index completes — you can watch the five stages on
                    the analyse page.
                  </p>
                  <button type="button" onClick={() => navigate('/')} className="abtn abtn--solid mt-1">
                    Index your first repository
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="panel">
                <div className="panel__body flex items-center justify-between gap-4">
                  <p className="font-mono text-[11px] text-ink-2">
                    No repository matches that filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setActiveFilter('all')
                    }}
                    className="abtn abtn--ghost !py-1.5"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel">
                {/* column headers — hidden on small screens */}
                <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_0.8fr_0.9fr_auto] gap-5 border-b border-rule bg-paper-3 px-4 py-2.5 md:grid">
                  {['Repository', 'Indexed state', 'Files', 'Size', ''].map((h, i) => (
                    <span
                      key={h + i}
                      className={`font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3 ${
                        i >= 2 && i <= 3 ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {filteredRepos.map((repo) => {
                  const status = statusMeta(repo.indexingStatus)
                  const conf = confidenceBand(repo.confidence)
                  const busy = busyId === repo.id

                  return (
                    <div
                      key={repo.id}
                      className="grid grid-cols-1 items-center gap-4 border-b border-rule-2 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-paper-3 md:grid-cols-[minmax(0,2.2fr)_1fr_0.8fr_0.9fr_auto] md:gap-5"
                    >
                      {/* identity */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="grid h-5 w-5 flex-none place-items-center rounded-[2px] border border-rule bg-paper-3 font-mono text-[7px] font-bold uppercase text-ink-2"
                            aria-hidden="true"
                          >
                            {repo.isLocal ? 'zip' : 'gh'}
                          </span>
                          <span className="truncate font-mono text-[12px] font-medium text-ink">
                            {repoLabel(repo)}
                          </span>
                          {repo.isArchived && (
                            <span className="flex-none font-mono text-[8.5px] uppercase tracking-[0.13em] text-ink-3">
                              archived
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 font-mono text-[9.5px] text-ink-3">
                          {repo.framework && <span>{repo.framework}</span>}
                          {Array.isArray(repo.languages) && repo.languages.length > 0 && (
                            <span>{repo.languages.join(' · ')}</span>
                          )}
                          <span>{formatRelativeTime(repo.createdAt)}</span>
                        </div>
                      </div>

                      {/* state + confidence */}
                      <div className="flex items-center gap-3">
                        <span className={status.cls}>
                          <i />
                          {status.label}
                        </span>
                        {repo.confidence > 0 && (
                          <span className={`font-mono text-[11px] ${conf.cls}`}>
                            {repo.confidence}
                          </span>
                        )}
                      </div>

                      {/* files */}
                      <div className="font-mono text-[11px] text-ink-2 md:text-right">
                        {repo.fileCount ? repo.fileCount.toLocaleString() : '—'}
                      </div>

                      {/* size */}
                      <div className="font-mono text-[11px] text-ink-2 md:text-right">
                        {formatSize(repo.totalSize)}
                      </div>

                      {/* actions */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/${repo.id}`)}
                          className="rounded-[3px] border-[1.5px] border-forest bg-forest px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#f0f6f2] transition-colors hover:border-[#0c2a23] hover:bg-[#0c2a23]"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => (repo.isArchived ? handleUnarchive(repo) : handleArchive(repo))}
                          className="rounded-[3px] border border-rule-strong px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink disabled:opacity-40"
                        >
                          {busy ? '…' : repo.isArchived ? 'Activate' : 'Archive'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepoToDelete(repo)}
                          className="rounded-[3px] border border-rule-strong px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:border-sig hover:text-sig"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div className="border-t border-rule bg-paper-3 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                  Showing {filteredRepos.length} of {repos.length}
                </div>
              </div>
            )}
          </div>

          {/* ── what each action does ────────────────────────────────────── */}
          {!loading && !error && repos.length > 0 && (
            <div className="mt-8 grid grid-cols-1 gap-6 border-t border-rule pt-7 md:grid-cols-3">
              {[
                { k: 'Archive', v: 'Keeps the index on disk but frees its active slot, so another repository can be indexed at your plan limit.' },
                { k: 'Remove', v: 'Deletes the repository, its parsed syntax trees and its vector index. This cannot be undone.' },
                { k: 'Confidence', v: 'The share of the codebase the engine could resolve from syntax and imports. A low score means it read less, not that it guessed more.' },
              ].map((c) => (
                <div key={c.k}>
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">{c.k}</div>
                  <p className="mt-2 text-[12.5px] leading-[1.65] text-ink-2">{c.v}</p>
                </div>
              ))}
            </div>
          )}
        </main>

        <SiteFooter />
      </div>

      {/* ── remove confirmation ──────────────────────────────────────────────
          A destructive action gets a real gate, and the gate names the thing it
          is about to destroy rather than asking a generic "are you sure". */}
      {repoToDelete && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(21,22,26,.42)] px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-title"
        >
          <div className="w-full max-w-[440px] border border-ink bg-paper-2 shadow-dossier">
            <div className="border-b border-rule px-5 py-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-sig">
                Permanent
              </div>
            </div>
            <div className="px-5 py-5">
              <h2 id="remove-title" className="text-[17px] font-semibold tracking-[-0.02em]">
                Remove {repoLabel(repoToDelete)}?
              </h2>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-ink-2">
                Its parsed syntax trees, dependency graph and vector index are deleted with it.
                You would need to index the repository again from scratch.
              </p>

              <div className="mt-5 rounded-[3px] border border-rule bg-paper-3 px-3.5 py-3 font-mono text-[10.5px] text-ink-2">
                <div className="flex justify-between py-0.5">
                  <span className="text-ink-3">Files indexed</span>
                  <span>{repoToDelete.fileCount?.toLocaleString() ?? '—'}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-ink-3">Index size</span>
                  <span>{formatSize(repoToDelete.totalSize)}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRepoToDelete(null)}
                  disabled={isDeleting}
                  className="abtn abtn--ghost"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="abtn !border-sig !bg-sig !text-[#fff4f2] hover:!bg-[#c53a24]"
                >
                  {isDeleting ? 'Removing…' : 'Remove permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
