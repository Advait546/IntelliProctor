import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { UserCheck, Hash, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const StudentLoginPage = () => {
  const navigate = useNavigate();
  const { loginStudent } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const examCode = localStorage.getItem('student_exam_code') || "AI2026CS01";

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      prn: "2026CS014",
      name: "Aarav Sharma",
      password: "password123"
    }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      await loginStudent(examCode, data.prn, data.name, data.password);
      navigate('/student/waiting-room');
    } catch (err) {
      setError(err.message || "Credential verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Background Decorative Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-emerald-600/20 via-indigo-500/20 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight">AI Exam Portal</span>
        </div>

        <div className="text-xs font-mono font-bold text-emerald-400 bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-800">
          Exam PIN: {examCode}
        </div>
      </header>

      {/* Main Student Verification Card */}
      <main className="max-w-md w-full mx-auto z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <UserCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Student Authentication</h2>
            <p className="text-xs text-slate-400">
              Enter your University PRN / Roll Number to verify registration.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
            {/* PRN Field */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                PRN / Roll Number *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  {...register("prn", { required: "PRN is required" })}
                  placeholder="e.g. 2026CS014"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              {errors.prn && <p className="text-rose-400 text-[10px] mt-1">{errors.prn.message}</p>}
            </div>

            {/* Student Name */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Student Full Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  {...register("name", { required: "Full name is required" })}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              {errors.name && <p className="text-rose-400 text-[10px] mt-1">{errors.name.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Student Portal Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  {...register("password", { required: "Password is required" })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Join Exam Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Verifying Student Records...</span>
              ) : (
                <>
                  <span>Join Exam Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>

      <footer className="text-center text-xs text-slate-600 z-10">
        Backend Integration Ready • PostgreSQL & FastAPI Auth Schema
      </footer>
    </div>
  );
};

export default StudentLoginPage;
