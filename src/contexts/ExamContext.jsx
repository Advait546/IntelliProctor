import React, { createContext, useContext, useState } from 'react';
import { INITIAL_QUESTIONS } from '../constants/mockData';

const ExamContext = createContext(null);

export const ExamProvider = ({ children }) => {
  const [activeExam, setActiveExam] = useState(null);
  const [examQuestions, setExamQuestions] = useState(INITIAL_QUESTIONS);
  const [userAnswers, setUserAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState({ 0: true });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [aiWarningCount, setAiWarningCount] = useState(0);
  const [recentWarnings, setRecentWarnings] = useState([]);
  const [submissionResult, setSubmissionResult] = useState(null);

  const startExamSession = (exam, questions) => {
    setActiveExam(exam);
    setExamQuestions(questions && questions.length > 0 ? questions : INITIAL_QUESTIONS);
    setUserAnswers({});
    setMarkedForReview({});
    setVisitedQuestions({ 0: true });
    setCurrentQuestionIndex(0);
    setAiWarningCount(0);
    setRecentWarnings([]);
    setSubmissionResult(null);
  };

  const setAnswer = (questionIndex, answer) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
  };

  const toggleMarkForReview = (questionIndex) => {
    setMarkedForReview((prev) => ({
      ...prev,
      [questionIndex]: !prev[questionIndex]
    }));
  };

  const navigateToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setVisitedQuestions((prev) => ({ ...prev, [index]: true }));
  };

  const addAiWarning = (message) => {
    setAiWarningCount((prev) => prev + 1);
    const newWarning = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      text: message
    };
    setRecentWarnings((prev) => [newWarning, ...prev].slice(0, 5));
  };

  const finishExamSession = () => {
    const total = examQuestions.length;
    let attempted = 0;
    Object.keys(userAnswers).forEach((key) => {
      if (userAnswers[key] !== undefined && userAnswers[key] !== "") {
        attempted++;
      }
    });

    const result = {
      examTitle: activeExam?.title || "Examination",
      examCode: activeExam?.code || "AI2026CS01",
      submissionTime: new Date().toLocaleString(),
      totalQuestions: total,
      attemptedCount: attempted,
      skippedCount: total - attempted,
      incidentsCount: aiWarningCount,
      answers: userAnswers
    };

    setSubmissionResult(result);
    return result;
  };

  return (
    <ExamContext.Provider
      value={{
        activeExam,
        examQuestions,
        userAnswers,
        markedForReview,
        visitedQuestions,
        currentQuestionIndex,
        aiWarningCount,
        recentWarnings,
        submissionResult,
        startExamSession,
        setAnswer,
        toggleMarkForReview,
        navigateToQuestion,
        addAiWarning,
        finishExamSession
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) throw new Error('useExam must be used within an ExamProvider');
  return context;
};
