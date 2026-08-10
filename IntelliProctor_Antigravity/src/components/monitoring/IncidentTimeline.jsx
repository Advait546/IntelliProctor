import React from 'react';
import { ShieldAlert, AlertTriangle, Info } from 'lucide-react';

export const IncidentTimeline = ({ incidents = [] }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
        <span>AI Incident Timeline</span>
        <span className="text-xs font-semibold text-slate-500">{incidents.length} Events</span>
      </h3>

      <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
        {incidents.map((evt, idx) => (
          <div key={idx} className="relative flex items-start gap-3 pl-8">
            <span className={`absolute left-1.5 top-1 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
              evt.severity === 'critical' ? 'border-red-500 text-red-500' : evt.severity === 'warning' ? 'border-amber-500 text-amber-500' : 'border-indigo-500 text-indigo-500'
            }`}>
              {evt.severity === 'critical' ? (
                <ShieldAlert className="w-2.5 h-2.5" />
              ) : evt.severity === 'warning' ? (
                <AlertTriangle className="w-2.5 h-2.5" />
              ) : (
                <Info className="w-2.5 h-2.5" />
              )}
            </span>

            <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>{evt.event}</span>
                <span className="text-[10px] text-slate-500 font-mono">{evt.time}</span>
              </div>
              <p className="mt-1 text-slate-600 font-medium leading-relaxed">{evt.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
