import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useProctoring } from '../../contexts/ProctoringContext';

export const ToastNotification = () => {
  const { activeNotifications } = useProctoring();

  const getIcon = (type) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />;
    }
  };

  const getStyle = (type) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900 shadow-red-100';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-100';
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100';
      default:
        return 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-indigo-100';
    }
  };

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {activeNotifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md ${getStyle(
              notif.type
            )}`}
          >
            {getIcon(notif.type)}
            <div className="flex-1 text-xs">
              <div className="font-semibold text-sm capitalize">{notif.type} Event</div>
              <p className="mt-0.5 opacity-90">{notif.message}</p>
              <div className="mt-1 text-[10px] opacity-60">{notif.time}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
