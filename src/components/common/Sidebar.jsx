import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  BookOpenCheck,
  FileSpreadsheet,
  Video,
  Settings,
  Sparkles
} from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Create Test', path: '/admin/create-test', icon: PlusCircle },
    { name: 'Question Bank', path: '/admin/question-bank', icon: BookOpenCheck },
    { name: 'Reports', path: '/admin/reports', icon: FileSpreadsheet },
    { name: 'Live Monitoring', path: '/admin/monitoring', icon: Video, badge: 'LIVE' },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
          Navigation Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer Info Box */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-emerald-50 border border-indigo-100 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          YOLO + MediaPipe Ready
        </div>
        <p className="text-slate-600 text-[11px] leading-relaxed">
          AI Engine actively tracking 6 student streams with sub-second latency.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
