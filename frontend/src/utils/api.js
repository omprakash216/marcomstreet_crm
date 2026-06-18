import axios from 'axios';
import { cacheInterceptor, cacheResponseInterceptor } from './cache';
import { clearAuth } from './auth';

// API base URL configuration
// In development, prefer Vite proxy (same-origin) to avoid CORS/mixed-content issues.
// If a custom backend URL is explicitly provided, honor it.
const devApiBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = import.meta.env.DEV ? (devApiBase || '/api') : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0, // no global timeout; let requests finish unless a specific override is set
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  withCredentials: true,
});

const NETWORK_ERROR_SUPPRESS_MS = 5000;
let lastNetworkErrorAt = 0;
let authRedirectInProgress = false;

const getRequestPath = (config) => {
  const rawUrl = String(config?.url || '');
  const path = rawUrl.split('?')[0];
  return path.startsWith('/') ? path : `/${path}`;
};

const isPublicAuthRequest = (config) => {
  const path = getRequestPath(config);
  return path === '/auth/login' || path === '/auth/logout' || path.startsWith('/auth/forgot-password/');
};

const redirectToLogin = () => {
  if (typeof window === 'undefined') return;
  clearAuth();
  if (window.location.pathname === '/login') {
    authRedirectInProgress = false;
    return;
  }
  if (authRedirectInProgress) return;
  authRedirectInProgress = true;
  window.location.replace('/login');
};

const isRetryableNetworkRequest = (error) => {
  const config = error?.config || {};
  const method = String(config.method || 'get').toLowerCase();
  const idempotent = ['get', 'head', 'options'].includes(method);
  return idempotent && !config.__networkRetry && !error.response && error.code !== 'ERR_CANCELED';
};

// Debug logging only in development to avoid noisy production consoles.
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL || '(relative)');
  console.log('Environment:', import.meta.env.PROD ? 'Production' : 'Development');
  console.log('Axios Base URL:', api.defaults.baseURL);
}

// Add cache interceptors for fast loading (disabled for debugging)
// api.interceptors.request.use(cacheInterceptor);
// api.interceptors.response.use(cacheResponseInterceptor);

// Add token to requests and fix URLs
api.interceptors.request.use(
  (config) => {

    const isEmailRequest = config.url && (config.url.includes('/forgot-password') || config.url.includes('/send-otp'));
    const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
    if (isFormData) {
      // Let the browser set the multipart boundary
      if (config.headers?.delete) {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      } else if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
      // File uploads can take longer than JSON requests
      if (!config.timeout || config.timeout < 60000) {
        config.timeout = 60000;
      }
    } else {
      // Default JSON content type for non-FormData requests
      if (config.headers?.set) {
        config.headers.set('Content-Type', 'application/json');
      } else if (config.headers) {
        config.headers['Content-Type'] = 'application/json';
      }
      // SMTP requests can be slow
      if (isEmailRequest) {
        if (!config.timeout || config.timeout < 30000) {
          config.timeout = 30000; // 30 seconds for SMTP mail sending
        }
      }
    }

    // Simplified URL handling for Vite proxy + Node backend
    // Vite proxy: /api/* -> Node backend (no .php)
    // Bas itna ensure karna hai ki URL '/' se start ho
    if (!config.url.startsWith('/')) {
      config.url = '/' + config.url;
    }

    // Node backend only: kabhi bhi .php append nahi karna
    // Query string ko split / rejoin karne ki bhi zaroorat nahi
    // Jo path components frontend bhej raha hai, woh hi backend routes hain

    if (import.meta.env.DEV) {
      console.log(`Requesting: ${config.baseURL}${config.url}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Ignore canceled requests (AbortController)
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const { response } = error;
    const config = error.config; // may be undefined for synthetic/cancelled errors

    if (config && isRetryableNetworkRequest(error)) {
      config.__networkRetry = true;
      return new Promise((resolve) => {
        window.setTimeout(() => resolve(api(config)), 800);
      });
    }

    if (response) {
      if (response.status === 401) {
        if (isPublicAuthRequest(config)) {
          clearAuth();
        } else {
          redirectToLogin();
        }
        return Promise.reject(error);
      }

      const msg = response.data?.message || response.data?.error || '';
      const urlLabel = config?.url || '(unknown)';
      if (msg) {
        console.error(`API Error [${response.status}] for ${urlLabel}:`, msg, response.data);
      } else {
        console.error(`API Error [${response.status}] for ${urlLabel}:`, response.data);
      }
    } else {
      const fullUrl = `${config?.baseURL || ''}${config?.url || ''}`;
      const now = Date.now();
      if (now - lastNetworkErrorAt > NETWORK_ERROR_SUPPRESS_MS) {
        lastNetworkErrorAt = now;
        console.error(`Network Error for ${fullUrl || config?.url || '(unknown)'}:`, error.message, error.code || '');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
