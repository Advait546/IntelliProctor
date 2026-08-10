import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ label = "Loading data...", size = "md" }) => {
  const iconSizes = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-4 h-4" : "w-7 h-7";

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <Loader2 className={`${iconSizes} text-indigo-600 animate-spin`} />
      {label && <p className="text-xs font-medium text-slate-500">{label}</p>}
    </div>
  );
};

export default LoadingSpinner;
