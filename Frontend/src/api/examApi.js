import { apiClient, sessionHeaders } from './client';

export const examApi = {
  // ---- examiner ----
  getExams: () => apiClient.get('/exams', { authRole: 'examiner' }),
  getExam: (examId) => apiClient.get(`/exams/${examId}`, { authRole: 'examiner' }),
  createExam: (payload) => apiClient.post('/exams', payload, { authRole: 'examiner' }),
  updateExam: (examId, payload) => apiClient.put(`/exams/${examId}`, payload, { authRole: 'examiner' }),
  publishExam: (examId, payload = {}) => apiClient.post(`/exams/${examId}/publish`, payload, { authRole: 'examiner' }),
  closeExam: (examId) => apiClient.post(`/exams/${examId}/close`, null, { authRole: 'examiner' }),
  deleteExam: (examId) => apiClient.delete(`/exams/${examId}`, { authRole: 'examiner' }),
  regeneratePasskey: (examId) => apiClient.post(`/exams/${examId}/passkey/regenerate`, null, { authRole: 'examiner' }),
  generateFromBank: (payload) => apiClient.post('/exams/generate', payload, { authRole: 'examiner' }),

  // ---- candidate ----
  // Validates the passkey + window and returns the scoped exam session token.
  verifyPasskey: (passkey) => apiClient.post('/exams/verify-passkey', { passkey }, { authRole: 'student' }),
  getQuestions: (examId, sessionToken) => apiClient.get(`/exams/${examId}/questions`, { headers: sessionHeaders(sessionToken) }),
  saveDraft: (examId, sessionToken, questionId, answer, markedForReview) =>
    apiClient.post(`/exams/${examId}/draft`, { questionId, answer, markedForReview }, { headers: sessionHeaders(sessionToken) }),
  submit: (examId, sessionToken, answers) =>
    apiClient.post(`/exams/${examId}/submit`, { answers }, { headers: sessionHeaders(sessionToken) }),
};
