import React from 'react';

const SkeletonLoader = ({ count = 3, height = "h-24" }) => {
  return (
    <div className="space-y-4 w-full">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`w-full ${height} rounded-2xl bg-slate-200/70 animate-pulse border border-slate-200`}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;
