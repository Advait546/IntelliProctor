import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Save,
  Send,
  Eye,
  Smartphone,
  BookOpen,
  Users,
  ShieldAlert,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';
import Timer from '../../components/student/Timer';
import QuestionPalette from '../../components/student/QuestionPalette';
import CameraWidget from '../../components/common/CameraWidget';
import ToastNotification from '../../components/common/ToastNotification';
import RiskBadge from '../../components/common/RiskBadge';

const ExaminationScreenPage = () => {
  const navigate = useNavigate();
  const {
    activeExam,
    examQuestions,
    userAnswers,
    markedForReview,
    visitedQuestions,
    currentQuestionIndex,
    setAnswer,
    toggleMarkForReview,
    navigateToQuestion,
    addAiWarning,
    finishExamSession
  } = useExam();

  const [activeToast, setActiveToast] = useState(null);
  const [studentFaceVisible, setStudentFaceVisible] = useState(true);
  const [studentPhoneDetected, setStudentPhoneDetected] = useState(false);
  const [studentBookDetected, setStudentBookDetected] = useState(false);
  const [studentMultiPerson, setStudentMultiPerson] = useState(false);
  const [currentRisk, setCurrentRisk] = useState(4);

  const currentQ = examQuestions[currentQuestionIndex] || examQuestions[0];
  const selectedOpt = userAnswers[currentQuestionIndex] || "";
  const isMarked = markedForReview[currentQuestionIndex];

  // Simulated non-intrusive AI warning notifications during exam (EXACT SPEC REQUIREMENT)
  useEffect(() => {
    const warningEvents = [
      { msg: "AI Proctoring Note: Please maintain head direction toward screen center.", type: "warning" },
      { msg: "YOLO Detector: Smartphone reflection scanned near desk.", type: "critical", phone: true },
      { msg: "MediaPipe Vision: Sustained side gaze detected.", type: "warning" },
      { msg: "Browser Event: Window lost focus briefly.", type: "warning" }
    ];

    let eventIdx = 0;
    const interval = setInterval(() => {
      if (Math.random() > 0.4 && eventIdx < warningEvents.length) {
        const ev = warningEvents[eventIdx % warningEvents.length];
        setActiveToast({ id: Date.now(), message: ev.msg, type: ev.type });
        addAiWarning(ev.msg);

        if (ev.phone) {
          setStudentPhoneDetected(true);
          setCurrentRisk(48);
          setTimeout(() => {
            setStudentPhoneDetected(false);
            setCurrentRisk(12);
          }, 6000);
        }

        eventIdx++;
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [addAiWarning]);

  const handleNext = () => {
    if (currentQuestionIndex < examQuestions.length - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      navigateToQuestion(currentQuestionIndex - 1);
    }
  };

  const handleSubmitExam = () => {
    if (confirm("Are you sure you want to submit your examination now?")) {
      finishExamSession();
      navigate('/student/submission');
    }
  };

  const progressPercentage = Math.round(
    ((currentQuestionIndex + 1) / examQuestions.length) * 100
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col select-none relative overflow-hidden">
      {/* Top Navigation Bar (EXACT SPEC REQUIREMENT) */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            {activeExam?.title || "Advanced AI & Neural Networks"}
          </span>
          <span className="text-xs font-mono font-bold text-indigo-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
            {activeExam?.code || "AI2026CS01"}
          </span>
        </div>

        {/* Center: Question Progress & Timer */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Question {currentQuestionIndex + 1} of {examQuestions.length}
            </span>
            <div className="w-36 h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <Timer initialMinutes={activeExam?.duration || 60} onExpire={handleSubmitExam} />
        </div>
      </header>

      {/* Main Container Layout: Left Main Section + Right Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-6 gap-6 overflow-y-auto">
        {/* Main Section */}
        <main className="flex-1 flex flex-col justify-between space-y-6">
          {/* Question Card */}
          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6 flex-1 flex flex-col justify-between">
            <div>
              {/* Question Header Tag */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-extrabold text-sm flex items-center justify-center">
                    {currentQuestionIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    Type: <strong className="text-slate-200">{currentQ.type}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                    Marks: +{currentQ.marks}
                  </span>
                  {isMarked && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Marked for Review
                    </span>
                  )}
                </div>
              </div>

              {/* Question Statement */}
              <h3 className="text-lg font-bold text-white leading-relaxed mb-6">
                {currentQ.text}
              </h3>

              {/* Options Section */}
              {currentQ.type === "MCQ" && (
                <div className="space-y-3">
                  {currentQ.options.map((opt, i) => {
                    const isSelected = selectedOpt === opt;
                    const letter = String.fromCharCode(65 + i);

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAnswer(currentQuestionIndex, opt)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center gap-4 transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-900/80 to-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 text-white font-bold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="text-sm">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === "True/False" && (
                <div className="grid grid-cols-2 gap-4">
                  {["True", "False"].map((opt) => {
                    const isSelected = selectedOpt === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(currentQuestionIndex, opt)}
                        className={`p-6 rounded-2xl border text-center font-extrabold text-base transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-500 ring-4 ring-emerald-500/20 shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === "Fill in the Blank" && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">
                    Type your answer key below:
                  </label>
                  <input
                    type="text"
                    value={selectedOpt}
                    onChange={(e) => setAnswer(currentQuestionIndex, e.target.value)}
                    placeholder="Type answer here..."
                    className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              {currentQ.type === "Subjective" && (
                <div>
                  <textarea
                    rows={5}
                    value={selectedOpt}
                    onChange={(e) => setAnswer(currentQuestionIndex, e.target.value)}
                    placeholder="Write your comprehensive technical response here..."
                    className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-sm font-medium text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Main Navigation Toolbar (Prev, Next, Mark for Review, Save, Submit) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1.5 disabled:opacity-30 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentQuestionIndex === examQuestions.length - 1}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1.5 disabled:opacity-30 transition-colors"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleMarkForReview(currentQuestionIndex)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
                    isMarked
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-purple-300'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>{isMarked ? 'Unmark Review' : 'Mark for Review'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all hover:scale-105"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Exam</span>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar (EXACT SPEC REQUIREMENT: Small Camera Feed, AI Status, Question Palette) */}
        <aside className="w-full lg:w-80 shrink-0 space-y-5">
          {/* Small Camera Feed Overlay (Avoid distracting student) */}
          <div className="bg-slate-950 rounded-3xl p-3 border border-slate-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Camera Proctor
              </span>
              <RiskBadge score={currentRisk} />
            </div>

            <CameraWidget
              studentName="You (Proctored)"
              faceVisible={studentFaceVisible}
              phoneDetected={studentPhoneDetected}
              bookDetected={studentBookDetected}
              multiplePerson={studentMultiPerson}
              compact={true}
              showOverlays={true}
              allowRealWebcam={true}
            />

            {/* AI Status Indicators */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-900 p-2 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Face:</span>
                <span className="font-bold text-emerald-400">OK</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className={`font-bold ${studentPhoneDetected ? 'text-rose-400' : 'text-slate-400'}`}>
                  {studentPhoneDetected ? 'FLAG' : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Book:</span>
                <span className="font-bold text-slate-400">None</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Head:</span>
                <span className="font-bold text-emerald-400">Center</span>
              </div>
            </div>
          </div>

          {/* Question Palette Widget */}
          <QuestionPalette
            totalQuestions={examQuestions.length}
            currentIndex={currentQuestionIndex}
            userAnswers={userAnswers}
            markedForReview={markedForReview}
            visitedQuestions={visitedQuestions}
            onSelectQuestion={navigateToQuestion}
          />
        </aside>
      </div>

      {/* Non-intrusive Toast Notification popup (EXACT SPEC REQUIREMENT) */}
      <AnimatePresence>
        {activeToast && (
          <ToastNotification
            message={activeToast.message}
            type={activeToast.type}
            onClose={() => setActiveToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExaminationScreenPage;
