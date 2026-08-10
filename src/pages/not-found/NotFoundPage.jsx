import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
        <ShieldAlert className="w-10 h-10" />
      </div>
      <h1 className="text-6xl font-black tracking-tight text-white mb-2">404</h1>
      <h2 className="text-xl font-bold text-slate-300 mb-2">Page Not Found</h2>
      <p className="text-xs text-slate-500 max-w-sm mb-6">
        The requested URL was not found on the AI Examination Portal.
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg"
      >
        <Home className="w-4 h-4" />
        <span>Return to Home</span>
      </button>
    </div>
  );
};

export default NotFoundPage;
