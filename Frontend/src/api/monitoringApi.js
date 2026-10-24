import { apiClient, sessionHeaders } from './client';

// Proctoring telemetry + examiner live hall. The frontend NEVER computes a
// suspicion score: it only sends observations and displays backend values.
export const monitoringApi = {
  // ---- candidate ----
  sendFrame: (sessionId, sessionToken, imageBase64) =>
    apiClient.post(
      `/proctor/sessions/${sessionId}/frames`,
      { imageBase64, capturedAt: new Date().toISOString() },
      { headers: sessionHeaders(sessionToken), timeout: 15000 }
    ),
  sendBrowserEvent: (sessionId, sessionToken, { eventType, episodeId, timestamp, durationMs, details }) =>
    apiClient.post(
      '/proctor/events',
      { sessionId, eventType, episodeId, timestamp, durationMs, details, source: 'BROWSER_VISIBILITY' },
      { headers: sessionHeaders(sessionToken) }
    ),
  precheck: (imageBase64) => apiClient.post('/proctor/precheck', { imageBase64 }, { authRole: 'student', timeout: 20000 }),
  uploadReferencePhoto: (blob) => {
    const form = new FormData();
    form.append('file', blob, 'reference.jpg');
    return apiClient.post('/candidates/reference-photo', form, { authRole: 'student', headers: { 'Content-Type': 'multipart/form-data' } });
  },

  // ---- examiner ----
  getLiveCandidates: (examId, includeFinished = false) =>
    apiClient.get('/proctor/live-candidates', { params: { examId: examId || undefined, includeFinished }, authRole: 'examiner' }),
  getSession: (sessionId) => apiClient.get(`/proctor/sessions/${sessionId}`, { authRole: 'examiner' }),
  getSessionEvents: (sessionId) => apiClient.get(`/proctor/sessions/${sessionId}/events`, { authRole: 'examiner' }),
  getSessionLedger: (sessionId) => apiClient.get(`/proctor/sessions/${sessionId}/ledger`, { authRole: 'examiner' }),
  getSnapshotBlob: (sessionId) =>
    apiClient.get(`/proctor/sessions/${sessionId}/snapshot`, { responseType: 'blob', authRole: 'examiner', timeout: 8000 }),
  flagSession: (sessionId, reason) => apiClient.post(`/proctor/sessions/${sessionId}/flag`, { reason }, { authRole: 'examiner' }),
  notifyCandidate: (sessionId, message, level = 'info') =>
    apiClient.post(`/proctor/sessions/${sessionId}/notify`, { message, level }, { authRole: 'examiner' }),
  getEvidence: (eventId) => apiClient.get(`/proctor/events/${eventId}/evidence`, { authRole: 'examiner' }),
  dismissEvent: (eventId, justificationNote) =>
    apiClient.post(`/proctor/events/${eventId}/dismiss`, { justificationNote }, { authRole: 'examiner' }),
  confirmEvent: (eventId, justificationNote) =>
    apiClient.post(`/proctor/events/${eventId}/confirm`, { justificationNote }, { authRole: 'examiner' }),
  cvHealth: () => apiClient.get('/proctor/health'),
};
