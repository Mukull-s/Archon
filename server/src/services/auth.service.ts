import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env, prisma } from '../config';
import { AppError, encryptToken, getPlaintextToken } from '../utils';
import { emailService } from './email.service';
import type { AuthUser, JWTPayload, GitHubProfile, GoogleProfile, SignupInput, LoginInput } from '../types';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USER_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export class AuthService {
  // Lazily-computed bcrypt hash used only to equalize login timing for
  // non-existent / OAuth-only accounts. Never matches any real password.
  private dummyHashPromise: Promise<string> | null = null;

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
    }
    return this.dummyHashPromise;
  }

  // ─────────────────────────────────────────────
  // EMAIL / PASSWORD
  // ─────────────────────────────────────────────

  async signup(input: SignupInput): Promise<{ user: AuthUser; token: string }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    // Password strength check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^.()_+={}[\]|\\:;"'<>,?/~`-])[A-Za-z\d@$!%*?&#^.()_+={}[\]|\\:;"'<>,?/~`-]{8,}$/;
    if (!passwordRegex.test(input.password)) {
      throw new AppError('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.', 400);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        provider: 'email',
        emailVerified: true,
        verifyToken: null,
      },
    });

    const token = this.generateJWT(user.id, user.email, 'email');
    return { user: this.toAuthUser(user), token };
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; token: string }> {
    // Normalized failure: unknown email, OAuth-only account, and wrong password
    // all return the SAME 401 + message. Returning 404 for an unknown email is a
    // user-enumeration oracle, and naming the provider leaks account existence.
    const INVALID = 'Invalid email or password';
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !user.passwordHash) {
      // Equalize response time with the real bcrypt path so timing does not
      // reveal whether the account exists.
      await bcrypt.compare(input.password, await this.getDummyHash()).catch(() => {});
      throw new AppError(INVALID, 401);
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(INVALID, 401);
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
  // OAUTH STATE (CSRF) — signed, time-limited
  // ─────────────────────────────────────────────

  private oauthStateSecret(): string {
    return env.OAUTH_STATE_SECRET || env.JWT_SECRET;
  }

  private signStatePayload(payload: string): string {
    return crypto.createHmac('sha256', this.oauthStateSecret()).update(payload).digest('hex');
  }

  /**
   * Builds `${provider}:${nonce}:${issuedAt}:${hmac}`.
   * `nonce` carries the client's CSRF token so the SPA can additionally bind the
   * state to its own session (defense in depth). The HMAC makes the state
   * unforgeable and the timestamp bounds its lifetime.
   */
  createOAuthState(provider: string, nonce?: string): string {
    const n = nonce && nonce.trim() ? nonce.trim() : crypto.randomBytes(16).toString('hex');
    const issuedAt = Date.now().toString();
    const payload = `${provider}:${n}:${issuedAt}`;
    return `${payload}:${this.signStatePayload(payload)}`;
  }

  /**
   * Verifies a state returned by the OAuth provider. Throws 403 on any problem:
   * missing, malformed, bad signature, expired, or wrong provider.
   */
  verifyOAuthState(
    state: unknown,
    expectedProvider?: string,
    ttlMs: number = env.OAUTH_STATE_TTL_MS
  ): { provider: string; nonce: string } {
    if (!state || typeof state !== 'string') {
      throw new AppError('Missing OAuth state parameter', 403, 'OAUTH_STATE_INVALID');
    }
    const parts = state.split(':');
    if (parts.length !== 4) {
      throw new AppError('Malformed OAuth state parameter', 403, 'OAUTH_STATE_INVALID');
    }
    const [provider, nonce, issuedAt, signature] = parts;
    if (!provider || !nonce || !issuedAt || !signature) {
      throw new AppError('Malformed OAuth state parameter', 403, 'OAUTH_STATE_INVALID');
    }

    const expected = this.signStatePayload(`${provider}:${nonce}:${issuedAt}`);
    const provided = Buffer.from(signature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');
    if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) {
      throw new AppError('Invalid OAuth state signature', 403, 'OAUTH_STATE_INVALID');
    }

    const issuedAtMs = parseInt(issuedAt, 10);
    if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > ttlMs) {
      throw new AppError('Expired OAuth state parameter', 403, 'OAUTH_STATE_EXPIRED');
    }

    if (expectedProvider && provider !== expectedProvider) {
      throw new AppError('OAuth state provider mismatch', 403, 'OAUTH_STATE_INVALID');
    }

    return { provider, nonce };
  }

  // ─────────────────────────────────────────────
  // GITHUB OAUTH
  // ─────────────────────────────────────────────

  getGitHubAuthUrl(csrfToken?: string): string {
    const state = this.createOAuthState('github', csrfToken);
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${env.CLIENT_URL}/auth/callback`,
      // Least privilege: read the user's profile + verified email only.
      // Public repo ingestion needs no elevated scope; private repos would
      // require an explicit, disclosed opt-in (not granted by default).
      scope: 'read:user user:email',
      prompt: 'login',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGitHubCallback(code: string, mode: string = 'login'): Promise<{ user: AuthUser; token: string }> {
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new AppError('The email associated with this GitHub account is invalid or missing', 400);
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Link GitHub to existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          githubToken: encryptToken(tokenData.access_token),
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
          githubToken: encryptToken(tokenData.access_token),
          githubLogin: profile.login,
        },
      });
    }

    const token = this.generateJWT(user.id, user.email, 'github');
    return { user: this.toAuthUser(user), token };
  }

  // ─────────────────────────────────────────────
  // GOOGLE OAUTH
  // ─────────────────────────────────────────────

  getGoogleAuthUrl(csrfToken?: string): string {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError('Google OAuth is not configured on this server.', 501);
    }
    const state = this.createOAuthState('google', csrfToken);
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.CLIENT_URL}/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string, mode: string = 'login', email?: string, name?: string): Promise<{ user: AuthUser; token: string }> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError('Google OAuth is not configured on this server.', 501);
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${env.CLIENT_URL}/auth/callback`,
      }).toString(),
    });

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new AppError('Google authentication failed. Please try again.', 401);
    }

    const profileRes = await fetch(GOOGLE_USER_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as GoogleProfile;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!profile.email || !emailRegex.test(profile.email)) {
      throw new AppError('The email associated with this Google account is invalid or missing', 400);
    }

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

  generateJWT(userId: string, email: string, provider: string): string {
    const payload: JWTPayload = { userId, email, provider };
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

  /**
   * Retrieves and decrypts the stored GitHub token for a user.
   * Handles both encrypted and legacy plaintext tokens.
   */
  async getDecryptedGithubToken(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubToken: true },
    });
    return getPlaintextToken(user?.githubToken);
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }): Promise<AuthUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      },
    });
    return this.toAuthUser(user);
  }

  async changePassword(userId: string, currentPassword?: string, newPassword?: string): Promise<void> {
    if (!newPassword) {
      throw new AppError('New password is required', 400);
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.provider !== 'email') {
      throw new AppError('Password updates are only allowed for email/password accounts', 400);
    }

    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(currentPassword || '', user.passwordHash);
      if (!isMatch) {
        throw new AppError('Incorrect current password', 400);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private toAuthUser(user: {
    id: string; email: string; name: string | null; avatarUrl: string | null;
    provider: string; emailVerified: boolean; githubLogin: string | null;
    plan?: string | null;
    createdAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      emailVerified: user.emailVerified,
      githubLogin: user.githubLogin,
      plan: user.plan === 'pro' ? 'pro' : 'free',
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
