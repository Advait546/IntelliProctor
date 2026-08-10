import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, User, Bell, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = ({ role = "Admin" }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link to={role === "Admin" ? "/admin/dashboard" : "/"} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
              AI Exam Portal
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/50">
                <Sparkles className="w-2.5 h-2.5" /> PROCTOR v2
              </span>
            </span>
            <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
              Secure AI-Powered Examination System
            </p>
          </div>
        </Link>

        {/* Right Section / User Info */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 text-xs font-semibold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            FastAPI + Computer Vision Connected
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                  {user.name ? user.name.charAt(0) : "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{user.name || "Dr. Sharma"}</p>
                  <p className="text-[10px] font-medium text-slate-500">{user.role || role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/admin/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
