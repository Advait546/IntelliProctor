import React, { useState } from 'react';
import { Eye, ShieldAlert, Filter, Search, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { useProctoring } from '../../contexts/ProctoringContext';
import { StudentLiveCard } from '../../components/monitoring/StudentLiveCard';

export const LiveMonitoringPage = () => {
  const { students } = useProctoring();
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter((s) => {
    const matchesFilter = filterStatus === 'All' || s.status === filterStatus;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const criticalCount = students.filter((s) => s.status === 'Critical').length;
  const warningCount = students.filter((s) => s.status === 'Warning').length;
  const safeCount = students.filter((s) => s.status === 'Safe').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Flagship Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              REAL-TIME YOLO + MEDIAPIPE AI FEED
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Flagship Live AI Proctoring Grid</h1>
            <p className="text-xs text-indigo-200 font-medium mt-1">
              Active Examination: <strong className="text-white font-mono">AI2026CS01</strong> (Computer Science & AI Fundamentals)
            </p>
          </div>

          {/* Real-time Status Badges Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterStatus('Critical')}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-extrabold transition-all flex items-center gap-2 ${
                filterStatus === 'Critical' ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-500' : 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{criticalCount} Critical</span>
            </button>

            <button
              onClick={() => setFilterStatus('Warning')}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-extrabold transition-all flex items-center gap-2 ${
                filterStatus === 'Warning' ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-500' : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>{warningCount} Warning</span>
            </button>

            <button
              onClick={() => setFilterStatus('Safe')}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-extrabold transition-all flex items-center gap-2 ${
                filterStatus === 'Safe' ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{safeCount} Safe</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name or PRN..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('All')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterStatus === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Show All ({students.length})
          </button>
        </div>
      </div>

      {/* Live Examinees Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student) => (
          <StudentLiveCard key={student.id} student={student} />
        ))}
      </div>

    </div>
  );
};
