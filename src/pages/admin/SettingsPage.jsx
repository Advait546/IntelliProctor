import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Cpu,
  Sliders,
  Bell,
  BookOpen,
  User,
  Sun,
  AlertTriangle,
  Save,
  Check
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import { settingsService, DEFAULT_SETTINGS } from '../../services/settingsService';

const SettingsPage = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("ai");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsService.getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await settingsService.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    { id: "ai", label: "AI Settings", icon: Cpu },
    { id: "thresholds", label: "Detection Thresholds", icon: Sliders },
    { id: "notifications", label: "Notification Settings", icon: Bell },
    { id: "rules", label: "Exam Rules", icon: BookOpen },
    { id: "account", label: "Account", icon: User },
    { id: "theme", label: "Theme", icon: Sun },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Settings className="w-7 h-7 text-indigo-600" />
                System & AI Proctoring Settings
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure computer vision thresholds, alert sensitivity, and portal defaults.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              <span>{saved ? "Settings Saved!" : "Save Changes"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Tabs List */}
            <div className="md:col-span-4 bg-white rounded-3xl p-3 border border-slate-200 shadow-xs space-y-1 self-start">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : tab.id === 'danger'
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Tab Content */}
            <div className="md:col-span-8 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              {activeTab === "ai" && (
                <div className="space-y-4 text-xs">
                  <h3 className="font-bold text-base text-slate-900 border-b pb-2">AI Model & Proctoring Engine</h3>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">AI Detection Sensitivity</label>
                    <select
                      value={settings.aiSensitivity}
                      onChange={(e) => setSettings({ ...settings, aiSensitivity: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    >
                      <option value="Low">Low (Permissive)</option>
                      <option value="Medium">Medium (Balanced)</option>
                      <option value="High">High (Strict Commercial Standard)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={settings.enableAutoWarning}
                      onChange={(e) => setSettings({ ...settings, enableAutoWarning: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="font-bold text-slate-800">Auto-issue warning toasts to candidate on anomaly</span>
                  </label>
                </div>
              )}

              {activeTab === "thresholds" && (
                <div className="space-y-4 text-xs">
                  <h3 className="font-bold text-base text-slate-900 border-b pb-2">Computer Vision Thresholds</h3>
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span>YOLO Face Confidence Threshold</span>
                      <span className="text-indigo-600">{settings.faceDetectionThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="99"
                      value={settings.faceDetectionThreshold}
                      onChange={(e) => setSettings({ ...settings, faceDetectionThreshold: Number(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span>YOLO Object (Phone/Book) Threshold</span>
                      <span className="text-indigo-600">{settings.objectDetectionThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="99"
                      value={settings.objectDetectionThreshold}
                      onChange={(e) => setSettings({ ...settings, objectDetectionThreshold: Number(e.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-3 text-xs">
                  <h3 className="font-bold text-base text-slate-900 border-b pb-2">Notification & Alerts</h3>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="font-bold text-slate-800">Send email summary after every exam completion</span>
                  </label>
                </div>
              )}

              {activeTab === "rules" && (
                <div className="space-y-3 text-xs">
                  <h3 className="font-bold text-base text-slate-900 border-b pb-2">Default Examination Rules</h3>
                  <p className="text-slate-500">Default instructions prepopulated during new test creation.</p>
                </div>
              )}

              {activeTab === "account" && (
                <div className="space-y-3 text-xs">
                  <h3 className="font-bold text-base text-slate-900 border-b pb-2">Exam Setter Profile</h3>
                  <p className="font-bold text-slate-800">Name: Dr. Sharma</p>
                  <p className="text-slate-500">Role: Senior Exam Setter & Invigilator</p>
                </div>
              )}

              {activeTab === "theme" && (
                <div className="space-y-3 text-xs">
                  <h3 className="font-bold text-base text-slate-900 border-b pb-2">Portal Appearance</h3>
                  <p className="text-slate-500">Current Theme: Light Modern SaaS Theme (#F8FAFC)</p>
                </div>
              )}

              {activeTab === "danger" && (
                <div className="space-y-4 text-xs">
                  <h3 className="font-bold text-base text-rose-700 border-b border-rose-100 pb-2">Danger Zone</h3>
                  <p className="text-slate-600">Purging data will reset all saved questions and live candidate logs.</p>
                  <button
                    onClick={() => {
                      if (confirm("Reset mock data state to defaults?")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl"
                  >
                    Reset System Mock State
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
