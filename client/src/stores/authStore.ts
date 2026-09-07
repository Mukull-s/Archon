import { create } from 'zustand';
import api from '../lib/api';
import { toast } from 'sonner';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
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
  handleOAuthCallback: (provider: string, code: string, email?: string, name?: string) => Promise<void>;
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

const storedToken = localStorage.getItem('archon_token');
const storedUserStr = localStorage.getItem('archon_user');
let initialUser = null;
let initialIsAuthenticated = false;

if (storedToken && storedUserStr && isTokenValid(storedToken)) {
  try {
    initialUser = JSON.parse(storedUserStr);
    initialIsAuthenticated = true;
  } catch (e) {
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
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error?.message || 'Signup failed');
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
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error?.message || 'Verification failed');
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
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.response?.data?.error?.message || 'Login failed');
    }
  },

  loginWithOAuth: async (provider, mode) => {
    set({ isLoading: true });
    try {
      localStorage.setItem('auth_oauth_mode', mode);

      // Save redirect URL if present
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect') || '/';
      localStorage.setItem('auth_redirect_url', redirectUrl);

      // Generate client-side random CSRF token
      const csrfToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('oauth_csrf_token', csrfToken);

      const { data } = await api.get(`/auth/oauth/url?provider=${provider}&csrfToken=${csrfToken}`);
      // Open popup
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

      let timeoutTimer: any = null;
      let channel: BroadcastChannel | null = null;
      let handled = false;

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('storage', handleStorage);
        if (channel) {
          try { channel.close(); } catch {}
          channel = null;
        }
      };

      const onAuthComplete = (payload?: any) => {
        if (handled) return;
        handled = true;
        cleanup();
        try { popup?.close(); } catch {}

        const user = payload?.user || JSON.parse(localStorage.getItem('archon_user') || 'null');
        const token = payload?.token || localStorage.getItem('archon_token') || null;
        if (token && user) {
          set({ user, token, isAuthenticated: true, isLoading: false });
        }

        const target = localStorage.getItem('auth_redirect_url') || '/';
        localStorage.removeItem('auth_redirect_url');
        localStorage.removeItem('archon_oauth_event');
        window.location.href = target;
      };

      // 1. Listen via BroadcastChannel (safe when window.opener is severed by COOP)
      try {
        channel = new BroadcastChannel('archon_oauth_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'oauth_complete') {
            onAuthComplete(event.data);
          }
        };
      } catch {}

      // 2. Listen via localStorage storage event (cross-window fallback)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'archon_oauth_event' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed?.type === 'oauth_complete') {
              localStorage.removeItem('archon_oauth_event');
              onAuthComplete(parsed);
            }
          } catch {}
        }
      };
      window.addEventListener('storage', handleStorage);

      // 3. Listen for postMessage from popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'oauth_complete') {
          onAuthComplete(event.data);
        }
      };
      window.addEventListener('message', handleMessage);

      // 4. Timeout fallback to reset loading if user abandons the window (2 minutes)
      timeoutTimer = setTimeout(() => {
        if (!handled && useAuthStore.getState().isLoading) {
          cleanup();
          set({ isLoading: false });
        }
      }, 120_000);
    } catch (err: any) {
      set({ isLoading: false });
      console.error(`${provider} OAuth failed:`, err);
      toast.error(err.response?.data?.error?.message || `${provider} OAuth failed`);
    }
  },

  handleOAuthCallback: async (provider, code, email, name) => {
    set({ isLoading: true });
    try {
      const mode = localStorage.getItem('auth_oauth_mode') || 'login';
      const { data } = await api.post('/auth/oauth/callback', { provider, code, mode, email, name });
      const { token, user } = data.data;

      localStorage.setItem('archon_token', token);
      localStorage.setItem('archon_user', JSON.stringify(user));

      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      console.error('OAuth callback failed:', err);
      set({ isLoading: false });
      throw new Error(err.response?.data?.error?.message || 'OAuth callback failed');
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

    // Sync multi-tab logouts and logins via storage events
    window.addEventListener('storage', (e) => {
      if (e.key === 'archon_token') {
        const newToken = e.newValue;
        if (!newToken) {
          // Token removed in another tab
          set({ user: null, token: null, isAuthenticated: false });
          if (window.location.pathname !== '/' && window.location.pathname !== '/auth') {
            const currentPath = window.location.pathname + window.location.search;
            window.location.href = `/auth?redirect=${encodeURIComponent(currentPath)}`;
          }
        } else {
          // Token added/changed in another tab
          useAuthStore.getState().fetchUser(true).catch(() => {});
        }
      }
    });
  },
}));
