import React, { useState, useEffect } from 'react';
import { Sliders, Bell, User, Save, Scale, Lock } from 'lucide-react';
import { settingsApi } from '../../api/settingsApi';
import { errorMessage } from '../../api/client';

const PRODUCTION_CV = [
  ['Active model', 'phase0 — models/pretrained/yolo11m.pt'],
  ['YOLO confidence threshold', '0.65 (phone & book)'],
  ['Phone aspect ratio window', '1.15 – 2.90'],
  ['Book aspect ratio window', '0.80 – 2.50'],
  ['Temporal hysteresis', '3 frames on / 4 frames off'],
  ['Head-pose neutral range', '|yaw| ≤ 30°, |pitch| ≤ 25°, |roll| ≤ 25°'],
  ['Qualifying head turn', '≥ 1.0 s outside neutral, then return; 2.0 s cooldown'],
  ['Candidate absence', 'no face for ≥ 10 s'],
];

export const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    settingsApi
      .getSettings()
      .then(setSettings)
      .catch((err) => setError(errorMessage(err, 'Could not load settings')));
  }, []);

  const handleSave = async () => {
    setError('');
    try {
      const res = await settingsApi.updateSettings({
        notificationSettings: settings.notificationSettings,
        examRules: settings.examRules,
        account: { name: settings.account.name, department: settings.account.department },
      });
      setSettings(res.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(errorMessage(err, 'Saving failed'));
    }
  };

  if (!settings) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-sm text-slate-500">{error || 'Loading settings...'}</div>;
  }

  const policy = settings.scoringPolicy;
  const toggle = (group, key) => (e) => setSettings({ ...settings, [group]: { ...settings[group], [key]: e.target.checked } });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System & AI Settings</h1>
          <p className="text-xs text-slate-500 font-medium">Notification preferences, exam rules and the active proctoring policy</p>
        </div>
        <button onClick={handleSave} className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md flex items-center gap-2">
          <Save className="w-4 h-4" />
          <span>{saved ? 'Settings Saved!' : 'Save Configuration'}</span>
        </button>
      </div>
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">{error}</div>}

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Scale className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Suspicion Scoring Policy</h2>
          <span className="ml-auto text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Enforced by backend
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">3 sideways head turns</div>
            <div className="text-lg font-extrabold">+{policy.headTurnGroupOf3}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Book episode</div>
            <div className="text-lg font-extrabold">+{policy.bookEpisode}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Phone episode</div>
            <div className="text-lg font-extrabold">+{policy.phoneEpisode}</div>
          </div>
        </div>
        <p className="text-xs text-slate-600">
          Suspicious when <strong>S ≥ {policy.suspiciousThreshold}</strong>; hard ceiling <strong>{policy.scoreCeiling}</strong>. Logged with 0 points:{' '}
          {policy.zeroWeightSignals.join(', ').toLowerCase().replaceAll('_', ' ')}. Changing weights requires an approved policy amendment.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">AI Detection Configuration (production)</h2>
          <span className="ml-auto text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Read-only
          </span>
        </div>
        <table className="w-full text-xs">
          <tbody>
            {PRODUCTION_CV.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100">
                <td className="py-2 font-semibold text-slate-600">{k}</td>
                <td className="py-2 font-mono text-slate-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500">
          These thresholds were validated by the ML team (reports/ml). They are set in the CV worker and are intentionally not editable from the browser.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Bell className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Live Monitoring Preferences</h2>
        </div>
        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <span className="font-bold text-slate-800">Pop-up alerts on the live grid for new incidents</span>
            <input type="checkbox" checked={!!settings.notificationSettings.soundAlertsOnWarning} onChange={toggle('notificationSettings', 'soundAlertsOnWarning')} className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <span className="font-bold text-slate-800">Require fullscreen (default for new exams)</span>
            <input type="checkbox" checked={!!settings.examRules.requireFullscreen} onChange={toggle('examRules', 'requireFullscreen')} className="w-4 h-4" />
          </label>
        </div>
      </div>

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
              value={settings.account.name || ''}
              onChange={(e) => setSettings({ ...settings, account: { ...settings.account, name: e.target.value } })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Email Address</label>
            <input type="email" value={settings.account.email || ''} readOnly className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-100 text-slate-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-slate-500 mb-1">Department / Institution</label>
            <input
              type="text"
              value={settings.account.department || ''}
              onChange={(e) => setSettings({ ...settings, account: { ...settings.account, department: e.target.value } })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
