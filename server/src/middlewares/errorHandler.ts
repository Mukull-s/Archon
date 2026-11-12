import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils';
import { logger } from '../utils';

/**
 * Global error handler middleware.
 * 
 * This is the LAST middleware in the chain. Every error thrown
 * or passed via next(err) ends up here. It returns a consistent
 * JSON error response and logs the error.
 * 
 * Industry pattern: Separate operational errors (user-facing)
 * from programming errors (bugs that should be investigated).
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default to 500 if no status code is set
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log the error
  if (isOperational) {
    logger.warn(`Operational Error: ${message}`, { statusCode });
  } else {
    // Programming errors — log full stack for debugging
    logger.error(`Unexpected Error: ${err.message}`, {
      stack: err.stack,
      statusCode,
    });
  }

  // Send consistent JSON response.
  //
  // The stack trace is deliberately NOT included, in any environment. This
  // response crosses a trust boundary — it is read by the browser — so shipping
  // `err.stack` would disclose absolute server paths, dependency versions and
  // internal call structure to anyone who can trigger an error (including an
  // unauthenticated one). The stack is already written to the server log above,
  // which is where it is useful and where it stays.
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(err instanceof AppError && err.code ? { code: err.code } : {}),
      ...(err instanceof AppError && err.details ? { details: err.details } : {}),
    },
  });
}

/**
 * 404 Not Found handler.
 * Catches any request that didn't match a route.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
