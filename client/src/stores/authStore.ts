import { create } from 'zustand';
import api from '../lib/api';
import { toast } from 'sonner';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
  plan?: 'free' | 'pro';
  emailVerified: boolean;
  githubLogin: string | null;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authMode: 'login' | 'signup';
  setAuthMode: (mode: 'login' | 'signup') => void;

  // Actions
  signupWithEmail: (email: string, password: string, name: string) => Promise<string>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: 'github' | 'google', mode: 'login' | 'signup') => Promise<void>;
  handleOAuthCallback: (provider: string, code: string, state: string, email?: string, name?: string) => Promise<void>;
  fetchUser: (silent?: boolean) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && typeof payload.exp === 'number') {
      return payload.exp * 1000 > Date.now() + 10000;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull the server's message out of a failed request without typing on `any`.
 * The API's error envelope is `{ success: false, error: { message } }`.
 */
function apiErrorMessage(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e.response?.data?.error?.message ?? null;
}

/** Same, but tolerating the plain `Error` the store throws upward. */
function oauthErrorMessage(err: unknown): string | null {
  const fromApi = apiErrorMessage(err);
  if (fromApi) return fromApi;
  if (err instanceof Error && err.message.trim()) return err.message;
  return null;
}

/**
 * Attach the underlying failure to an error before rethrowing, so the original
 * stack stays reachable in devtools. `new Error(msg, { cause })` would be the
 * modern form, but this project targets ES2020 whose `Error` constructor takes
 * one argument — so the cause is set directly instead of raising the lib target.
 */
function withCause<T extends Error>(error: T, cause: unknown): T {
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

/** Guards the multi-tab listener so it is registered exactly once per page. */
let storageSyncBound = false;

const storedToken = localStorage.getItem('archon_token');
const storedUserStr = localStorage.getItem('archon_user');
let initialUser = null;
let initialIsAuthenticated = false;

if (storedToken && storedUserStr && isTokenValid(storedToken)) {
  try {
    initialUser = JSON.parse(storedUserStr);
    initialIsAuthenticated = true;
  } catch {
    // Corrupt payload in storage — the session cannot be trusted, so drop it.
    localStorage.removeItem('archon_token');
    localStorage.removeItem('archon_user');
  }
} else if (storedToken || storedUserStr) {
  localStorage.removeItem('archon_token');
  localStorage.removeItem('archon_user');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: storedToken,
  isLoading: false,
  isAuthenticated: initialIsAuthenticated,
  authMode: 'login',
  setAuthMode: (mode) => set({ authMode: mode }),

  signupWithEmail: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/signup', { email, password, name });
      const { token, user } = data.data;

      localStorage.setItem('archon_token', token);
      localStorage.setItem('archon_user', JSON.stringify(user));

      set({ user, token, isAuthenticated: true, isLoading: false });
      return data.message || 'Account created successfully!';
    } catch (err: unknown) {
      set({ isLoading: false });
      throw withCause(new Error(apiErrorMessage(err) || 'Signup failed'), err);
    }
  },

  verifyEmailCode: async (email, code) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/verify', { email, code });
      const { token, user } = data.data;

      localStorage.setItem('archon_token', token);
      localStorage.setItem('archon_user', JSON.stringify(user));

      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      set({ isLoading: false });
      throw withCause(new Error(apiErrorMessage(err) || 'Verification failed'), err);
    }
  },

  loginWithEmail: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { token, user } = data.data;

      localStorage.setItem('archon_token', token);
      localStorage.setItem('archon_user', JSON.stringify(user));

      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      set({ isLoading: false });
      throw withCause(new Error(apiErrorMessage(err) || 'Login failed'), err);
    }
  },

  loginWithOAuth: async (provider, mode) => {
    set({ isLoading: true });
    try {
      localStorage.setItem('auth_oauth_mode', mode);

      // Remember where to land after the round-trip. Kept in localStorage
      // rather than the URL because the provider's redirect_uri is fixed.
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect') || '/';
      localStorage.setItem('auth_redirect_url', redirectUrl);

      const { data } = await api.get(`/auth/oauth/url?provider=${provider}`);
      // Open the provider in a popup so the app stays mounted below it.
      const width = 500, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.data.url,
        `${provider}_auth`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        set({ isLoading: false });
        toast.error('Popup blocked. Please allow popups for this site.');
        return;
      }

      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let channel: BroadcastChannel | null = null;
      let handled = false;

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (pollTimer) clearInterval(pollTimer);
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('storage', handleStorage);
        if (channel) {
          try { channel.close(); } catch { /* already closed */ }
          channel = null;
        }
      };

      /** Stop loading and say why — never leave the button spinning. */
      const abort = (message?: string) => {
        if (handled) return;
        handled = true;
        cleanup();
        set({ isLoading: false });
        if (message) toast.error(message);
      };

      const onAuthComplete = (payload?: { user?: unknown; token?: string }) => {
        if (handled) return;

        const token = payload?.token || localStorage.getItem('archon_token') || null;
        let user: unknown = payload?.user;
        if (!user) {
          try { user = JSON.parse(localStorage.getItem('archon_user') || 'null'); } catch { user = null; }
        }

        // If the handover arrived but carried no session, do NOT silently
        // swallow it with `handled = true` — that is what left the spinner
        // turning forever. Fail visibly instead.
        if (!token || !user) {
          abort('Sign-in completed but the session could not be read. Please try again.');
          return;
        }

        handled = true;
        cleanup();
        try { popup?.close(); } catch { /* browser refused */ }

        set({ user: user as AuthState['user'], token, isAuthenticated: true, isLoading: false });

        const target = localStorage.getItem('auth_redirect_url') || '/';
        localStorage.removeItem('auth_redirect_url');
        localStorage.removeItem('archon_oauth_event');
        window.location.href = target;
      };

      // 1. BroadcastChannel — survives a COOP-severed opener
      try {
        channel = new BroadcastChannel('archon_oauth_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'oauth_complete') onAuthComplete(event.data);
        };
      } catch { /* unavailable — other channels still carry it */ }

      // 2. storage event — cross-window fallback
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'archon_oauth_event' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed?.type === 'oauth_complete') {
              localStorage.removeItem('archon_oauth_event');
              onAuthComplete(parsed);
            }
          } catch { /* malformed — ignore */ }
        }
      };
      window.addEventListener('storage', handleStorage);

      // 3. postMessage — only when the opener is reachable
      const handleMessage = (event: MessageEvent) => {
        // Same-origin only. In development the Vite port can differ from the
        // port the API was configured with, in which case the browser refuses
        // the message and this listener never fires — the popup-close poll
        // below is what rescues that case.
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'oauth_complete') onAuthComplete(event.data);
        if (event.data?.type === 'oauth_error') {
          abort(event.data.message || 'Sign-in failed. Please try again.');
        }
      };
      window.addEventListener('message', handleMessage);

      // 4. If the user simply closes the popup, stop immediately. Waiting the
      //    full timeout for a window that is already gone is the difference
      //    between "it failed" and "it hung".
      pollTimer = setInterval(() => {
        if (handled) return;
        // `closed` is true once the user dismisses the provider window.
        if (popup.closed) {
          // The handover may still be in flight via storage/BroadcastChannel,
          // so give it a beat before declaring failure.
          setTimeout(() => {
            if (!handled) abort('Sign-in window was closed before completing.');
          }, 1200);
        }
      }, 600);

      // 5. Absolute ceiling. Long enough for a real 2FA + password entry,
      //    short enough that a lost message never becomes a permanent spinner.
      timeoutTimer = setTimeout(() => {
        abort('Sign-in timed out. Please try again.');
      }, 180_000);
    } catch (err: unknown) {
      set({ isLoading: false });
      console.error(`${provider} OAuth failed:`, err);
      toast.error(oauthErrorMessage(err) || `${provider} OAuth failed`);
    }
  },

  handleOAuthCallback: async (provider, code, state, email, name) => {
    set({ isLoading: true });
    try {
      const mode = localStorage.getItem('auth_oauth_mode') || 'login';
      // `state` is forwarded so the SERVER can verify it. The server signs it
      // with an HMAC at issue time and re-verifies before exchanging the code;
      // that is the check that protects the flow. The browser deliberately does
      // not re-compare it — a second, weaker comparison here only produced
      // false "missing state" failures when the popup round-trip dropped the
      // local value.
      const { data } = await api.post('/auth/oauth/callback', { provider, code, mode, email, name, state });
      const { token, user } = data.data;

      localStorage.setItem('archon_token', token);
      localStorage.setItem('archon_user', JSON.stringify(user));

      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      console.error('OAuth callback failed:', err);
      set({ isLoading: false });
      throw withCause(new Error(oauthErrorMessage(err) || 'OAuth callback failed'), err);
    }
  },

  fetchUser: async (silent = false) => {
    const token = localStorage.getItem('archon_token');
    if (!token) return;

    if (!silent) set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data.user, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('archon_token');
      localStorage.removeItem('archon_user');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('archon_token');
    localStorage.removeItem('archon_user');
    set({ user: null, token: null, isAuthenticated: false });
    api.post('/auth/logout').catch(() => {});
  },

  hydrate: () => {
    const token = localStorage.getItem('archon_token');
    const userStr = localStorage.getItem('archon_user');

    if (token && userStr && isTokenValid(token)) {
      try {
        const user = JSON.parse(userStr) as AuthUser;
        set({ user, token, isAuthenticated: true });
        // Silently sync user details in the background on initial app hydration
        useAuthStore.getState().fetchUser(true).catch(() => {});
      } catch {
        localStorage.removeItem('archon_token');
        localStorage.removeItem('archon_user');
        set({ user: null, token: null, isAuthenticated: false });
      }
    } else if (token || userStr) {
      localStorage.removeItem('archon_token');
      localStorage.removeItem('archon_user');
      set({ user: null, token: null, isAuthenticated: false });
    }

    /* Multi-tab sync: a logout (or login) in another tab updates this one.
       Registered exactly once for the life of the page. `hydrate` is called
       from a React effect, and React 18 runs effects twice in development, so
       an unguarded registration here added a duplicate listener on every
       mount — each one firing its own `fetchUser` on every token change. */
    if (!storageSyncBound) {
      storageSyncBound = true;
      window.addEventListener('storage', (e) => {
        if (e.key !== 'archon_token') return
        if (!e.newValue) {
          set({ user: null, token: null, isAuthenticated: false })
          // Only bounce to sign-in from a protected surface; the marketing
          // pages and the auth page itself should stay where they are.
          const p = window.location.pathname
          if (p !== '/' && p !== '/auth' && p !== '/pricing' && p !== '/docs') {
            const current = p + window.location.search
            window.location.href = `/auth?redirect=${encodeURIComponent(current)}`
          }
        } else {
          useAuthStore.getState().fetchUser(true).catch(() => {})
        }
      })
    }
  },
}));
