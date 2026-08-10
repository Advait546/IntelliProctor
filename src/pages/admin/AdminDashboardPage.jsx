import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PlusCircle,
  BookOpenCheck,
  FileSpreadsheet,
  Video,
  Settings,
  Users,
  FileText,
  ShieldAlert,
  Activity,
  ArrowUpRight,
  Clock,
  Sparkles
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import StatusChip from '../../components/common/StatusChip';
import RiskBadge from '../../components/common/RiskBadge';
import { examService } from '../../services/examService';

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    examService.getExams().then((data) => {
      setExams(data);
      setLoading(false);
    });
  }, []);

  const actionCards = [
    {
      title: "Create Test",
      desc: "Configure test metadata, AI monitoring rules & generate question sets",
      path: "/admin/create-test",
      icon: PlusCircle,
      gradient: "from-indigo-600 to-indigo-700",
      badge: "Fast Setup"
    },
    {
      title: "Question Bank",
      desc: "Manage MCQ, True/False & Fill-in-blank question repositories",
      path: "/admin/question-bank",
      icon: BookOpenCheck,
      gradient: "from-blue-600 to-cyan-600"
    },
    {
      title: "Reports",
      desc: "Download candidate score breakdowns and security incident logs",
      path: "/admin/reports",
      icon: FileSpreadsheet,
      gradient: "from-emerald-600 to-teal-600"
    },
    {
      title: "Live Monitoring",
      desc: "Real-time student camera feeds with YOLO & MediaPipe AI proctoring",
      path: "/admin/monitoring",
      icon: Video,
      gradient: "from-rose-600 to-pink-600",
      badge: "LIVE AI"
    },
    {
      title: "Settings",
      desc: "Tune AI sensitivity thresholds, audio limits & system defaults",
      path: "/admin/settings",
      icon: Settings,
      gradient: "from-purple-600 to-violet-600"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
          {/* Kahoot-Style Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Exam Setter Command Center
              </span>
              <h2 className="text-3xl font-black tracking-tight">Hello, Dr. Sharma 👋</h2>
              <p className="text-slate-300 text-base mt-1 max-w-xl">
                "What would you like to do today?" Select an action below or monitor live student sessions.
              </p>
            </div>
          </div>

          {/* Key Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Exams</p>
                <p className="text-2xl font-black text-slate-900">{exams.length}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Candidates</p>
                <p className="text-2xl font-black text-slate-900">157</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Avg Risk Score</p>
                <p className="text-2xl font-black text-slate-900">11.8%</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Active Exams</p>
                <p className="text-2xl font-black text-emerald-600">1 Online</p>
              </div>
            </div>
          </div>

          {/* Large Action Cards (Kahoot Style Grid) */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Navigation & Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {actionCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(card.path)}
                    className="cursor-pointer p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${card.gradient} text-white flex items-center justify-center shadow-md`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        {card.badge && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-base text-slate-900 mb-1">{card.title}</h4>
                      <p className="text-xs text-slate-500 leading-snug mb-4">{card.desc}</p>
                    </div>
                    <div className="flex items-center text-xs font-bold text-indigo-600 gap-1 pt-2 border-t border-slate-100">
                      <span>Launch</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Recent Tests Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Recent Examinations</h3>
              <button
                onClick={() => navigate('/admin/create-test')}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                + New Assessment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {exam.code}
                      </span>
                      <StatusChip status={exam.status === "Active" ? "Safe" : "Warning"} />
                    </div>
                    <h4 className="font-bold text-base text-slate-900 mb-2 leading-snug">
                      {exam.title}
                    </h4>
                    <p className="text-xs text-slate-500 mb-4">{exam.subject}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl mb-4">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Candidates</span>
                        <span className="font-bold text-slate-800">{exam.studentsEnrolled} Enrolled</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Avg Score</span>
                        <span className="font-bold text-slate-800">{exam.avgScore} pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {exam.duration} mins
                    </span>
                    <button
                      onClick={() => navigate(exam.status === "Active" ? "/admin/monitoring" : "/admin/reports")}
                      className="font-bold text-indigo-600 hover:underline"
                    >
                      {exam.status === "Active" ? "Monitor Live →" : "View Analytics →"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
