import { supabase } from '../config/supabaseClient.js';
import { ApiError } from '../middleware/errorHandler.js';

function generateExamCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const randomNumbers = Math.floor(100 + Math.random() * 900);
  return `AI${new Date().getFullYear()}${randomLetters}${randomNumbers}`;
}

// The antigravity CreateTestPage/PublishTestPage flow keeps a draft entirely
// client-side (ExamContext.currentDraft) and only ever calls the backend once,
// on the final "Publish" click -- see ExamContext.publishCurrentExam. So this
// maps a real DB row back into the same camelCase shape that context used to
// synthesize locally, keeping every existing page (RecentTestCard, ReportsPage,
// etc.) working unchanged.
function toApiExam(row) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    duration: row.duration,
    totalQuestions: row.total_questions,
    totalMarks: row.total_marks,
    passingScore: row.passing_score,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    setter: row.setter,
    status: row.status,
    code: row.code,
    registeredStudents: row.students_enrolled,
    // These three are historically "at a glance" numbers on the exam card --
    // real per-exam analytics now live in GET /reports, which computes them
    // from actual exam_sessions rather than storing a stale snapshot here.
    activeStudents: 0,
    avgScore: 0,
    avgRiskScore: 0,
    completionRate: 0,
    instructions: row.instructions,
    settings: row.settings,
    createdAt: row.created_at,
  };
}

async function insertQuestionsForExam(examId, questions) {
  if (!Array.isArray(questions) || questions.length === 0) return { totalQuestions: 0, totalMarks: 0 };

  const rows = questions.map((q) => ({
    type: q.type || 'MCQ',
    text: q.text || '',
    // QuestionCreationPage/QuestionBankPage use flat optionA-D fields rather
    // than an array -- collapse them into the schema's options jsonb array.
    options: [q.optionA, q.optionB, q.optionC, q.optionD].filter((o) => o !== undefined),
    correct_answer: q.correctAnswer ?? null,
    marks: Number(q.marks) || 2,
    difficulty: q.difficulty || 'Medium',
    topic: q.topic || null,
  }));

  const { data: inserted, error: insertError } = await supabase.from('questions').insert(rows).select('id, marks');
  if (insertError) throw insertError;

  const links = inserted.map((row, index) => ({ exam_id: examId, question_id: row.id, position: index }));
  const { error: linkError } = await supabase.from('exam_questions').insert(links);
  if (linkError) throw linkError;

  const totalMarks = inserted.reduce((sum, row) => sum + (row.marks || 0), 0);
  return { totalQuestions: inserted.length, totalMarks };
}

// POST /api/v1/exams  (admin)  { ...examData, questions?: [...], status?: 'Scheduled'|'Active' }
// Used both for a plain "create" (status defaults to 'Scheduled') and, by the
// antigravity frontend's single "Publish Examination Now" button, as a
// one-shot "create this exam, its questions, and go live" call in one request.
export async function createExam(req, res, next) {
  try {
    const body = req.body || {};
    const code = (body.code || generateExamCode()).toUpperCase();

    const { data: exam, error } = await supabase
      .from('exams')
      .insert({
        code,
        title: body.title || `Exam ${code}`,
        subject: body.subject || null,
        duration: Number(body.duration) || 60,
        scheduled_date: body.scheduledDate || null,
        scheduled_time: body.scheduledTime || null,
        setter: req.auth?.email || null,
        status: body.status || 'Scheduled',
        instructions: body.instructions ?? [],
        settings: {
          negativeMarking: body.negativeMarking,
          shuffleQuestions: body.shuffleQuestions,
          shuffleOptions: body.shuffleOptions,
          aiMonitoring: body.aiMonitoring,
          browserLock: body.browserLock,
          audioMonitoring: body.audioMonitoring,
          fullscreenLock: body.fullscreenLock,
        },
      })
      .select()
      .single();
    if (error) throw error;

    const { totalQuestions, totalMarks } = await insertQuestionsForExam(exam.id, body.questions);

    let finalExam = exam;
    if (totalQuestions > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('exams')
        .update({ total_questions: totalQuestions, total_marks: totalMarks })
        .eq('id', exam.id)
        .select()
        .single();
      if (updateError) throw updateError;
      finalExam = updated;
    }

    res.status(201).json({ success: true, exam: toApiExam(finalExam) });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/exams  (admin)
export async function getExams(req, res, next) {
  try {
    const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data.map(toApiExam));
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/exams/code/:code -- public (same trust level as /auth/verify-code)
export async function getExamByCode(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('code', (req.params.code || '').toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, 'Exam not found');
    res.json(toApiExam(data));
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/exams/:examId/publish  (admin)  { status?, code?, ...settingsPatch }
export async function publishExam(req, res, next) {
  try {
    const { data: exam, error: findError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', req.params.examId)
      .maybeSingle();
    if (findError) throw findError;
    if (!exam) throw new ApiError(404, 'Exam not found');

    const body = req.body || {};
    const { code, status, ...settingsPatch } = body;

    const { data: updated, error: updateError } = await supabase
      .from('exams')
      .update({
        status: status || 'Active',
        code: code ? code.toUpperCase() : exam.code,
        settings: { ...(exam.settings || {}), ...settingsPatch },
      })
      .eq('id', exam.id)
      .select()
      .single();
    if (updateError) throw updateError;

    res.json({ success: true, publishedAt: new Date().toISOString(), exam: toApiExam(updated) });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/exams/:examId/questions  (admin)  { questions: [...] }
export async function saveQuestions(req, res, next) {
  try {
    const { data: exam, error: findError } = await supabase
      .from('exams')
      .select('id, total_questions, total_marks')
      .eq('id', req.params.examId)
      .maybeSingle();
    if (findError) throw findError;
    if (!exam) throw new ApiError(404, 'Exam not found');

    const { questions } = req.body || {};
    const { totalQuestions, totalMarks } = await insertQuestionsForExam(exam.id, questions);

    const { error: updateError } = await supabase
      .from('exams')
      .update({
        total_questions: (exam.total_questions || 0) + totalQuestions,
        total_marks: (exam.total_marks || 0) + totalMarks,
      })
      .eq('id', exam.id);
    if (updateError) throw updateError;

    res.status(201).json({ success: true, count: totalQuestions });
  } catch (err) {
    next(err);
  }
}
