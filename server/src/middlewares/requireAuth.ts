import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { AppError } from '../utils';
import type { JWTPayload } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please sign in.', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyJWT(token);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}
