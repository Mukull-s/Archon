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

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Preserve proper stack trace in V8 (Node.js)
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
