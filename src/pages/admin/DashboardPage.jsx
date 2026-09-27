import React from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, BookOpen, FileText, Eye, Settings, Users, ShieldAlert, Award, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useExam } from '../../contexts/ExamContext';
import { QuickActionCard, RecentTestCard } from '../../components/dashboard/QuickActionCard';
import { StatsCard } from '../../components/dashboard/StatsCard';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { exams } = useExam();

  const setterName = user?.name || 'Dr. Sharma';

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
            value={exams.length}
            subtitle="Generated in system"
            icon={FileText}
            color="indigo"
            trend="+12%"
          />
          <StatsCard
            title="Students Registered"
            value="263"
            subtitle="Active examinees"
            icon={Users}
            color="emerald"
            trend="+18%"
          />
          <StatsCard
            title="Average Risk Score"
            value="14.2%"
            subtitle="Low AI anomaly rate"
            icon={ShieldAlert}
            color="amber"
            trend="-3.5%"
          />
          <StatsCard
            title="Active Live Exams"
            value="1"
            subtitle="In-progress monitoring"
            icon={Activity}
            color="red"
          />
        </div>
      </section>

      {/* Recent Tests Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Recent Examinations</h2>
          <span className="text-xs font-bold text-indigo-600">{exams.length} Active & Scheduled</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <RecentTestCard key={exam.id} exam={exam} />
          ))}
        </div>
      </section>
    </div>
  );
};
