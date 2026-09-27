import React from 'react';
import { HelpCircle, CheckCircle2, Award } from 'lucide-react';

export const QuestionCard = ({
  question,
  questionNumber = 1,
  totalQuestions = 15,
  selectedAnswer = '',
  onSelectAnswer = () => {}
}) => {
  if (!question) return null;

  const renderOptions = () => {
    if (question.type === 'MCQ') {
      const options = [
        { key: 'A', text: question.optionA },
        { key: 'B', text: question.optionB },
        { key: 'C', text: question.optionC },
        { key: 'D', text: question.optionD },
      ].filter((opt) => opt.text && opt.text.trim() !== '');

      return (
        <div className="space-y-3 mt-6">
          {options.map((opt) => {
            const isSelected = selectedAnswer === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onSelectAnswer(opt.key)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 ${
                  isSelected
                    ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 shadow-sm ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {opt.key}
                </div>
                <div className="text-sm font-medium pt-1 flex-1 leading-relaxed">{opt.text}</div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === 'TrueFalse') {
      const options = [
        { key: 'A', text: 'True' },
        { key: 'B', text: 'False' },
      ];

      return (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {options.map((opt) => {
            const isSelected = selectedAnswer === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onSelectAnswer(opt.key)}
                className={`p-6 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-950 ring-2 ring-indigo-500 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
                }`}
              >
                <span className="text-lg font-bold">{opt.text}</span>
                {isSelected && <span className="text-xs font-semibold text-indigo-600">Selected</span>}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === 'FillBlank') {
      return (
        <div className="mt-6">
          <label className="block text-xs font-semibold text-slate-600 mb-2">Type your answer below:</label>
          <input
            type="text"
            value={selectedAnswer}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Enter answer word or phrase..."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium"
          />
        </div>
      );
    }

    if (question.type === 'Subjective') {
      return (
        <div className="mt-6">
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            Detailed Explanation Answer (Future AI Auto-Grading Placeholder):
          </label>
          <textarea
            rows={5}
            value={selectedAnswer}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Type your structured answer here..."
            className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium resize-none"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
      {/* Question Header Meta */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold uppercase">
            {question.type}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            {question.marks || 2} Marks
          </span>
          {question.difficulty && (
            <span className="font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              {question.difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Question Body Text */}
      <div className="mt-6">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug flex items-start gap-3">
          <HelpCircle className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
          <span>{question.text}</span>
        </h2>
      </div>

      {/* Render Options */}
      {renderOptions()}
    </div>
  );
};
