import React from 'react';
import { Bookmark } from 'lucide-react';

export const QuestionPalette = ({
  questions = [],
  currentIndex = 0,
  answers = {},
  markedForReview = {},
  visited = {},
  onSelectQuestion = () => {}
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between">
        <span>Question Palette</span>
        <span className="text-[11px] text-slate-500 font-normal">{questions.length} Questions</span>
      </h3>

      {/* Grid Palette */}
      <div className="grid grid-cols-5 gap-2 max-h-52 overflow-y-auto pr-1">
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIndex;
          const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
          const isMarked = markedForReview[q.id];
          const isVisited = visited[q.id];

          let bgClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
          if (isAnswered) {
            bgClass = 'bg-emerald-500 text-white font-bold border-emerald-600 shadow-xs';
          } else if (isMarked) {
            bgClass = 'bg-amber-500 text-white font-bold border-amber-600 shadow-xs';
          } else if (isVisited) {
            bgClass = 'bg-slate-200 text-slate-800 border-slate-300';
          }

          if (isCurrent) {
            bgClass += ' ring-2 ring-indigo-600 ring-offset-2 scale-105 z-10';
          }

          return (
            <button
              key={q.id || idx}
              onClick={() => onSelectQuestion(idx)}
              className={`relative h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center border ${bgClass}`}
            >
              {idx + 1}
              {isMarked && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white flex items-center justify-center">
                  <Bookmark className="w-1.5 h-1.5 text-amber-950 fill-amber-950" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <span className="w-3 h-3 rounded-md bg-amber-500"></span>
          <span>Marked</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <span className="w-3 h-3 rounded-md bg-slate-200"></span>
          <span>Visited</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300"></span>
          <span>Not Visited</span>
        </div>
      </div>
    </div>
  );
};
