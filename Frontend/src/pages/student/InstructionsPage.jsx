import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Smartphone, BookOpen, Maximize, Camera, Users, CheckCircle, ArrowRight } from 'lucide-react';

export const InstructionsPage = () => {
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();

  const rules = [
    { icon: Smartphone, title: 'No Mobile Phones or Gadgets', detail: 'Smartphones, watches, or secondary devices near your workspace will trigger instant critical AI alerts.' },
    { icon: BookOpen, title: 'No Textbooks or Physical Notes', detail: 'Reading physical paper notes or textbooks is strictly prohibited.' },
    { icon: Maximize, title: 'Remain in Fullscreen Mode', detail: 'Exiting fullscreen or switching browser tabs will log tab-blur security warnings.' },
    { icon: Camera, title: 'Camera Must Stay On & Unobstructed', detail: 'Your face must remain fully visible within the camera frame throughout the test duration.' },
    { icon: Users, title: 'Only One Person Allowed', detail: 'Secondary individuals in the camera background will be flagged by YOLO object detection.' },
    { icon: ShieldCheck, title: 'Continuous AI Proctoring Active', detail: 'MediaPipe face mesh and YOLO vision algorithms will monitor your session in real time.' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-8">
        
        {/* Header */}
        <div className="pb-6 border-b border-slate-100">
          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-[10px] uppercase tracking-wider">
            MANDATORY EXAMINATION RULES
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
            Code of Conduct & Security Guidelines
          </h1>
          <p className="text-xs text-slate-500 font-medium">Please carefully read and acknowledge all rules before beginning automated system checks</p>
        </div>

        {/* Rules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rules.map((rule, idx) => {
            const Icon = rule.icon;
            return (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{rule.title}</h3>
                  <p className="mt-1 text-[11px] text-slate-500 font-medium leading-relaxed">{rule.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mandatory Accept Checkbox */}
        <div className="pt-6 border-t border-slate-100 space-y-4">
          <label className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs text-indigo-950 font-medium">
              <strong className="font-bold">I hereby agree and pledge</strong> to abide by all the examination guidelines above. I understand that my video stream, head movement, and browser workspace are continuously monitored by AI models.
            </div>
          </label>

          {/* Start System Check CTA */}
          <div className="flex justify-end">
            <button
              onClick={() => navigate('/student/system-check')}
              disabled={!accepted}
              className={`px-8 py-4 rounded-2xl font-extrabold text-sm shadow-xl transition-all flex items-center gap-2 ${
                accepted
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Start System Check</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
