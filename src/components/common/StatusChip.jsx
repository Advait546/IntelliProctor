import React from 'react';

const StatusChip = ({ status, className = "" }) => {
  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let dotStyle = "bg-emerald-500";

  if (status === "Warning") {
    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
    dotStyle = "bg-amber-500";
  } else if (status === "Critical") {
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
    dotStyle = "bg-rose-500";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${badgeStyle} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotStyle}`} />
      {status}
    </span>
  );
};

export default StatusChip;
