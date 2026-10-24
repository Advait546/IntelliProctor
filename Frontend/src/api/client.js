import axios from 'axios';

// All calls go to the FastAPI backend (backend/src/main.py) under /api/v1.
// In development Vite proxies /api -> http://localhost:8000 (vite.config.js).
// There are deliberately NO mock fallbacks: if the backend is down the UI shows
// the real error instead of pretending (BACKEND_CURRENT_STATE.md section 13.1).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const TOKEN_KEYS = { examiner: 'ip_examiner_token', student: 'ip_student_token' };

export const getToken = (role) => {
  try {
    return localStorage.getItem(TOKEN_KEYS[role]);
  } catch {
    return null;
  }
};

export const setToken = (role, token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEYS[role], token);
    else localStorage.removeItem(TOKEN_KEYS[role]);
  } catch {
    /* storage unavailable */
  }
};

// Which stored access token a request should use: examiner pages use the
// examiner token, everything else the candidate's. Calls that need the scoped
// exam-session token pass their own Authorization header.
const roleForPath = () => (window.location.pathname.startsWith('/admin') ? 'examiner' : 'student');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 20000,
});

apiClient.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = getToken(config.authRole || roleForPath());
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        const { token, user } = res.data;
        setToken(user.role === 'student' ? 'student' : 'examiner', token);
        return { token, role: user.role };
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

/** Human-readable message from the backend error envelope (section 17.1). */
export const errorMessage = (err, fallback = 'Something went wrong') => {
  const env = err?.response?.data?.error;
  if (env?.details?.length && env.code === 'VALIDATION_ERROR') {
    return env.details.map((d) => `${d.field ? `${d.field}: ` : ''}${d.message}`).join('; ');
  }
  if (env?.message) return env.message;
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Cannot reach the IntelliProctor backend. Is it running on port 8000?';
  }
  return err?.message || fallback;
};

export const errorCode = (err) => err?.response?.data?.error?.code;

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const code = errorCode(error);
    const usedSessionToken = original?.headers?.['X-Exam-Session'] === '1';
    if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && !original._retried && !usedSessionToken) {
      original._retried = true;
      try {
        const { token } = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      } catch {
        /* fall through to the original error */
      }
    }
    return Promise.reject(error);
  }
);

export const sessionHeaders = (sessionToken) => ({
  Authorization: `Bearer ${sessionToken}`,
  'X-Exam-Session': '1',
});

export const wsUrl = (path) => {
  const base = import.meta.env.VITE_WS_BASE_URL;
  if (base) return `${base.replace(/\/$/, '')}${path}`;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${path}`;
};
