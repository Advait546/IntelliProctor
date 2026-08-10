import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ShieldCheck, Bookmark, CheckCircle2, ArrowLeft, ArrowRight, Save, Send, AlertTriangle } from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';
import { useProctoring } from '../../contexts/ProctoringContext';
import { useTimer } from '../../hooks/useTimer';
import { useProctoringSim } from '../../hooks/useProctoringSim';
import { QuestionCard } from '../../components/exam/QuestionCard';
import { QuestionPalette } from '../../components/exam/QuestionPalette';
import { CameraWidget } from '../../components/exam/CameraWidget';
import { RiskBadge } from '../../components/common/RiskBadge';
import { AIStatusChip } from '../../components/common/AIStatusChip';
import { ToastNotification } from '../../components/common/ToastNotification';

export const ExamScreenPage = () => {
  const navigate = useNavigate();
  const { currentDraft } = useExam();
  const { liveStudentAI } = useProctoring();

  // Activate automated simulated AI proctoring detections during exam
  useProctoringSim(true);

  const questions = currentDraft.questions;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Candidate answers state: { [questionId]: selectedOptionKey }
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [visited, setVisited] = useState({ [questions[0]?.id]: true });

  // Countdown timer (defaults to exam duration, e.g. 60 mins)
  const { formatTime } = useTimer(currentDraft.duration || 60, () => {
    handleSubmitExam();
  });

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (optKey) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optKey }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setVisited((prev) => ({ ...prev, [questions[nextIdx].id]: true }));
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleToggleMark = () => {
    setMarkedForReview((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id]
    }));
  };

  const handleSubmitExam = () => {
    if (window.confirm("Are you sure you want to submit your examination?")) {
      const attemptedCount = Object.keys(answers).length;
      const skippedCount = questions.length - attemptedCount;
      navigate('/student/submission', {
        state: {
          attemptedCount,
          skippedCount,
          totalQuestions: questions.length,
          submissionTime: new Date().toLocaleTimeString(),
          incidentsCount: liveStudentAI.warningCount
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between relative overflow-x-hidden select-none">
      
      {/* Non-intrusive Floating AI Warning Toasts Container */}
      <ToastNotification />

      {/* TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Exam Name & Code */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-tight line-clamp-1">
                {currentDraft.title}
              </h1>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                CODE: {currentDraft.code}
              </span>
            </div>
          </div>

          {/* Question Progress Bar */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-xs mx-4">
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 whitespace-nowrap">
              {currentIndex + 1}/{questions.length}
            </span>
          </div>

          {/* Countdown Timer Display */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-800 border border-slate-700 font-mono font-bold text-sm text-emerald-400">
              <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>{formatTime()}</span>
            </div>

            <button
              onClick={handleSubmitExam}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-900 transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Exam</span>
            </button>
          </div>

        </div>
      </header>

      {/* MAIN EXAM BODY CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT MAIN SECTION (3 COLS): QUESTION CARD & ACTIONS */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Question Display Card */}
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            selectedAnswer={answers[currentQuestion?.id] || ''}
            onSelectAnswer={handleSelectOption}
          />

          {/* Bottom Action Navigation Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 ${
                  currentIndex === 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={handleToggleMark}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 ${
                  markedForReview[currentQuestion?.id]
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                <span>{markedForReview[currentQuestion?.id] ? 'Marked' : 'Mark for Review'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  alert("Answer saved locally.");
                  handleNext();
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Answer</span>
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmitExam}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5"
                >
                  <span>Final Submit</span>
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR (1 COL): CAMERA FEED, AI STATUS, QUESTION PALETTE */}
        <aside className="space-y-6">
          
          {/* Small PIP Camera Feed (Non-distracting) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Proctor AI Feed
              </span>
              <RiskBadge status={liveStudentAI.status} riskScore={liveStudentAI.riskScore} />
            </div>

            {/* Small PIP Camera Widget */}
            <CameraWidget
              size="small"
              showOverlays={true}
              customState={liveStudentAI}
              compact={true}
            />

            {/* AI Status Chips */}
            <div className="flex flex-wrap gap-1 pt-1">
              <AIStatusChip type="face" active={liveStudentAI.faceVisible} />
              {liveStudentAI.phoneDetected && <AIStatusChip type="phone" active={true} />}
              {liveStudentAI.bookDetected && <AIStatusChip type="book" active={true} />}
              {liveStudentAI.multiplePersons && <AIStatusChip type="persons" active={true} />}
            </div>
          </div>

          {/* Question Palette Matrix */}
          <QuestionPalette
            questions={questions}
            currentIndex={currentIndex}
            answers={answers}
            markedForReview={markedForReview}
            visited={visited}
            onSelectQuestion={(idx) => {
              setCurrentIndex(idx);
              setVisited((prev) => ({ ...prev, [questions[idx].id]: true }));
            }}
          />

        </aside>

      </main>

    </div>
  );
};
