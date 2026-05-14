import { Request, Response, NextFunction } from 'express';
import { githubAuthService } from '../services';
import { AppError } from '../utils';
import { env } from '../config';

/**
 * Auth Controller
 * Handles HTTP layer for GitHub OAuth — delegates logic to the service.
 */

/** GET /api/auth/github — Redirect user to GitHub consent screen */
export async function githubLogin(_req: Request, res: Response) {
  const url = githubAuthService.getAuthorizationUrl();
  res.json({ success: true, data: { url } });
}

/** POST /api/auth/github/callback — Exchange code for token, return JWT */
export async function githubCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      throw new AppError('Authorization code is required', 400);
    }

    // Exchange code → GitHub access token
    const githubToken = await githubAuthService.exchangeCodeForToken(code);

    // Fetch user profile from GitHub
    const githubUser = await githubAuthService.getGitHubUser(githubToken);

    // Generate our JWT (contains user info + their GitHub token for API calls)
    const jwt = githubAuthService.generateJWT(githubUser, githubToken);

    // Return JWT + user info to frontend
    res.status(200).json({
      success: true,
      data: {
        token: jwt,
        user: {
          id: githubUser.id,
          login: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          name: githubUser.name,
          email: githubUser.email,
          htmlUrl: githubUser.html_url,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me — Get current authenticated user */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    const payload = githubAuthService.verifyJWT(token);
    const user = githubAuthService.toAuthUser(payload);

    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/logout — Placeholder (JWT is stateless, frontend clears token) */
export async function logout(_req: Request, res: Response) {
  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
}

/** Extract Bearer token from Authorization header */
function extractToken(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No authentication token provided', 401);
  }

  return authHeader.split(' ')[1];
}
