import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

/**
 * Displays the backend-authoritative status and suspicion score S (0-1000).
 * The badge never derives status from the score itself: ``status`` comes from
 * the backend (Critical = S >= 100 or manually flagged).
 */
export const RiskBadge = ({ status = 'Safe', riskScore = 0, showScore = true }) => {
  const styles = {
    Critical: ['bg-red-100 text-red-700 border-red-200', ShieldAlert, 'text-red-600', 'bg-red-200 text-red-800', 'Suspicious'],
    Warning: ['bg-amber-100 text-amber-800 border-amber-200', AlertTriangle, 'text-amber-600', 'bg-amber-200 text-amber-900', 'Warning'],
    Safe: ['bg-emerald-100 text-emerald-700 border-emerald-200', ShieldCheck, 'text-emerald-600', 'bg-emerald-200 text-emerald-800', 'Safe'],
  };
  const [box, Icon, iconTone, pill, label] = styles[status] || styles.Safe;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${box}`} title="Suspicion score S (0-1000). Suspicious when S >= 100.">
      <Icon className={`w-3.5 h-3.5 ${iconTone}`} />
      <span>{label}</span>
      {showScore && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${pill}`}>S={riskScore}</span>}
    </span>
  );
};
