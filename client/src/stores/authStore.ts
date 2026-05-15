import { create } from 'zustand';
import api from '../lib/api';

interface AuthUser {
  id: number;
  login: string;
  avatarUrl: string;
  name: string | null;
  email: string | null;
  htmlUrl: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  loginWithGitHub: () => Promise<void>;
  handleCallback: (code: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,

  /** Step 1: Redirect user to GitHub consent screen */
  loginWithGitHub: async () => {
    try {
      const { data } = await api.get('/auth/github');
      // Redirect to GitHub
      window.location.href = data.data.url;
    } catch (err) {
      console.error('Failed to initiate GitHub login:', err);
    }
  },

  /** Step 2: Exchange auth code for JWT (called from callback page) */
  handleCallback: async (code: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/github/callback', { code });
      const { token, user } = data.data;

      // Persist to localStorage
      localStorage.setItem('archon_token', token);
      localStorage.setItem('archon_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      console.error('GitHub callback failed:', err);
      set({ isLoading: false });
      throw err;
    }
  },

  /** Fetch current user from backend (token verification) */
  fetchUser: async () => {
    const token = localStorage.getItem('archon_token');
    if (!token) return;

    set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({
        user: data.data.user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // Token invalid — clear everything
      localStorage.removeItem('archon_token');
      localStorage.removeItem('archon_user');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  /** Clear auth state */
  logout: () => {
    localStorage.removeItem('archon_token');
    localStorage.removeItem('archon_user');
    set({ user: null, token: null, isAuthenticated: false });
    // Fire-and-forget backend logout
    api.post('/auth/logout').catch(() => {});
  },

  /** Rehydrate auth state from localStorage on app boot */
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
