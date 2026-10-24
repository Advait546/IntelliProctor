import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { examApi } from '../api/examApi';
import { questionApi } from '../api/questionApi';
import { errorMessage } from '../api/client';
import { useAuth } from './AuthContext';

const ExamContext = createContext();

const DRAFT_KEY = 'ip_exam_draft';

const starterQuestion = () => ({
  id: `q-${Date.now()}`,
  type: 'MCQ',
  text: 'Which neural network architecture is primarily designed for sequential data?',
  optionA: 'Convolutional Neural Network (CNN)',
  optionB: 'Recurrent Neural Network (RNN / LSTM)',
  optionC: 'Generative Adversarial Network (GAN)',
  optionD: 'Multilayer Perceptron (MLP)',
  correctAnswer: 'B',
  marks: 2,
  difficulty: 'Medium',
  topic: 'Neural Networks',
});

const newDraft = () => ({
  title: 'Computer Science & AI Fundamentals',
  subject: 'Artificial Intelligence',
  duration: 60,
  instructions: 'Strict AI proctoring enabled. Stay focused on the screen.',
  negativeMarking: 0,
  shuffleQuestions: false,
  shuffleOptions: false,
  aiMonitoring: true,
  browserLock: true,
  audioMonitoring: false,
  fullscreenLock: true,
  scheduledDate: new Date().toISOString().split('T')[0],
  scheduledTime: '',
  availabilityHours: 24,
  questionSource: 'manual', // manual | csv | bank
  questions: [starterQuestion()],
  code: '',
});

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...newDraft(), ...JSON.parse(raw) } : newDraft();
  } catch {
    return newDraft();
  }
};

export const ExamProvider = ({ children }) => {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [currentDraft, setCurrentDraft] = useState(loadDraft);

  // Draft exam configuration is examiner-UI state cached locally
  // (FRONTEND_ARCHITECTURE.md section 18) until it is published.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(currentDraft));
    } catch {
      /* ignore */
    }
  }, [currentDraft]);

  const refreshExams = useCallback(async () => {
    if (!user) return;
    setIsLoadingExams(true);
    try {
      setExams(await examApi.getExams());
      setLoadError('');
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load exams'));
    } finally {
      setIsLoadingExams(false);
    }
  }, [user]);

  const refreshQuestionBank = useCallback(async () => {
    if (!user) return;
    try {
      setQuestionBank(await questionApi.getQuestionBank());
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the question bank'));
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshExams();
      refreshQuestionBank();
    } else {
      setExams([]);
      setQuestionBank([]);
    }
  }, [user, refreshExams, refreshQuestionBank]);

  const updateDraft = (fields) => setCurrentDraft((prev) => ({ ...prev, ...fields }));

  const resetDraft = () => setCurrentDraft(newDraft());

  const addQuestionToDraft = (question) =>
    setCurrentDraft((prev) => ({ ...prev, questions: [...prev.questions, { ...question, id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }] }));

  const updateDraftQuestion = (id, updatedQuestion) =>
    setCurrentDraft((prev) => ({ ...prev, questions: prev.questions.map((q) => (q.id === id ? { ...q, ...updatedQuestion } : q)) }));

  const deleteDraftQuestion = (id) => setCurrentDraft((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));

  const duplicateDraftQuestion = (id) => {
    const target = currentDraft.questions.find((q) => q.id === id);
    if (target) addQuestionToDraft({ ...target, text: `${target.text} (Copy)` });
  };

  // Client-side suggestion only; the backend validates uniqueness and stores
  // the passkey hashed (Argon2id) -- never in plaintext.
  const generateExamCode = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const rand = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    const newCode = `AI${new Date().getFullYear()}${rand}${Math.floor(100 + Math.random() * 900)}`;
    setCurrentDraft((prev) => ({ ...prev, code: newCode }));
    return newCode;
  };

  const draftPayload = (draft) => {
    let startWindow;
    if (draft.scheduledDate && draft.scheduledTime) {
      const dt = new Date(`${draft.scheduledDate}T${draft.scheduledTime}`);
      if (!Number.isNaN(dt.getTime()) && dt.getTime() > Date.now()) startWindow = dt.toISOString();
    }
    return {
      title: draft.title,
      subject: draft.subject,
      durationMinutes: Number(draft.duration) || 60,
      instructions: draft.instructions,
      code: draft.code || undefined,
      startWindow,
      availabilityHours: Number(draft.availabilityHours) || 24,
      settings: {
        negativeMarking: Number(draft.negativeMarking) || 0,
        shuffleQuestions: !!draft.shuffleQuestions,
        shuffleOptions: !!draft.shuffleOptions,
        aiMonitoring: !!draft.aiMonitoring,
        browserLock: !!draft.browserLock,
        audioMonitoring: !!draft.audioMonitoring,
        fullscreenLock: !!draft.fullscreenLock,
      },
      questions: draft.questions.map(({ id, ...q }) => q),
    };
  };

  // "Publish Examination Now": creates the exam with all its questions and
  // publishes it in one call. Throws on failure so the page can show the error.
  const publishCurrentExam = async () => {
    const result = await examApi.createExam({ ...draftPayload(currentDraft), publish: true });
    setCurrentDraft((prev) => ({ ...prev, code: result.passkey, publishedExamId: result.exam.id }));
    await refreshExams();
    return result;
  };

  const saveDraftToServer = async () => {
    const result = await examApi.createExam({ ...draftPayload(currentDraft), publish: false });
    await refreshExams();
    return result;
  };

  return (
    <ExamContext.Provider
      value={{
        exams,
        isLoadingExams,
        loadError,
        refreshExams,
        questionBank,
        setQuestionBank,
        refreshQuestionBank,
        currentDraft,
        updateDraft,
        resetDraft,
        addQuestionToDraft,
        updateDraftQuestion,
        deleteDraftQuestion,
        duplicateDraftQuestion,
        generateExamCode,
        publishCurrentExam,
        saveDraftToServer,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => useContext(ExamContext);
