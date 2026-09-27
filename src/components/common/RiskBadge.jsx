import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

export const RiskBadge = ({ status = 'Safe', riskScore = 0, showScore = true }) => {
  if (status === 'Critical' || riskScore >= 70) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 pulse-red">
        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
        <span>Critical</span>
        {showScore && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 text-[10px]">{riskScore}%</span>}
      </span>
    );
  }

  if (status === 'Warning' || (riskScore >= 30 && riskScore < 70)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>Warning</span>
        {showScore && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px]">{riskScore}%</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
      <span>Safe</span>
      {showScore && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-[10px]">{riskScore}%</span>}
    </span>
  );
};
