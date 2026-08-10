import React, { useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastNotification = ({
  message,
  type = "warning", // warning, critical, info, success
  onClose,
  duration = 4000
}) => {
  useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  let icon = <AlertTriangle className="w-5 h-5 text-amber-500" />;
  let border = "border-amber-200 bg-amber-50/95 text-amber-900";

  if (type === "critical") {
    icon = <ShieldAlert className="w-5 h-5 text-rose-600" />;
    border = "border-rose-300 bg-rose-50/95 text-rose-900 shadow-rose-500/10";
  } else if (type === "success") {
    icon = <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    border = "border-emerald-200 bg-emerald-50/95 text-emerald-900";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`fixed top-5 right-5 z-50 max-w-sm w-full p-4 rounded-2xl border shadow-xl backdrop-blur-md flex items-start gap-3 ${border}`}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 text-xs">
        <p className="font-bold text-sm mb-0.5">
          {type === "critical" ? "Security Alert" : type === "warning" ? "AI Monitoring Warning" : "Notification"}
        </p>
        <p className="leading-snug text-slate-700">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 p-1 hover:bg-slate-200/50 rounded-lg text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

export default ToastNotification;
