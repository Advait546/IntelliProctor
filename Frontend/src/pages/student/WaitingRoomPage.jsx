import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Camera, Mic, Wifi, Sun, UserCheck, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useExam } from '../../contexts/ExamContext';
import { useTimer } from '../../hooks/useTimer';

export const WaitingRoomPage = () => {
  const navigate = useNavigate();
  const { studentSession } = useAuth();
  const { exams } = useExam();
  const { formatTime } = useTimer(5); // 5 mins countdown demo

  const currentExam = exams[0];

  const [systemChecks] = useState([
    { name: 'Camera Access', status: 'pass', icon: Camera, detail: '1080p HD Webcam Active' },
    { name: 'Microphone Audio', status: 'pass', icon: Mic, detail: 'Input level nominal (-22dB)' },
    { name: 'Internet Latency', status: 'pass', icon: Wifi, detail: 'Ping: 18ms (Stable)' },
    { name: 'Ambient Lighting', status: 'pass', icon: Sun, detail: 'Good illumination' },
    { name: 'Face Detection', status: 'pass', icon: UserCheck, detail: '468 Mesh points tracked' },
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Waiting Room Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl text-center relative overflow-hidden space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          EXAM WAITING ROOM LIVE
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight">{currentExam.title}</h1>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-indigo-200 font-medium">
          <div>Setter: <strong className="text-white">Dr. Sharma</strong></div>
          <div>Scheduled Time: <strong className="text-white">{currentExam.scheduledTime}</strong></div>
          <div>Code: <strong className="text-emerald-400 font-mono">{currentExam.code}</strong></div>
        </div>

        {/* Countdown Timer Display */}
        <div className="pt-2">
          <div className="text-xs text-indigo-200 font-bold uppercase tracking-widest mb-1">Time Remaining Before Exam Launch</div>
          <div className="text-4xl sm:text-5xl font-mono font-extrabold text-emerald-400 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl inline-block border border-white/20">
            {formatTime()}
          </div>
        </div>
      </div>

      {/* System Readiness Checklist */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Pre-Exam System Health Checklist</h3>
            <p className="text-xs text-slate-500">Real-time verification of hardware & browser environment</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
            5/5 CHECKS PASSED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemChecks.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{item.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="text-[10px] text-emerald-800 font-medium mt-0.5">{item.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Status Banner & Proceed CTA */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-emerald-500 animate-ping"></div>
          <div className="text-xs font-extrabold text-slate-800">
            Waiting for Exam Session to Start... (Instructor Active)
          </div>
        </div>

        <button
          onClick={() => navigate('/student/instructions')}
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
        >
          <span>Read Exam Rules & Instructions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
