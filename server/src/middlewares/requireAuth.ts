import { Request, Response, NextFunction } from 'express';
import { githubAuthService } from '../services';
import { AppError } from '../utils';
import type { JWTPayload } from '../types';

/**
 * Extend Express Request to include authenticated user data.
 * This lets us do `req.user.login` in any protected route.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Auth middleware — protects routes that require login.
 * 
 * Usage:
 *   router.get('/protected', requireAuth, handler)
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please sign in with GitHub.', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = githubAuthService.verifyJWT(token);

    // Attach decoded user to request object
    req.user = payload;

    next();
  } catch (err) {
    next(err);
  }
}
