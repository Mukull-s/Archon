import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { AppError } from '../utils';

/** POST /api/auth/signup — Register user */
export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Please enter a valid email address format (e.g. user@example.com)', 400);
    }

    const result = await authService.signup({ email, password, name });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Verification code sent to your email. Please verify to continue.',
    });
  } catch (err) { next(err); }
}

/** POST /api/auth/login — Sign in user */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Please enter a valid email address format (e.g. user@example.com)', 400);
    }

    const result = await authService.login({ email, password });

    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

/** GET /api/auth/oauth/url?provider=github|google — Get OAuth URL */
export async function getOAuthUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const provider = req.query.provider as string;
    const csrfToken = (req.query.csrfToken as string) || '';

    let url: string;
    if (provider === 'github') {
      url = authService.getGitHubAuthUrl(csrfToken);
    } else if (provider === 'google') {
      url = authService.getGoogleAuthUrl(csrfToken);
    } else {
      throw new AppError('Invalid provider. Use "github" or "google".', 400);
    }

    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
}

/** POST /api/auth/oauth/callback — Handle OAuth code exchange */
export async function oauthCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider, code, mode, email, name } = req.body;

    if (!code || typeof code !== 'string') {
      throw new AppError('Authorization code is required', 400);
    }

    let result;
    if (provider === 'github') {
      result = await authService.handleGitHubCallback(code, mode);
    } else if (provider === 'google') {
      result = await authService.handleGoogleCallback(code, mode, email, name);
    } else {
      throw new AppError('Invalid provider. Use "github" or "google".', 400);
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

/** POST /api/auth/verify — Verify email with code */
export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      throw new AppError('Email and code are required', 400);
    }

    const result = await authService.verifyEmail(email, code);

    res.status(200).json({
      success: true,
      data: result,
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

/** PATCH /api/auth/profile — Update user name or avatarUrl */
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, avatarUrl } = req.body;
    const user = await authService.updateProfile(req.user!.userId, { name, avatarUrl });
    res.status(200).json({ success: true, data: { user }, message: 'Profile updated successfully' });
  } catch (err) { next(err); }
}

/** POST /api/auth/change-password — Update password */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
}
