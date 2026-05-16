import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { AppError } from '../utils';

/** POST /api/auth/signup — Email + password signup */
export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new AppError('Email, password, and name are required', 400);
    }
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const result = await authService.signup({ email, password, name });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Account created. Please check your email to verify.',
    });
  } catch (err) { next(err); }
}

/** POST /api/auth/login — Email + password login */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const result = await authService.login({ email, password });

    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

/** GET /api/auth/oauth/url?provider=github|google — Get OAuth URL */
export async function getOAuthUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const provider = req.query.provider as string;

    let url: string;
    if (provider === 'github') {
      url = authService.getGitHubAuthUrl();
    } else if (provider === 'google') {
      url = authService.getGoogleAuthUrl();
    } else {
      throw new AppError('Invalid provider. Use "github" or "google".', 400);
    }

    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
}

/** POST /api/auth/oauth/callback — Handle OAuth code exchange */
export async function oauthCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider, code } = req.body;

    if (!code || typeof code !== 'string') {
      throw new AppError('Authorization code is required', 400);
    }

    let result;
    if (provider === 'github') {
      result = await authService.handleGitHubCallback(code);
    } else if (provider === 'google') {
      result = await authService.handleGoogleCallback(code);
    } else {
      throw new AppError('Invalid provider. Use "github" or "google".', 400);
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

/** GET /api/auth/verify/:token — Verify email */
export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params.token as string;
    const user = await authService.verifyEmail(token);

    res.status(200).json({
      success: true,
      data: { user },
      message: 'Email verified successfully!',
    });
  } catch (err) { next(err); }
}

/** GET /api/auth/me — Get current user (protected) */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUserById(req.user!.userId);
    if (!user) throw new AppError('User not found', 404);

    res.status(200).json({ success: true, data: { user } });
  } catch (err) { next(err); }
}

/** POST /api/auth/logout — Stateless logout */
export async function logout(_req: Request, res: Response) {
  res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
}
