import axios from 'axios';

// In production the Worker serves both the app and /api (same origin), so cookies "just work".
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').trim();
const BASE_URL = (rawBaseUrl.startsWith('http') && !rawBaseUrl.endsWith('/api') && !rawBaseUrl.endsWith('/api/'))
  ? rawBaseUrl.replace(/\/+$/, '') + '/api'
  : rawBaseUrl;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // session lives in an httpOnly cookie; no token in JS
  headers: {
    'Content-Type': 'application/json',
  },
});

// A 401 on a protected call means the session is gone: clear the cached display info and go to login.
// Login/register failures also return 401/409, so they are excluded.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthCall = url.startsWith('/auth/');
    // `skipAuthRedirect` is set by the session check on app start, which must not bounce public pages.
    if (error.response && error.response.status === 401 && !isAuthCall && !error.config?.skipAuthRedirect) {
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
