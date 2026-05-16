import { create } from 'zustand';
import api from '../lib/api';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
  emailVerified: boolean;
  githubLogin: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  signupWithEmail: (email: string, password: string, name: string) => Promise<string>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: 'github' | 'google') => Promise<void>;
  handleOAuthCallback: (provider: string, code: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,

  signupWithEmail: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/signup', { email, password, name });
      
      set({ isLoading: false });
      return data.message || 'Verification code sent to your email.';
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

  loginWithOAuth: async (provider) => {
    try {
      const { data } = await api.get(`/auth/oauth/url?provider=${provider}`);
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

          const { provider: prov, code } = event.data;
          useAuthStore.getState().handleOAuthCallback(prov, code);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      console.error(`${provider} OAuth failed:`, err);
    }
  },

  handleOAuthCallback: async (provider, code) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/oauth/callback', { provider, code });
      const { token, user } = data.data;

      localStorage.setItem('archon_token', token);
      localStorage.setItem('archon_user', JSON.stringify(user));

      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      console.error('OAuth callback failed:', err);
      set({ isLoading: false });
      throw err;
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
  },
}));
