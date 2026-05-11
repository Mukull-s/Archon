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
  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const color = COLORS[level];

    if (env.NODE_ENV === 'production') {
      return JSON.stringify({ timestamp, level, message, ...meta });
    }

    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${color}${BOLD}[${level.toUpperCase()}]${RESET} ${color}${timestamp}${RESET} ${message}${metaStr}`;
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(this.formatMessage('error', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
