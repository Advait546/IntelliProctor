import React from 'react';
import { Link } from 'react-router-dom';

export const QuickActionCard = ({ title, description, icon: Icon, to, gradient, badge }) => {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl p-6 text-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${gradient}`}
    >
      {/* Background Decorative Pattern */}
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl group-hover:scale-150 transition-transform"></div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6" />
          </div>
          {badge && (
            <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white border border-white/20">
              {badge}
            </span>
          )}
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-extrabold text-white tracking-tight leading-tight">{title}</h3>
          <p className="mt-1 text-xs text-white/80 font-medium leading-relaxed">{description}</p>
        </div>
      </div>
    </Link>
  );
};

export const RecentTestCard = ({ exam, onPublish, onViewLive }) => {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
            {exam.code}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              exam.status === 'Active'
                ? 'bg-emerald-100 text-emerald-800'
                : exam.status === 'Scheduled'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {exam.status}
          </span>
        </div>
        <h4 className="text-base font-bold text-slate-900 line-clamp-1">{exam.title}</h4>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {exam.subject} • {exam.duration} mins • {exam.totalQuestions} Questions
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <span>👥 {exam.registeredStudents} Registered</span>
          {exam.avgScore > 0 && <span>📊 Avg: {exam.avgScore}%</span>}
        </div>
        {exam.status === 'Active' ? (
          <Link
            to="/admin/live-monitoring"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
          >
            Monitor Live
          </Link>
        ) : (
          <Link
            to="/admin/publish-test"
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors"
          >
            View Code
          </Link>
        )}
      </div>
    </div>
  );
};
