import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      email: "dr.sharma@university.edu",
      password: "password123",
      rememberMe: true
    }
  });

  const onSubmit = async (data) => {
    setAuthError("");
    setLoading(true);
    try {
      await loginAdmin(data.email, data.password);
      navigate('/admin/dashboard');
    } catch (err) {
      setAuthError(err.message || "Failed to log in as Exam Setter");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Exam Setter Login</h2>
          <p className="text-xs text-slate-500 mt-1">
            Access test generation, question bank, and AI monitoring control.
          </p>
        </div>

        {/* Global Error Banner */}
        {authError && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /\S+@\S+\.\S+/,
                    message: "Invalid email format"
                  }
                })}
                placeholder="setter@university.edu"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-[11px] font-semibold text-rose-500">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters"
                  }
                })}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-[11px] font-semibold text-rose-500">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600">
              <input
                type="checkbox"
                {...register("rememberMe")}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Remember me</span>
            </label>
            <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Password reset link sent to registered email!"); }} className="font-semibold text-indigo-600 hover:text-indigo-700">
              Forgot Password?
            </a>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Login to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
          Don't have an Exam Setter account?{" "}
          <a
            href="#create"
            onClick={(e) => { e.preventDefault(); alert("Setter registration request submitted to University Admin!"); }}
            className="font-bold text-indigo-600 hover:underline"
          >
            Create Account
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLoginPage;
