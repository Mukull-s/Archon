import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils';
import { logger } from '../utils';
import { env } from '../config';

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

  // Send consistent JSON response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      // Only include stack trace in development
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
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
