import { env } from '../config';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const COLORS: Record<LogLevel, string> = {
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  debug: '\x1b[90m',  // gray
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Lightweight structured logger.
 * Uses colored console output in development, JSON in production.
 */
class Logger {
  /**
   * Normalise whatever the caller passed as `meta` into an object.
   *
   * Several call sites pass a bare string (`logger.error('...', err.message)`).
   * `JSON.stringify({...'some text'})` spreads the string's indices into a
   * meaningless object, and the message itself is then lost — so a production
   * failure logs as `{"error": undefined}` and tells you nothing. Coercing a
   * non-object into `{ detail }` keeps the text that was actually passed.
   */
  private normaliseMeta(meta?: unknown): Record<string, unknown> | undefined {
    if (meta == null) return undefined;
    if (typeof meta === 'object') return meta as Record<string, unknown>;
    return { detail: String(meta) };
  }

  private formatMessage(level: LogLevel, message: string, rawMeta?: unknown): string {
    const timestamp = new Date().toISOString();
    const color = COLORS[level];
    const meta = this.normaliseMeta(rawMeta);

    // Errors are the one thing you cannot afford to have JSON-stringify into
    // `{}` — it drops `message` and `stack`, which are the only useful parts.
    const safeMeta =
      meta && meta.error instanceof Error
        ? { ...meta, error: { message: meta.error.message, stack: meta.error.stack } }
        : meta;

    if (env.NODE_ENV === 'production') {
      return JSON.stringify({ timestamp, level, message, ...safeMeta });
    }

    const metaStr = safeMeta ? ` ${JSON.stringify(safeMeta)}` : '';
    return `${color}${BOLD}[${level.toUpperCase()}]${RESET} ${color}${timestamp}${RESET} ${message}${metaStr}`;
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown> | unknown) {
    console.error(this.formatMessage('error', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
