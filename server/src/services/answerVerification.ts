/**
 * Answer verification.
 *
 * Archon's promise is that an answer cites its sources. The prompt tells the
 * model to emit `[path/to/file.ts]` chips and not to contradict verified
 * structure — but a prompt is a request, not an enforcement. A model can still
 * name a file that does not exist, cite a path from a different repository, or
 * invent a plausible-looking import that the parser never resolved.
 *
 * This module is the enforcement half. It runs on the finished answer, compares
 * every path the answer claims against the real file list, and reports what to
 * do about it. It is deliberately conservative: it never rewrites a sentence,
 * because a rewritten sentence can silently change the claim. The answer text
 * is left exactly as the model wrote it, and a short notice is appended naming
 * the citations that could not be matched.
 *
 * ── what "verified" means here ───────────────────────────────────────────
 * A citation is verified when it appears in the repository's own file list.
 * That is the only thing this can check on its own. It does NOT prove the file
 * *supports* the claim — a real file cited for the wrong reason still passes,
 * and checking that needs the dependency graph and the chunk text, which this
 * module is not given.
 *
 * ── the two ways this can be wrong ───────────────────────────────────────
 * False negative: a real citation written in a form the extractor does not
 * recognise slips through unverified, and the answer gets no credit.
 * False positive: a code symbol is mistaken for a file and a correct answer is
 * flagged. Both were live problems during development; `looksLikePath` and
 * `extractCitedPaths` carry the reasoning for how each is handled. When
 * changing the matching rules, check both directions — a validator that cries
 * wolf is worse than none, because it teaches the reader to ignore it.
 */

export interface CitationReport {
  /** Paths the answer cited that exist in the repository. */
  verified: string[];
  /** Paths the answer cited that do not exist. These are fabrications. */
  fabricated: string[];
  /** True when the answer cited at least one file, all of them real. */
  clean: boolean;
  /**
   * True when the answer made a codebase claim but cited nothing at all.
   * Not necessarily wrong — a refusal legitimately has no citations — so the
   * caller decides whether to care.
   */
  uncited: boolean;
}

/**
 * Every `[some/path]` or `` `some/path` `` the answer presents as a file.
 *
 * Deliberately narrow. It looks for bracketed spans and inline code spans that
 * *look like a path* — they contain a `/` or a file extension — so ordinary
 * prose in square brackets is not mistaken for a citation.
 *
 * Order matters. The model frequently writes `` `[lib/express.js]` `` — the
 * bracketed chip wrapped in backticks for emphasis. Both passes would match it,
 * the backtick pass capturing the brackets as part of the path, and the
 * bracketed form then fails to match any real file. So the inner form is
 * unwrapped before it is compared, and duplicates collapse in the Set.
 */
export function extractCitedPaths(answer: string): string[] {
  const found = new Set<string>()

  const add = (raw: string) => {
    // Unwrap any wrapping brackets or backticks the model used for emphasis,
    // so `` `[a/b.ts]` `` and `[a/b.ts]` and `` `a/b.ts` `` all yield `a/b.ts`.
    let s = raw.trim()
    s = s.replace(/^\[+/, '').replace(/\]+$/, '')
    s = s.replace(/^`+/, '').replace(/`+$/, '')
    s = s.trim()
    if (looksLikePath(s)) found.add(clean(s))
  }

  // [path/to/file.ts] — with or without surrounding backticks
  for (const m of answer.matchAll(/`?\[([^\]\n]{2,200})\]/g)) {
    add(m[1])
  }

  // `path/to/file.ts` used inline
  for (const m of answer.matchAll(/`([^`\n]{2,200})`/g)) {
    add(m[1])
  }

  return [...found]
}

/**
 * Does this look like a file the answer is citing, rather than code or prose?
 *
 * The distinction matters more than it first appears. The model writes both
 *
 *   [lib/express.js]     a file — check it exists
 *   `req.res`            a property — do not check it
 *
 * and the naive test "contains a dot and letters" accepts both. Flagging
 * `req.res` as a fabricated file would put an alarming "1 unverified citation"
 * chip on a completely correct answer, which trains the reader to ignore the
 * chip — the opposite of the point. So the extension test is an allowlist of
 * real source extensions, not "any dotted token".
 */
const SOURCE_EXTENSIONS = new Set([
  // code
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'scala', 'swift',
  'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'cs', 'php', 'pl', 'pm', 'r', 'jl', 'dart', 'lua', 'ex', 'exs', 'erl', 'hs', 'clj',
  // markup / style / data / docs
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'astro',
  'json', 'yaml', 'yml', 'toml', 'ini', 'env', 'xml', 'md', 'mdx', 'txt', 'rst',
  'sql', 'graphql', 'gql', 'proto',
  // shell / config / misc
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'dockerfile', 'makefile', 'gradle', 'mk',
])

function looksLikePath(s: string): boolean {
  if (!s) return false
  // reject anything with whitespace — a path has none
  if (/\s/.test(s)) return false
  // reject urls and code fragments
  if (/^https?:/i.test(s)) return false
  if (s.includes('://')) return false
  // A trailing slash marks a directory — `lib/`, `src/services/`. Naming a
  // directory is a legitimate thing to do and is not a claim that a file
  // exists, so it is not a citation and must not be checked as one.
  if (s.endsWith('/')) return false
  // A separator is strong evidence of a path.
  if (s.includes('/')) return true
  // Otherwise it must end in a known source extension. `req.res` and
  // `app.handle` fail this; `utils.js` and `app.ts` pass.
  const ext = s.split('.').pop()?.toLowerCase() ?? ''
  if (s.includes('.') && SOURCE_EXTENSIONS.has(ext)) return true
  // Extensionless files are real — Dockerfile, Makefile, LICENSE, README.
  if (!s.includes('.') && /^(dockerfile|makefile|license|readme|changelog|procfile)$/i.test(s)) return true
  return false
}

/** Normalise a cited path so it can be compared against the file list. */
function clean(s: string): string {
  return s.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').trim()
}

/**
 * The set of paths a repository actually contains.
 *
 * Built from `scannedFiles` via the orchestrator rather than parsed out of the
 * file-tree string, so the comparison is against structured data.
 */
export function buildKnownPathSet(scannedFiles: Array<{ path: string }>): Set<string> {
  const set = new Set<string>()
  for (const f of scannedFiles) {
    const p = clean(f.path)
    set.add(p)
    // Also accept a bare filename match: an answer may legitimately say
    // `[express.js]` when the file is `lib/express.js` and the context made the
    // directory clear.
    const base = p.split('/').pop()
    if (base) set.add(base)
  }
  return set
}

/**
 * Compare what the answer cited against what the repository has.
 *
 * A path is accepted when either the full path or its final segment is known.
 * The bare-filename rule is a deliberate loosening: requiring absolute paths
 * would flag honest answers as fabrications, and the cost of accepting
 * `[index.js]` is low — the file exists somewhere in this repository, which is
 * the claim being checked.
 */
export function validateCitations(answer: string, knownPaths: Set<string>): CitationReport {
  const cited = extractCitedPaths(answer)
  const verified: string[] = []
  const fabricated: string[] = []

  for (const path of cited) {
    const base = path.split('/').pop() ?? path
    if (knownPaths.has(path) || knownPaths.has(base)) verified.push(path)
    else fabricated.push(path)
  }

  // A refusal has no citations by design and must not be treated as uncited.
  const isRefusal = detectRefusal(answer)

  return {
    verified,
    fabricated,
    clean: fabricated.length === 0,
    uncited: cited.length === 0 && !isRefusal,
  }
}

/**
 * Did the answer decline to answer?
 *
 * Used to stop a correct refusal being punished for having no citations, and to
 * stop it being flagged as an insufficient-context failure when it is in fact
 * the desired behaviour.
 */
export function detectRefusal(answer: string): boolean {
  const a = answer.toLowerCase()
  const markers = [
    'i could not find',
    "i couldn't find",
    'not present in the provided',
    'does not contain',
    'no relevant code',
    'cannot determine',
    "can't determine",
    'unable to determine',
    'not enough context',
    'insufficient context',
    'was not found in the repository',
    'no dependency exists between',
    'does not import',
    'not in the indexed file list',
  ]
  return markers.some((m) => a.includes(m))
}

/**
 * A short, factual note appended to an answer that cited files that do not
 * exist.
 *
 * The answer text itself is left exactly as the model wrote it — rewriting
 * prose risks changing the claim. Instead the reader is told, in the product's
 * own voice, that some of the citations could not be matched. That keeps the
 * interface honest without silently editing what the model said.
 */
export function fabricationNotice(fabricated: string[]): string {
  const shown = fabricated.slice(0, 5)
  const more = fabricated.length - shown.length
  const list = shown.map((p) => `\`${p}\``).join(', ') + (more > 0 ? ` and ${more} more` : '')
  return [
    '',
    '---',
    `**Unverified citation${fabricated.length === 1 ? '' : 's'}** — Archon could not match ${list} to any file in this repository.`,
    'Treat those references as unreliable; the rest of this answer is unaffected.',
  ].join('\n')
}
