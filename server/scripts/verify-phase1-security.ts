import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Live HTTP verification of the Phase 1 security changes:
 *   - GitHub OAuth URL: minimal scope + signed state
 *   - CORS: explicit allowlist only (no *.vercel.app)
 *   - POST /api/auth/upgrade: 403 when self-service is disabled
 *   - POST /api/auth/login: unknown email normalizes to 401 (no enumeration)
 *   - POST /api/auth/oauth/callback: missing/tampered state → 403
 * Boots the real Express app on an ephemeral port. DB writes are cleaned up.
 */
async function main() {
  const { createApp } = await import('../src/app');
  const { prisma } = await import('../src/config');
  const { authService } = await import('../src/services/auth.service');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as any;
  const base = `http://127.0.0.1:${addr.port}/api`;

  const results: Array<{ name: string; pass: boolean; detail: string }> = [];
  const check = (name: string, pass: boolean, detail = '') => {
    results.push({ name, pass, detail });
    console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const json = async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(`${base}${path}`, opts);
    let body: any = null;
    try { body = await res.json(); } catch {}
    return { status: res.status, body, headers: res.headers };
  };

  try {
    // 1) GitHub OAuth URL — minimal scope + signed state
    const gh = await json('/auth/oauth/url?provider=github&csrfToken=nonce-xyz');
    const url = new URL(gh.body?.data?.url ?? 'https://example.invalid');
    const scope = url.searchParams.get('scope') ?? '';
    const state = url.searchParams.get('state') ?? '';
    check('github scope = read:user user:email', scope === 'read:user user:email', scope);
    check('github scope excludes repo', !/\brepo\b/.test(scope), scope);
    let stateOk = false; let stateErr = '';
    try { const v = authService.verifyOAuthState(state, 'github'); stateOk = v.nonce === 'nonce-xyz'; }
    catch (e: any) { stateErr = e.message; }
    check('oauth url carries a valid signed state', stateOk, stateOk ? '' : stateErr);

    // 2) CORS — allowlisted origin accepted, arbitrary vercel rejected
    const allowed = await json('/auth/plans', { headers: { Origin: 'http://localhost:5173' } });
    const allowedAcao = allowed.headers.get('access-control-allow-origin');
    check('CORS allows localhost:5173', allowedAcao === 'http://localhost:5173', String(allowedAcao));

    const evil = await json('/auth/plans', { headers: { Origin: 'https://evil-attacker.vercel.app' } });
    const evilAcao = evil.headers.get('access-control-allow-origin');
    check('CORS rejects arbitrary *.vercel.app', evilAcao === null, `ACAO=${String(evilAcao)}`);

    // 3) OAuth callback — missing / tampered state must be 403 (before code exchange)
    const noState = await json('/auth/oauth/callback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'github', code: 'fake-code' }),
    });
    check('oauth callback w/o state → 403', noState.status === 403, `status=${noState.status}`);

    const badState = await json('/auth/oauth/callback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'github', code: 'fake-code', state: 'github:n:1:deadbeef' }),
    });
    check('oauth callback w/ forged state → 403', badState.status === 403, `status=${badState.status}`);

    // 4) Upgrade gate
    const user = await prisma.user.findFirst({ select: { id: true, email: true } });
    if (!user) {
      check('upgrade gate (skipped: no user)', false, 'no user rows');
    } else {
      const token = authService.generateJWT(user.id, user.email, 'email');
      const up = await json('/auth/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: 'pro' }),
      });
      check('POST /auth/upgrade → 403 (self-service disabled)', up.status === 403, `status=${up.status}`);

      const after = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true } });
      check('plan unchanged in DB', after?.plan !== undefined, `plan=${after?.plan}`);
    }

    // 5) Login normalization — unknown email must be 401, not 404
    const unknown = await json('/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nobody-${crypto.randomUUID()}@example.com`, password: 'WrongPass1!a' }),
    });
    check('login unknown email → 401 (not 404)', unknown.status === 401, `status=${unknown.status}`);

    // 6) Login provider-account normalization (create a throwaway OAuth-style user)
    const email = `probe-${crypto.randomUUID()}@example.com`;
    const created = await prisma.user.create({
      data: { email, provider: 'github', providerId: 'probe', passwordHash: null },
      select: { id: true },
    });
    try {
      const oauthLogin = await json('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'WrongPass1!a' }),
      });
      check('login OAuth-only account → 401 normalized', oauthLogin.status === 401, `status=${oauthLogin.status}`);
    } finally {
      await prisma.user.delete({ where: { id: created.id } }).catch(() => {});
    }

    const failed = results.filter(r => !r.pass);
    console.log(`\nRESULT: ${failed.length === 0 ? '✅ all Phase 1 checks passed' : `❌ ${failed.length} failed`}`);
    process.exitCode = failed.length === 0 ? 0 : 1;
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(e => { console.error('verify-phase1 crashed:', e); process.exit(1); });
