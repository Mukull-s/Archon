

export interface TokenBatchOptions {
  /** Maximum estimated tokens allowed in a single request. */
  maxTokensPerRequest: number;
  /** Maximum number of inputs allowed in a single request. */
  maxInputsPerRequest: number;
  /** Inputs longer than this are clamped before batching (defense in depth). */
  maxCharsPerInput: number;
}


 
export function estimateTokens(text: string): number {
  return Math.ceil((text ? text.length : 0) / 4);
}


export const DEFAULT_MAX_TOKENS_PER_REQUEST = 90_000;
export const DEFAULT_MAX_INPUTS_PER_REQUEST = 96;
export const DEFAULT_MAX_CHARS_PER_INPUT = 6_000;

export function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readBatchOptionsFromEnv(): TokenBatchOptions {
  return {
    maxTokensPerRequest: readPositiveIntEnv(
      'EMBEDDING_MAX_TOKENS_PER_REQUEST',
      DEFAULT_MAX_TOKENS_PER_REQUEST
    ),
    maxInputsPerRequest: readPositiveIntEnv(
      'EMBEDDING_MAX_INPUTS',
      DEFAULT_MAX_INPUTS_PER_REQUEST
    ),
    maxCharsPerInput: readPositiveIntEnv(
      'EMBEDDING_MAX_CHARS_PER_INPUT',
      DEFAULT_MAX_CHARS_PER_INPUT
    ),
  };
}


export function clampInputChars(
  text: string,
  maxChars: number
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}


export function buildTokenAwareBatches(
  texts: string[],
  options: TokenBatchOptions
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokens = estimateTokens(text);
    const wouldExceedTokens =
      current.length > 0 && currentTokens + tokens > options.maxTokensPerRequest;
    const wouldExceedInputs = current.length >= options.maxInputsPerRequest;

    if (wouldExceedTokens || wouldExceedInputs) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(text);
    currentTokens += tokens;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

export interface EmbeddingErrorInfo {
  statusCode?: number;
  isRateLimit: boolean;
  /** Provider rejected the request because the batch was too large. */
  isTooLarge: boolean;
  /** Whether a retry could plausibly succeed. */
  retryable: boolean;
  reason: 'rate_limit' | 'batch_too_large' | 'invalid_request' | 'transient';
}

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}


export function classifyEmbeddingError(err: any): EmbeddingErrorInfo {
  // The Voyage SDK surfaces `statusCode`/`body`; axios-style errors use
  // `response.status`/`response.data`. Support both.
  const statusCode: number | undefined =
    err?.statusCode ?? err?.status ?? err?.response?.status;
  const body = safeStringify(err?.body ?? err?.response?.data ?? err?.data);
  const message = typeof err?.message === 'string' ? err.message : '';
  const combined = `${message} ${body}`.toLowerCase();

  const isRateLimit = statusCode === 429 || combined.includes('429') || combined.includes('rate limit');
  const isTooLarge =
    combined.includes('too_many_tokens_in_batch') ||
    combined.includes('too many tokens') ||
    combined.includes('batch has') ||
    combined.includes('invalid_request');
  const isClientError = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
  const isServerError = typeof statusCode === 'number' && statusCode >= 500;

  const retryable = isRateLimit || isServerError || (!isClientError && !isTooLarge);

  let reason: EmbeddingErrorInfo['reason'] = 'transient';
  if (isRateLimit) reason = 'rate_limit';
  else if (isTooLarge) reason = 'batch_too_large';
  else if (isClientError) reason = 'invalid_request';

  return { statusCode, isRateLimit, isTooLarge, retryable, reason };
}
