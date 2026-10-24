import { apiClient } from './client';

export const settingsApi = {
  getSettings: () => apiClient.get('/settings', { authRole: 'examiner' }),
  updateSettings: (settings) => apiClient.put('/settings', settings, { authRole: 'examiner' }),
};
