import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env, prisma } from '../config';
import { AppError } from '../utils';
import { emailService } from './email.service';
import type { AuthUser, JWTPayload, GitHubProfile, GoogleProfile, SignupInput, LoginInput } from '../types';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USER_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export class AuthService {

  // ─────────────────────────────────────────────
  // EMAIL / PASSWORD
  // ─────────────────────────────────────────────

  async signup(input: SignupInput): Promise<{ user: AuthUser; message: string }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    // 6-digit verification code
    const verifyToken = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        provider: 'email',
        emailVerified: false,
        verifyToken,
      },
    });

    console.log(`\n==============================================`);
    console.log(`[AUTH] Verification code for ${input.email}: ${verifyToken}`);
    console.log(`==============================================\n`);

    // Send verification email (non-blocking)
    emailService.sendVerificationEmail(input.email, input.name, verifyToken);

    // In development, show the code directly in the frontend toast notification
    // since Resend free tier won't send to unverified emails
    const message = env.NODE_ENV === 'development'
      ? `DEV MODE: Your code is ${verifyToken}`
      : 'Verification code sent to your email.';

    return { user: this.toAuthUser(user), message };
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; token: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.passwordHash) {
      throw new AppError(
        `This account uses ${user.provider} login. Please sign in with ${user.provider}.`,
        401
      );
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = this.generateJWT(user.id, user.email, 'email');
    return { user: this.toAuthUser(user), token };
  }

  async verifyEmail(email: string, code: string): Promise<{ user: AuthUser; token: string }> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.verifyToken !== code) {
      throw new AppError('Invalid or expired verification code', 400);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null },
    });

    const token = this.generateJWT(updated.id, updated.email, 'email');
    return { user: this.toAuthUser(updated), token };
  }

  // ─────────────────────────────────────────────
  // GITHUB OAUTH
  // ─────────────────────────────────────────────

  getGitHubAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${env.CLIENT_URL}/auth/callback`,
      scope: 'read:user user:email repo',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGitHubCallback(code: string): Promise<{ user: AuthUser; token: string }> {
    // Exchange code for token
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new AppError('GitHub authentication failed. Please try again.', 401);
    }

    // Fetch profile
    const profileRes = await fetch(GITHUB_USER_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github.v3+json' },
    });
    const profile = await profileRes.json() as GitHubProfile;

    // Fetch email if not public
    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github.v3+json' },
      });
      const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find(e => e.primary && e.verified);
      email = primary?.email || emails[0]?.email || `${profile.login}@github.noreply.com`;
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Link GitHub to existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          githubToken: tokenData.access_token,
          githubLogin: profile.login,
          avatarUrl: user.avatarUrl || profile.avatar_url,
          name: user.name || profile.name,
          emailVerified: true,
          ...(user.provider === 'email' ? {} : { provider: 'github', providerId: String(profile.id) }),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: profile.name || profile.login,
          avatarUrl: profile.avatar_url,
          provider: 'github',
          providerId: String(profile.id),
          emailVerified: true,
          githubToken: tokenData.access_token,
          githubLogin: profile.login,
        },
      });
    }

    const token = this.generateJWT(user.id, user.email, 'github', tokenData.access_token);
    return { user: this.toAuthUser(user), token };
  }

  // ─────────────────────────────────────────────
  // GOOGLE OAUTH
  // ─────────────────────────────────────────────

  getGoogleAuthUrl(): string {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError('Google OAuth is not configured yet', 501);
    }
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.CLIENT_URL}/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string): Promise<{ user: AuthUser; token: string }> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError('Google OAuth is not configured', 501);
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${env.CLIENT_URL}/auth/callback`,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new AppError('Google authentication failed. Please try again.', 401);
    }

    const profileRes = await fetch(GOOGLE_USER_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as GoogleProfile;

    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: user.avatarUrl || profile.picture,
          name: user.name || profile.name,
          emailVerified: true,
          ...(user.provider === 'email' ? {} : { provider: 'google', providerId: profile.sub }),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
          provider: 'google',
          providerId: profile.sub,
          emailVerified: true,
        },
      });
    }

    const token = this.generateJWT(user.id, user.email, 'google');
    return { user: this.toAuthUser(user), token };
  }

  // ─────────────────────────────────────────────
  // JWT & HELPERS
  // ─────────────────────────────────────────────

  generateJWT(userId: string, email: string, provider: string, githubToken?: string): string {
    const payload: JWTPayload = { userId, email, provider, ...(githubToken && { githubToken }) };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
  }

  verifyJWT(token: string): JWTPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.toAuthUser(user) : null;
  }

  private toAuthUser(user: {
    id: string; email: string; name: string | null; avatarUrl: string | null;
    provider: string; emailVerified: boolean; githubLogin: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      emailVerified: user.emailVerified,
      githubLogin: user.githubLogin,
    };
  }
}

export const authService = new AuthService();
