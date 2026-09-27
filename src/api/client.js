import axios from 'axios';

// Configurable API Client. Defaults to the local Express backend
// (server/src/index.js, mounted at /api/v1) rather than a placeholder host,
// so this actually talks to something real out of the box. Override with
// VITE_API_BASE_URL in a root .env if your backend runs elsewhere.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Add request interceptor for authorization tokens
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for handling global errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.warn('API Interceptor captured error (fallback to local mock data mode):', error.message);
    return Promise.reject(error);
  }
);
