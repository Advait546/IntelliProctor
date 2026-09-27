import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_EXAMS, MOCK_QUESTIONS } from '../constants/mockData';
import { examApi } from '../api/examApi';
import { questionApi } from '../api/questionApi';

const ExamContext = createContext();

export const ExamProvider = ({ children }) => {
  // Seeded with the same mock data as before so the UI never renders empty
  // while the real fetch below is in flight (or if the backend is down --
  // examApi.getExams()/questionApi.getQuestionBank() already swallow errors
  // into `[]`, so an unreachable API just means "no live data yet", not a
  // crash). Once either call resolves with actual rows, they replace the mock.
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [questionBank, setQuestionBank] = useState(MOCK_QUESTIONS);
  const [isLoadingExams, setIsLoadingExams] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [fetchedExams, fetchedBank] = await Promise.all([examApi.getExams(), questionApi.getQuestionBank()]);
      if (cancelled) return;
      if (Array.isArray(fetchedExams) && fetchedExams.length > 0) setExams(fetchedExams);
      if (Array.isArray(fetchedBank) && fetchedBank.length > 0) setQuestionBank(fetchedBank);
      setIsLoadingExams(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  // The whole "Create Test" -> "Add Questions" -> "Publish" flow stays purely
  // local (currentDraft) until this single call, which is what PublishTestPage's
  // "Publish Examination Now" button fires. It sends the complete draft --
  // including its questions -- to POST /exams in one request with
  // status: 'Active', so the exam and every question exist for real (and are
  // immediately joinable by students) the moment this resolves.
  //
  // Not awaited by its caller (PublishTestPage flips its own "Published!" UI
  // state immediately, same as before this was wired to a real API), so on
  // failure we fall back to the old purely-local behavior instead of leaving
  // the UI stuck: the draft still gets added to `exams` client-side and a
  // console warning is logged. The exam just won't actually exist server-side
  // (no real student could join it) until the admin retries with the backend
  // reachable.
  const publishCurrentExam = async () => {
    const finalExamCode = currentDraft.code || 'AI2026CS01';

    try {
      const result = await examApi.createExam({ ...currentDraft, code: finalExamCode, status: 'Active' });
      if (result?.exam) {
        setExams((prev) => [result.exam, ...prev.filter((e) => e.code !== result.exam.code)]);
        return result.exam;
      }
      throw new Error('Unexpected response from createExam');
    } catch (err) {
      console.warn('Could not publish exam to the backend, keeping it local-only for now:', err.message);
      const newExam = {
        ...currentDraft,
        id: finalExamCode,
        code: finalExamCode,
        status: 'Active',
        totalQuestions: currentDraft.questions.length,
        registeredStudents: 0,
        activeStudents: 0,
        avgScore: 0,
        avgRiskScore: 0,
        completionRate: 0
      };
      setExams((prev) => [newExam, ...prev.filter((e) => e.code !== finalExamCode)]);
      return newExam;
    }
  };

  const getExamByCode = (code) => {
    return exams.find((e) => e.code.toUpperCase() === code.toUpperCase()) || exams[0];
  };

  return (
    <ExamContext.Provider
      value={{
        exams,
        isLoadingExams,
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
