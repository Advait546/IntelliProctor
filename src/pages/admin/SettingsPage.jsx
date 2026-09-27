import React, { useState, useEffect } from 'react';
import { Settings, Shield, Sliders, Bell, FileCheck, User, Moon, AlertOctagon, Save } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../constants/mockData';
import { settingsApi } from '../../api/settingsApi';

export const SettingsPage = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  // Fetch real settings on mount and merge them onto DEFAULT_SETTINGS rather
  // than replacing it outright -- the backend only manages aiSettings.* and
  // notificationSettings.* (see server/src/controllers/settings.controller.js),
  // so `examRules` and `account` (no admin-account-management UI exists yet)
  // stay whatever DEFAULT_SETTINGS already had. If the backend is unreachable,
  // settingsApi.getSettings() resolves to null and this is a no-op, so the
  // page just keeps showing DEFAULT_SETTINGS as before.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const real = await settingsApi.getSettings();
      if (cancelled || !real) return;
      setSettings((prev) => ({
        ...prev,
        aiSettings: { ...prev.aiSettings, ...real.aiSettings },
        notificationSettings: { ...prev.notificationSettings, ...real.notificationSettings },
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    await settingsApi.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System & AI Settings</h1>
          <p className="text-xs text-slate-500 font-medium">Configure computer vision detection thresholds and proctoring rules</p>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saved ? 'Settings Saved!' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* AI Settings Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">AI Detection Thresholds</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              YOLO Confidence Threshold: {settings.aiSettings.yoloConfidenceThreshold}%
            </label>
            <input
              type="range"
              min={50}
              max={95}
              value={settings.aiSettings.yoloConfidenceThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aiSettings: { ...settings.aiSettings, yoloConfidenceThreshold: parseInt(e.target.value) }
                })
              }
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Minimum probability to trigger Phone/Book detection</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Head Pose Angle Limit: {settings.aiSettings.headPoseAngleLimit}°
            </label>
            <input
              type="range"
              min={10}
              max={45}
              value={settings.aiSettings.headPoseAngleLimit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aiSettings: { ...settings.aiSettings, headPoseAngleLimit: parseInt(e.target.value) }
                })
              }
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Max yaw angle before trigger "Looking Away" warning</span>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Bell className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Notification & Alert Rules</h2>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <span className="font-bold text-slate-800">Email Alerts on Critical Incidents</span>
            <input
              type="checkbox"
              checked={settings.notificationSettings.emailAlertsOnCritical}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  notificationSettings: { ...settings.notificationSettings, emailAlertsOnCritical: e.target.checked }
                })
              }
              className="w-4 h-4 text-indigo-600"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <span className="font-bold text-slate-800">Audible Sound Alerts on Warning Spikes</span>
            <input
              type="checkbox"
              checked={settings.notificationSettings.soundAlertsOnWarning}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  notificationSettings: { ...settings.notificationSettings, soundAlertsOnWarning: e.target.checked }
                })
              }
              className="w-4 h-4 text-indigo-600"
            />
          </label>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <User className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Account Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
          <div>
            <label className="block text-slate-500 mb-1">Full Name</label>
            <input
              type="text"
              value={settings.account.name}
              onChange={(e) => setSettings({ ...settings, account: { ...settings.account, name: e.target.value } })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Email Address</label>
            <input
              type="email"
              value={settings.account.email}
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-100 text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50/50 rounded-3xl border border-red-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-red-200 text-red-700">
          <AlertOctagon className="w-5 h-5" />
          <h2 className="text-lg font-bold">Danger Zone</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-red-900">Purge Cached Exam Logs</div>
            <div className="text-[10px] text-red-700">Irreversibly clears local session test logs</div>
          </div>
          <button
            onClick={() => alert("Local test logs purged.")}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
          >
            Purge Logs
          </button>
        </div>
      </div>

    </div>
  );
};
