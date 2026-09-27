/**
 * AST-aware code chunking with hard size ceilings.
 *
 * The original chunker emitted one chunk per top-level symbol with no upper
 * bound, so a 2,000-line class became a single ~16k-character input. That both
 * degraded retrieval (one vector for an entire class) and blew Voyage's
 * 120k-token batch ceiling. This module keeps symbol boundaries where possible
 * and splits oversized symbols on line boundaries with a small overlap.
 *
 * Pure and dependency-free so it can be unit-tested without a database.
 */

export interface ChunkLimits {
  /** Maximum characters in a single chunk. */
  maxChars: number;
  /** Characters of overlap between adjacent sub-chunks of a split symbol. */
  overlapChars: number;
  /** Fragments smaller than this are merged into a neighbouring chunk. */
  minChars: number;
}

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
  symbolName: string;
}

export interface CodeSymbolLike {
  name: string;
  kind: 'function' | 'class';
  startLine: number;
  endLine: number;
}

export const DEFAULT_CHUNK_MAX_CHARS = 4_800;
export const DEFAULT_CHUNK_OVERLAP_CHARS = 500;
export const DEFAULT_CHUNK_MIN_CHARS = 200;
export const FALLBACK_LINES_PER_CHUNK = 60;

/** Fragments that may be merged into a neighbour when they are tiny. */
const MERGEABLE_FRAGMENTS = new Set(['imports/globals', 'trailing']);

function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readChunkLimitsFromEnv(): ChunkLimits {
  return {
    maxChars: readPositiveIntEnv('CHUNK_MAX_CHARS', DEFAULT_CHUNK_MAX_CHARS),
    overlapChars: readPositiveIntEnv('CHUNK_OVERLAP_CHARS', DEFAULT_CHUNK_OVERLAP_CHARS),
    minChars: readPositiveIntEnv('CHUNK_MIN_CHARS', DEFAULT_CHUNK_MIN_CHARS),
  };
}

/** Strips the `#i/n` suffix added when a chunk is split. */
function baseSymbolName(symbolName: string): string {
  return symbolName.replace(/#\d+\/\d+$/, '');
}

/**
 * Produces symbol-aligned chunks (or fixed-line fallback chunks) with no size
 * ceiling applied — mirrors the original behaviour for compatibility.
 */
function buildRawChunks(
  filePath: string,
  content: string,
  symbols: CodeSymbolLike[]
): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  // Fallback: If no AST symbols are found, chunk by line boundaries
  if (!symbols || symbols.length === 0) {
    const chunkSize = FALLBACK_LINES_PER_CHUNK;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const slice = lines.slice(i, i + chunkSize).join('\n');
      if (!slice.trim()) continue; // Skip empty/whitespace-only chunks
      chunks.push({
        content: slice,
        startLine: i + 1,
        endLine: Math.min(lines.length, i + chunkSize),
        symbolName: 'file-level'
      });
    }
    return chunks;
  }

  let lastLine = 0; // 0-indexed line index
  for (const sym of symbols) {
    const symStartIdx = sym.startLine - 1;
    const symEndIdx = sym.endLine; // exclusive

    // 1. Group any text before this symbol (e.g. imports, headers)
    if (symStartIdx > lastLine) {
      const headerText = lines.slice(lastLine, symStartIdx).join('\n');
      if (headerText.trim()) {
        chunks.push({
          content: headerText,
          startLine: lastLine + 1,
          endLine: symStartIdx,
          symbolName: 'imports/globals'
        });
      }
    }

    // 2. Group the symbol itself
    chunks.push({
      content: lines.slice(symStartIdx, symEndIdx).join('\n'),
      startLine: sym.startLine,
      endLine: sym.endLine,
      symbolName: `${sym.kind}:${sym.name}`
    });

    lastLine = symEndIdx;
  }

  // 3. Group any trailing text
  if (lastLine < lines.length) {
    const trailingText = lines.slice(lastLine).join('\n');
    if (trailingText.trim()) {
      chunks.push({
        content: trailingText,
        startLine: lastLine + 1,
        endLine: lines.length,
        symbolName: 'trailing'
      });
    }
  }

  return chunks;
}

/**
 * Expands lines that are individually longer than `maxChars` into multiple
 * pseudo-lines (all tagged with the same source line number) so a single
 * minified line cannot create an unsplittable oversized chunk.
 */
function expandLongLines(
  lines: string[],
  firstLineNumber: number,
  maxChars: number
): { text: string; line: number }[] {
  const units: { text: string; line: number }[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineNumber = firstLineNumber + idx;
    if (line.length <= maxChars) {
      units.push({ text: line, line: lineNumber });
      continue;
    }
    for (let i = 0; i < line.length; i += maxChars) {
      units.push({ text: line.slice(i, i + maxChars), line: lineNumber });
    }
  }
  return units;
}

/**
 * Splits a chunk larger than `maxChars` on line boundaries, keeping an overlap
 * of roughly `overlapChars` between adjacent sub-chunks and marking each with
 * `#i/n` for traceability.
 */
function splitOversizedChunk(chunk: CodeChunk, limits: ChunkLimits): CodeChunk[] {
  if (chunk.content.length <= limits.maxChars) return [chunk];

  const rawLines = chunk.content.split('\n');
  const units = expandLongLines(rawLines, chunk.startLine, limits.maxChars);
  if (units.length === 0) return [chunk];

  const segments: CodeChunk[] = [];
  let start = 0;
  while (start < units.length) {
    let chars = 0;
    let end = start;
    while (end < units.length) {
      const addition = units[end].text.length + (end > start ? 1 : 0); // +1 for '\n'
      if (end > start && chars + addition > limits.maxChars) break;
      chars += addition;
      end++;
    }

    segments.push({
      content: units.slice(start, end).map(u => u.text).join('\n'),
      startLine: units[start].line,
      endLine: units[end - 1].line,
      symbolName: chunk.symbolName
    });

    if (end >= units.length) break;

    // Compute an overlap window that walks backwards from the split point.
    let overlapStart = end;
    let overlapSize = 0;
    while (overlapStart > start && overlapSize < limits.overlapChars) {
      overlapStart--;
      overlapSize += units[overlapStart].text.length + 1;
    }
    // Always make forward progress, even when overlap would reach the start.
    start = Math.max(overlapStart, start + 1);
  }

  const total = segments.length;
  return segments.map((segment, index) => ({
    ...segment,
    symbolName: `${segment.symbolName}#${index + 1}/${total}`
  }));
}

/**
 * Merges tiny header/trailing fragments into a neighbour when the combined
 * chunk stays within the size ceiling.
 */
function mergeUndersizedChunks(chunks: CodeChunk[], limits: ChunkLimits): CodeChunk[] {
  const out = chunks.map(c => ({ ...c }));
  let i = 0;
  while (i < out.length) {
    const current = out[i];
    if (
      current.content.length >= limits.minChars ||
      !MERGEABLE_FRAGMENTS.has(baseSymbolName(current.symbolName)) ||
      out.length === 1
    ) {
      i++;
      continue;
    }

    const next = out[i + 1];
    if (next && current.content.length + next.content.length + 1 <= limits.maxChars) {
      next.content = `${current.content}\n${next.content}`;
      next.startLine = Math.min(current.startLine, next.startLine);
      out.splice(i, 1);
      continue;
    }

    const prev = out[i - 1];
    if (prev && prev.content.length + current.content.length + 1 <= limits.maxChars) {
      prev.content = `${prev.content}\n${current.content}`;
      prev.endLine = Math.max(prev.endLine, current.endLine);
      out.splice(i, 1);
      continue;
    }

    i++;
  }
  return out;
}

/**
 * Chunks a code file using AST symbols, enforcing size ceilings. Empty chunks
 * are dropped.
 */
export function chunkCodeFile(
  filePath: string,
  content: string,
  symbols: CodeSymbolLike[],
  limits: ChunkLimits = readChunkLimitsFromEnv()
): CodeChunk[] {
  const raw = buildRawChunks(filePath, content, symbols);
  const sized = raw.flatMap(chunk => splitOversizedChunk(chunk, limits));
  const merged = mergeUndersizedChunks(sized, limits);
  return merged.filter(chunk => chunk.content.trim().length > 0 && chunk.endLine >= chunk.startLine);
}
