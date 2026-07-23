import axios from 'axios';

/**
 * Axios API client instance.
 * 
 * Pre-configured with base URL and interceptors for:
 * - Attaching JWT to every request
 * - Handling 401 responses (auto-logout)
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('archon_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear auth state
      localStorage.removeItem('archon_token');
      localStorage.removeItem('archon_user');

      // Sync tabs that token is gone
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'archon_token',
        newValue: null,
      }));

      // Only redirect if not already on landing or auth page
      if (window.location.pathname !== '/' && window.location.pathname !== '/auth') {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/auth?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
