import React, { createContext, useContext, useState } from 'react';
import { INITIAL_EXAMS, MOCK_QUESTIONS } from '../constants/mockData';

const ExamContext = createContext();

export const ExamProvider = ({ children }) => {
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [questionBank, setQuestionBank] = useState(MOCK_QUESTIONS);
  
  // Current active draft exam being created
  const [currentDraft, setCurrentDraft] = useState({
    title: 'Computer Science & AI Fundamentals 2026',
    subject: 'Artificial Intelligence',
    duration: 60,
    instructions: 'Strict AI proctoring enabled. Stay focused on the screen.',
    negativeMarking: 0.25,
    shuffleQuestions: true,
    shuffleOptions: true,
    aiMonitoring: true,
    browserLock: true,
    audioMonitoring: true,
    fullscreenLock: true,
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '10:00 AM',
    questionSource: 'manual', // manual | csv | bank
    questions: MOCK_QUESTIONS,
    code: 'AI2026CS01'
  });

  const updateDraft = (fields) => {
    setCurrentDraft((prev) => ({ ...prev, ...fields }));
  };

  const addQuestionToDraft = (question) => {
    setCurrentDraft((prev) => ({
      ...prev,
      questions: [...prev.questions, { ...question, id: `q-${Date.now()}` }]
    }));
  };

  const updateDraftQuestion = (id, updatedQuestion) => {
    setCurrentDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...updatedQuestion } : q))
    }));
  };

  const deleteDraftQuestion = (id) => {
    setCurrentDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== id)
    }));
  };

  const duplicateDraftQuestion = (id) => {
    const target = currentDraft.questions.find((q) => q.id === id);
    if (target) {
      const duplicated = { ...target, id: `q-${Date.now()}`, text: `${target.text} (Copy)` };
      setCurrentDraft((prev) => ({
        ...prev,
        questions: [...prev.questions, duplicated]
      }));
    }
  };

  const generateExamCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetters = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    const randomNumbers = Math.floor(100 + Math.random() * 900);
    const newCode = `AI2026${randomLetters}${randomNumbers}`;
    setCurrentDraft((prev) => ({ ...prev, code: newCode }));
    return newCode;
  };

  const publishCurrentExam = () => {
    const finalExamCode = currentDraft.code || 'AI2026CS01';
    const newExam = {
      ...currentDraft,
      id: finalExamCode,
      code: finalExamCode,
      status: 'Active',
      totalQuestions: currentDraft.questions.length,
      registeredStudents: 48,
      activeStudents: 42,
      avgScore: 84.5,
      avgRiskScore: 12.4,
      completionRate: 78
    };

    setExams((prev) => [newExam, ...prev.filter((e) => e.code !== finalExamCode)]);
    return newExam;
  };

  const getExamByCode = (code) => {
    return exams.find((e) => e.code.toUpperCase() === code.toUpperCase()) || exams[0];
  };

  return (
    <ExamContext.Provider
      value={{
        exams,
        questionBank,
        setQuestionBank,
        currentDraft,
        updateDraft,
        addQuestionToDraft,
        updateDraftQuestion,
        deleteDraftQuestion,
        duplicateDraftQuestion,
        generateExamCode,
        publishCurrentExam,
        getExamByCode,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => useContext(ExamContext);
