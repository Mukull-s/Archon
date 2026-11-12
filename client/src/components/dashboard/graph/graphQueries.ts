/**
 * graphQueries — pure questions you can ask about a repository's import graph.
 *
 * These are the parts of the old `GraphEngine` worth keeping: the traversals
 * that answer *"how does this file relate to that one"*. They are here as plain
 * functions over the raw data rather than as a class that also built the graph,
 * because the graph is now built wherever it is drawn (`ModuleGraphCanvas`), and
 * a class that owns both construction and querying meant every caller paid for
 * the construction it did not need.
 *
 * Everything here is a read of `dependencyGraph` (path → the paths it imports)
 * plus `scannedFiles`. Nothing is inferred, scored, or guessed: if the graph
 * does not contain a relationship, these say so rather than producing a plausible
 * one.
 *
 * ── what deliberately did NOT come back ──────────────────────────────────
 * `semanticSearch` previously carried hardcoded keyword lists — `'auth'`,
 * `'login'`, `'payment'`, `'stripe'` — that boosted files whose path happened to
 * contain those words. That is one repository's vocabulary baked into a shared
 * utility, and it silently did nothing for any project outside that domain. The
 * replacement below matches on what actually identifies a file: its name, its
 * directory, and the symbols the parser found inside it.
 */

/** How a file's role is classified, from its path alone. */
export type NodeRole =
  | 'route'
  | 'controller'
  | 'service'
  | 'config'
  | 'component'
  | 'hook'
  | 'utility'
  | 'other'

/**
 * Classify a file by the conventions its path follows.
 *
 * This is a naming heuristic, not a parse. It is used only for presentation —
 * labelling a node, or deciding which stage of a request chain a file belongs
 * to — and never as evidence in an answer.
 */
export function classifyFile(filePath: string): NodeRole {
  const p = filePath.toLowerCase().replace(/\\/g, '/')
  if (p.includes('/routes/') || p.includes('.route.') || p.includes('/route/')) return 'route'
  if (p.includes('/controllers/') || p.includes('.controller.') || p.includes('/controller/')) return 'controller'
  if (p.includes('/services/') || p.includes('.service.') || p.includes('/service/')) return 'service'
  if (p.includes('config') || p.includes('schema') || p.includes('prisma') || p.includes('/db')) return 'config'
  if (p.includes('/components/') || p.includes('.component.')) return 'component'
  if (p.includes('/hooks/') || p.includes('.hook.')) return 'hook'
  if (p.includes('/utils/') || p.includes('/helpers/') || p.includes('.util.')) return 'utility'
  return 'other'
}

/** Files that `filePath` imports directly. */
export function getDependencies(
  dependencyGraph: Record<string, string[]>,
  filePath: string,
): string[] {
  const direct = dependencyGraph[filePath]
  return Array.isArray(direct) ? [...direct] : []
}

/**
 * Files that import `filePath` directly.
 *
 * A reverse index, so this is O(edges) rather than O(files × edges). Callers
 * that need it repeatedly should build the index once with
 * `buildReverseIndex` instead of calling this in a loop.
 */
export function getDependents(
  dependencyGraph: Record<string, string[]>,
  filePath: string,
): string[] {
  const out: string[] = []
  for (const [source, targets] of Object.entries(dependencyGraph)) {
    if (Array.isArray(targets) && targets.includes(filePath)) out.push(source)
  }
  return out
}

/**
 * A reusable reverse index: path → the paths that import it.
 *
 * Build this once per graph and pass it around; `getDependents` above is for
 * one-off lookups and would be quadratic if used to rank every file.
 */
export function buildReverseIndex(
  dependencyGraph: Record<string, string[]>,
): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const [source, targets] of Object.entries(dependencyGraph)) {
    if (!Array.isArray(targets)) continue
    for (const target of targets) {
      const existing = index.get(target)
      if (existing) existing.push(source)
      else index.set(target, [source])
    }
  }
  return index
}

/**
 * Everything reachable *downstream* of `filePath`, breadth-first, up to
 * `maxHops`.
 *
 * The return value excludes the starting file and is ordered by hop distance,
 * so callers can tell what is one step away from what is five.
 */
export function getDownstream(
  dependencyGraph: Record<string, string[]>,
  filePath: string,
  maxHops = Infinity,
): Array<{ path: string; hops: number }> {
  const seen = new Map<string, number>([[filePath, 0]])
  const result: Array<{ path: string; hops: number }> = []
  let frontier = [filePath]

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop++) {
    const next: string[] = []
    for (const current of frontier) {
      for (const target of getDependencies(dependencyGraph, current)) {
        if (seen.has(target)) continue
        seen.set(target, hop)
        result.push({ path: target, hops: hop })
        next.push(target)
      }
    }
    frontier = next
  }

  return result
}

/**
 * Everything that reaches `filePath` — the reverse of `getDownstream`.
 *
 * This is the "what breaks if I change this" direction, so it is bounded by
 * `maxHops` and returns hop distance for the same reason.
 */
export function getUpstream(
  dependencyGraph: Record<string, string[]>,
  filePath: string,
  maxHops = Infinity,
): Array<{ path: string; hops: number }> {
  const reverse = buildReverseIndex(dependencyGraph)
  const seen = new Map<string, number>([[filePath, 0]])
  const result: Array<{ path: string; hops: number }> = []
  let frontier = [filePath]

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop++) {
    const next: string[] = []
    for (const current of frontier) {
      for (const source of reverse.get(current) ?? []) {
        if (seen.has(source)) continue
        seen.set(source, hop)
        result.push({ path: source, hops: hop })
        next.push(source)
      }
    }
    frontier = next
  }

  return result
}

/**
 * The shortest import chain from an entry point to `filePath`.
 *
 * Returns the full path inclusive of both ends, or an empty array when no entry
 * point can reach the file. An empty result is a real finding — it means the
 * file is not reachable by following imports from any declared entry — so
 * callers should say that rather than fall back to showing the file alone.
 *
 * Breadth-first, so the first chain found is the shortest one.
 */
export function getJourneyFromEntry(
  dependencyGraph: Record<string, string[]>,
  filePath: string,
  entryPoints: string[],
): string[] {
  if (entryPoints.includes(filePath)) return [filePath]

  const visited = new Set<string>()
  const queue: Array<{ node: string; path: string[] }> = entryPoints.map((ep) => ({
    node: ep,
    path: [ep],
  }))

  while (queue.length > 0) {
    const current = queue.shift() as { node: string; path: string[] }
    if (current.node === filePath) return current.path
    if (visited.has(current.node)) continue
    visited.add(current.node)

    for (const target of getDependencies(dependencyGraph, current.node)) {
      if (!visited.has(target)) {
        queue.push({ node: target, path: [...current.path, target] })
      }
    }
  }

  return []
}

/**
 * Rank files by how many other files import them.
 *
 * The count is read from the graph, not estimated. `importedBy` is included so
 * a caller can show *who* — the number alone invites the reader to guess.
 */
export function rankByInboundCount(
  dependencyGraph: Record<string, string[]>,
  scannedFiles: Array<{ path: string }>,
): Array<{ path: string; count: number; importedBy: string[] }> {
  const reverse = buildReverseIndex(dependencyGraph)
  const known = new Set(scannedFiles.map((f) => f.path))

  return scannedFiles
    .map((f) => {
      const importers = (reverse.get(f.path) ?? []).filter((s) => known.has(s))
      return { path: f.path, count: importers.length, importedBy: importers }
    })
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
}

/**
 * Find files matching a query by name, directory, or the symbols inside them.
 *
 * Scores are ranked, not calibrated: they order results, they are not a
 * probability. Matching is case-insensitive, and symbol matches come from the
 * parser's own function/class lists rather than from reading file contents.
 *
 * There is no keyword table. If a project calls its authentication module
 * `gatekeeper/`, searching "auth" will not find it — which is correct, because
 * guessing would also match a file called `author.ts`.
 */
export interface SearchCandidate {
  path: string
  score: number
  /** Why this file matched, for showing the user. */
  matchedOn: 'name' | 'directory' | 'symbol'
  /** The symbol that matched, when `matchedOn` is `symbol`. */
  symbol?: string
}

export function searchFiles(
  query: string,
  scannedFiles: Array<{ path: string }>,
  astMetadata: Record<string, { functions?: string[]; classes?: string[]; exports?: string[] }> = {},
  limit = 20,
): SearchCandidate[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  const results: SearchCandidate[] = []

  for (const file of scannedFiles) {
    const path = file.path
    const lower = path.toLowerCase().replace(/\\/g, '/')
    const name = lower.split('/').pop() ?? lower

    let best: SearchCandidate | null = null

    // filename: exact beats prefix beats substring
    if (name === q) best = { path, score: 100, matchedOn: 'name' }
    else if (name.startsWith(q)) best = { path, score: 60, matchedOn: 'name' }
    else if (name.includes(q)) best = { path, score: 40, matchedOn: 'name' }

    // directory segment
    if (!best && lower.includes(`/${q}/`)) {
      best = { path, score: 25, matchedOn: 'directory' }
    }

    // declared symbols
    if (!best) {
      const ast = astMetadata[path]
      if (ast) {
        const names = [...(ast.functions ?? []), ...(ast.classes ?? []), ...(ast.exports ?? [])]
        const hit = names.find((s) => s.toLowerCase().includes(q))
        if (hit) best = { path, score: 35, matchedOn: 'symbol', symbol: hit }
      }
    }

    if (best) results.push(best)
  }

  return results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit)
}
