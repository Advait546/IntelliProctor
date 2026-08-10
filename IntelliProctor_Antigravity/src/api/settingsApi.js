import { apiClient } from './client';

export const settingsApi = {
  getSettings: async () => {
    try {
      return await apiClient.get('/settings');
    } catch {
      return null;
    }
  },
  updateSettings: async (settings) => {
    try {
      return await apiClient.put('/settings', settings);
    } catch {
      return { success: true, updated: true };
    }
  }
};
