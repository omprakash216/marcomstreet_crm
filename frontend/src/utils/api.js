import axios from 'axios';
import { cacheInterceptor, cacheResponseInterceptor } from './cache';

// API base URL configuration
// In development, prefer direct backend URL to avoid proxy upload issues.
// In production, use relative path since frontend and backend are in same hosting.
const devApiPort = import.meta.env.VITE_API_PORT || '3000';
const devApiBase =
  import.meta.env.VITE_API_BASE_URL || `http://localhost:${devApiPort}/api`;
const API_BASE_URL = import.meta.env.DEV ? devApiBase : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Debug logging
console.log('🚀 API Base URL:', API_BASE_URL || '(relative)');
console.log('🚀 Environment:', import.meta.env.PROD ? 'Production' : 'Development');
console.log('🚀 Axios Base URL:', api.defaults.baseURL);

// Add cache interceptors for fast loading (disabled for debugging)
// api.interceptors.request.use(cacheInterceptor);
// api.interceptors.response.use(cacheResponseInterceptor);

// Add token to requests and fix URLs
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

    // Debug log
    console.log(`🔌 Requesting: ${config.baseURL}${config.url}`);

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
    const { response, config } = error;
    if (response) {
      console.error(`❌ API Error [${response.status}] for ${config.url}:`, response.data);
    } else {
      const fullUrl = `${config?.baseURL || ''}${config?.url || ''}`;
      console.error(`❌ Network Error for ${fullUrl || config?.url}:`, error.message, error.code || '');
    }
    return Promise.reject(error);
  }
);

export default api;
