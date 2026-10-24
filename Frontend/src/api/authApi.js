import { apiClient } from './client';

export const authApi = {
  loginExaminer: (email, password) => apiClient.post('/auth/examiner/login', { email, password }),
  registerExaminer: (fullName, email, password) =>
    apiClient.post('/auth/register', { fullName, email, password, role: 'setter' }),
  // First sign-in with a new PRN registers the candidate (fullName required then).
  loginCandidate: ({ candidateId, password, fullName }) =>
    apiClient.post('/auth/candidate/login', { candidateId, password, fullName }, { authRole: 'student' }),
  me: (role) => apiClient.get('/auth/me', { authRole: role }),
  logout: () => apiClient.post('/auth/logout'),
  // Public PIN check used by the join page.
  lookupExamCode: (code) => apiClient.get(`/exams/lookup/${encodeURIComponent(code.trim())}`),
};
