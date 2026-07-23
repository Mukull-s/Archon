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
  fetchUser: () => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

const storedToken = localStorage.getItem('archon_token');
const storedUserStr = localStorage.getItem('archon_user');
let initialUser = null;
let initialIsAuthenticated = false;

if (storedToken && storedUserStr) {
  try {
    initialUser = JSON.parse(storedUserStr);
    initialIsAuthenticated = true;
  } catch (e) {
    localStorage.removeItem('archon_token');
    localStorage.removeItem('archon_user');
  }
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
    try {
      localStorage.setItem('auth_oauth_mode', mode);

      // Generate client-side random CSRF token
      const csrfToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('oauth_csrf_token', csrfToken);

      const { data } = await api.get(`/auth/oauth/url?provider=${provider}&csrfToken=${csrfToken}`);
      // Open popup instead of redirect
      const width = 500, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.data.url,
        `${provider}_auth`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      // Listen for the callback from the popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'oauth_callback') {
          window.removeEventListener('message', handleMessage);
          popup?.close();

          const { provider: prov, code, email, name } = event.data;
          useAuthStore.getState().handleOAuthCallback(prov, code, email, name)
            .catch((err: any) => {
              const errMsg = err.message || '';
              if (errMsg.includes('not registered') || errMsg.includes('sign up first') || errMsg.includes('not found')) {
                toast.error('No account registered with this email. Switched to Sign Up.');
                set({ authMode: 'signup' });
              } else {
                toast.error(errMsg || `${prov} login failed`);
              }
            });
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err: any) {
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

  fetchUser: async () => {
    const token = localStorage.getItem('archon_token');
    if (!token) return;

    set({ isLoading: true });
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

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser;
        set({ user, token, isAuthenticated: true });
      } catch {
        localStorage.removeItem('archon_token');
        localStorage.removeItem('archon_user');
      }
    }

    // Sync multi-tab logouts and logins via storage events
    window.addEventListener('storage', (e) => {
      if (e.key === 'archon_token') {
        const newToken = e.newValue;
        if (!newToken) {
          // Token removed in another tab
          set({ user: null, token: null, isAuthenticated: false });
          window.location.href = '/auth';
        } else {
          // Token added/changed in another tab
          useAuthStore.getState().fetchUser();
        }
      }
    });
  },
}));
