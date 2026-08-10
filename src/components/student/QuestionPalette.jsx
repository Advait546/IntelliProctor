import React from 'react';

const QuestionPalette = ({
  totalQuestions,
  currentIndex,
  userAnswers,
  markedForReview,
  visitedQuestions,
  onSelectQuestion
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-slate-800">Question Palette</h4>
        <span className="text-xs font-semibold text-slate-500">
          Total: {totalQuestions}
        </span>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 border-y border-slate-100 py-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Marked for Review</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-indigo-300" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300" />
          <span>Visited</span>
        </div>
      </div>

      {/* Palette Buttons Grid */}
      <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const isCurrent = currentIndex === idx;
          const isAnswered = userAnswers[idx] !== undefined && userAnswers[idx] !== "";
          const isMarked = markedForReview[idx];
          const isVisited = visitedQuestions[idx];

          let btnBg = "bg-slate-100 text-slate-600 hover:bg-slate-200";

          if (isAnswered) {
            btnBg = "bg-emerald-500 text-white font-bold shadow-xs";
          }
          if (isMarked) {
            btnBg = "bg-purple-600 text-white font-bold shadow-xs";
          }
          if (isCurrent) {
            btnBg = "bg-indigo-600 text-white font-extrabold ring-4 ring-indigo-200 shadow-md";
          } else if (!isAnswered && !isMarked && isVisited) {
            btnBg = "bg-amber-100 text-amber-900 border border-amber-300 font-semibold";
          }

          return (
            <button
              key={idx}
              onClick={() => onSelectQuestion(idx)}
              className={`w-9 h-9 rounded-xl text-xs flex items-center justify-center transition-transform hover:scale-105 ${btnBg}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionPalette;
