import axios from 'axios';

// Configurable API Client ready for FastAPI backend integration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.smartexam.ai/v1';

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
