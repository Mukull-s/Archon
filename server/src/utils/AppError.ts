/**
 * Custom application error class.
 * 
 * This extends the native Error and adds:
 * - HTTP status code
 * - Operational flag (expected errors vs bugs)
 * 
 * Usage:
 *   throw new AppError('Repo not found', 404);
 *   throw new AppError('GitHub API rate limited', 429);
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    codeOrOperational: string | boolean = true,
    codeOrDetails?: string | Record<string, any>,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;

    if (typeof codeOrOperational === 'string') {
      this.isOperational = true;
      this.code = codeOrOperational;
      this.details = typeof codeOrDetails === 'object' ? codeOrDetails : details;
    } else {
      this.isOperational = codeOrOperational;
      this.code = typeof codeOrDetails === 'string' ? codeOrDetails : undefined;
      this.details = details;
    }

    // Preserve proper stack trace in V8 (Node.js)
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
