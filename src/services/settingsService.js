import apiClient from '../api/client';

export const DEFAULT_SETTINGS = {
  aiSensitivity: "High",
  faceDetectionThreshold: 85,
  objectDetectionThreshold: 75,
  audioThreshold: 60,
  headPoseLimit: 30, // degrees
  enableAutoWarning: true,
  maxWarningsBeforeFlag: 3,
  themeMode: "Light",
  emailNotifications: true,
  adminAlerts: true
};

export const settingsService = {
  async getSettings() {
    try {
      return await apiClient.get('/settings');
    } catch {
      const stored = localStorage.getItem('app_settings');
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    }
  },

  async saveSettings(newSettings) {
    try {
      return await apiClient.post('/settings', newSettings);
    } catch {
      localStorage.setItem('app_settings', JSON.stringify(newSettings));
      return newSettings;
    }
  }
};
