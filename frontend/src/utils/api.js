import axios from 'axios';
import { cacheInterceptor, cacheResponseInterceptor } from './cache';

// API base URL configuration
// In development, use relative path to leverage Vite proxy
// In production, use relative path since frontend and backend are in same hosting
const API_BASE_URL = import.meta.env.DEV ? '/api' : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
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
      console.error(`❌ Network Error for ${config.url}:`, error.message);
    }
    return Promise.reject(error);
  }
);

export default api;

