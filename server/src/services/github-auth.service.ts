import jwt from 'jsonwebtoken';
import { env } from '../config';
import { AppError } from '../utils';
import type { GitHubUser, GitHubTokenResponse, JWTPayload, AuthUser } from '../types';

/**
 * GitHub Auth Service
 * 
 * Handles the full OAuth flow:
 * 1. Generate GitHub authorization URL
 * 2. Exchange auth code for access token
 * 3. Fetch user profile from GitHub
 * 4. Generate/verify JWTs for session management
 */

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

export class GitHubAuthService {

  /** Step 1: Build the GitHub consent screen URL */
  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${env.CLIENT_URL}/auth/callback`,
      scope: 'read:user user:email repo',
    });

    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  }

  /** Step 2: Exchange the temporary code for an access token */
  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!response.ok) {
      throw new AppError('Failed to exchange code for GitHub token', 401);
    }

    const data = (await response.json()) as GitHubTokenResponse;

    if (!data.access_token) {
      throw new AppError('GitHub did not return an access token. Code may be expired.', 401);
    }

    return data.access_token;
  }

  /** Step 3: Fetch the authenticated user's GitHub profile */
  async getGitHubUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new AppError('Failed to fetch GitHub user profile', 401);
    }

    return (await response.json()) as GitHubUser;
  }

  /** Step 4: Generate a JWT containing user info + GitHub token */
  generateJWT(user: GitHubUser, githubToken: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      login: user.login,
      avatarUrl: user.avatar_url,
      name: user.name,
      githubToken,
    };

    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
  }

  /** Verify and decode a JWT */
  verifyJWT(token: string): JWTPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  /** Map JWT payload to a safe user object (no sensitive data) */
  toAuthUser(payload: JWTPayload): AuthUser {
    return {
      id: payload.userId,
      login: payload.login,
      avatarUrl: payload.avatarUrl,
      name: payload.name,
      email: null,
      htmlUrl: `https://github.com/${payload.login}`,
    };
  }
}

export const githubAuthService = new GitHubAuthService();
