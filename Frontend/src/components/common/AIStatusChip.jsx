import React from 'react';
import { UserCheck, UserX, Smartphone, BookOpen, Users, Eye } from 'lucide-react';

export const AIStatusChip = ({ type, active, label }) => {
  const configs = {
    face: {
      activeIcon: UserCheck,
      inactiveIcon: UserX,
      activeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      inactiveBg: 'bg-red-50 text-red-700 border-red-200',
      activeText: label || 'Face Visible',
      inactiveText: label || 'Face Missing',
    },
    phone: {
      activeIcon: Smartphone,
      inactiveIcon: Smartphone,
      activeBg: 'bg-red-100 text-red-800 border-red-300 font-bold animate-pulse',
      inactiveBg: 'bg-slate-100 text-slate-500 border-slate-200',
      activeText: 'Phone Detected!',
      inactiveText: 'No Phone',
    },
    book: {
      activeIcon: BookOpen,
      inactiveIcon: BookOpen,
      activeBg: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      inactiveBg: 'bg-slate-100 text-slate-500 border-slate-200',
      activeText: 'Book Detected',
      inactiveText: 'No Book',
    },
    persons: {
      activeIcon: Users,
      inactiveIcon: Users,
      activeBg: 'bg-red-100 text-red-800 border-red-300 font-bold animate-bounce',
      inactiveBg: 'bg-slate-100 text-slate-500 border-slate-200',
      activeText: 'Multiple Persons!',
      inactiveText: 'Single Person',
    },
    gaze: {
      activeIcon: Eye,
      inactiveIcon: Eye,
      activeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      inactiveBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      activeText: label || 'Gaze: Center',
      inactiveText: label || 'Gaze: Away',
    }
  };

  const config = configs[type] || configs.face;
  const Icon = active ? config.activeIcon : config.inactiveIcon;
  const bgClass = active ? config.activeBg : config.inactiveBg;
  const displayText = active ? config.activeText : config.inactiveText;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${bgClass}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{displayText}</span>
    </div>
  );
};
