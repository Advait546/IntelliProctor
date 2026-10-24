import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, BookOpen, FileText, Eye, Settings, Users, ShieldAlert, Award, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useExam } from '../../contexts/ExamContext';
import { QuickActionCard, RecentTestCard } from '../../components/dashboard/QuickActionCard';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { reportApi } from '../../api/reportApi';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { exams, isLoadingExams, loadError, refreshExams } = useExam();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    refreshExams();
    reportApi.getOverview().then(setStats).catch(() => setStats(null));
  }, [refreshExams]);

  const setterName = user?.name || 'Examiner';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Greeting Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <span className="px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider border border-indigo-400/20">
            Exam Setter Command Center
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
            Hello, {setterName} 👋
          </h1>
          <p className="mt-2 text-lg text-indigo-200 font-medium">
            "What would you like to do today?"
          </p>
        </div>
      </motion.div>

      {/* Large Clickable Cards (Kahoot-inspired) */}
      <section className="space-y-4">
        <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Quick Launch Modules</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <QuickActionCard
            title="Create Test"
            description="Build & configure proctored exam"
            icon={PlusCircle}
            to="/admin/create-test"
            gradient="bg-gradient-to-br from-indigo-600 to-indigo-800"
            badge="NEW"
          />
          <QuickActionCard
            title="Question Bank"
            description="Manage & import questions"
            icon={BookOpen}
            to="/admin/question-bank"
            gradient="bg-gradient-to-br from-purple-600 to-indigo-700"
          />
          <QuickActionCard
            title="Live Monitoring"
            description="Real-time examinee grid AI"
            icon={Eye}
            to="/admin/live-monitoring"
            gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
            badge="FLAGSHIP"
          />
          <QuickActionCard
            title="Reports"
            description="Analytics & download CSV"
            icon={FileText}
            to="/admin/reports"
            gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
          />
          <QuickActionCard
            title="Settings"
            description="AI threshold & exam rules"
            icon={Settings}
            to="/admin/settings"
            gradient="bg-gradient-to-br from-slate-700 to-slate-900"
          />
        </div>
      </section>

      {/* Statistics Overview */}
      <section className="space-y-4">
        <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Platform Analytics</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Exams"
            value={stats?.totalExams ?? exams.length}
            subtitle="Created by you"
            icon={FileText}
            color="indigo"
          />
          <StatsCard
            title="Candidates"
            value={stats?.studentsRegistered ?? '—'}
            subtitle="Distinct examinees with attempts"
            icon={Users}
            color="emerald"
          />
          <StatsCard
            title="Avg Suspicion Score"
            value={stats ? `${stats.averageSuspicionScore}` : '—'}
            subtitle={stats ? `${stats.suspiciousSessions} suspicious attempt(s) (S >= 100)` : 'Backend scoring engine'}
            icon={ShieldAlert}
            color="amber"
          />
          <StatsCard
            title="Live Sessions"
            value={stats?.activeSessions ?? '—'}
            subtitle="In-progress right now"
            icon={Activity}
            color="red"
          />
        </div>
      </section>

      {/* Recent Tests Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Recent Examinations</h2>
          <span className="text-xs font-bold text-indigo-600">{exams.filter((e) => e.status === 'Active' || e.status === 'Scheduled').length} Active & Scheduled</span>
        </div>

        {loadError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">{loadError}</div>}
        {!isLoadingExams && !loadError && exams.length === 0 && (
          <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-sm text-slate-500 text-center">
            No exams yet. Use <strong>Create Test</strong> to build and publish your first proctored exam.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <RecentTestCard key={exam.id} exam={exam} />
          ))}
        </div>
      </section>
    </div>
  );
};
