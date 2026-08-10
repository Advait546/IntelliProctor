import React from 'react';

const RiskBadge = ({ score, size = "md" }) => {
  let color = "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score > 35) color = "text-amber-600 bg-amber-50 border-amber-200";
  if (score > 70) color = "text-rose-600 bg-rose-50 border-rose-200";

  const sizeClasses = size === "lg" ? "px-3.5 py-1.5 text-sm font-bold" : "px-2.5 py-1 text-xs font-semibold";

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border ${color} ${sizeClasses}`}>
      <span>Risk:</span>
      <span>{score}%</span>
    </span>
  );
};

export default RiskBadge;
