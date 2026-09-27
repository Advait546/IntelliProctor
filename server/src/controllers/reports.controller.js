import { supabase } from '../config/supabaseClient.js';
import { ApiError } from '../middleware/errorHandler.js';

function pct(n) {
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

async function buildExamReport(exam) {
  const { data: sessions, error: sessionsError } = await supabase
    .from('exam_sessions')
    .select('id, risk_score, score, submitted_at')
    .eq('exam_id', exam.id);
  if (sessionsError) throw sessionsError;

  const total = sessions.length;
  const submitted = sessions.filter((s) => s.submitted_at);
  const scored = submitted.filter((s) => s.score !== null && s.score !== undefined);

  const avgScorePct =
    scored.length > 0 && exam.total_marks > 0
      ? scored.reduce((sum, s) => sum + (s.score / exam.total_marks) * 100, 0) / scored.length
      : 0;
  const avgRisk = total > 0 ? sessions.reduce((sum, s) => sum + (s.risk_score || 0), 0) / total : 0;
  const completion = total > 0 ? (submitted.length / total) * 100 : 0;

  let incidentsFlagged = 0;
  if (total > 0) {
    const { count, error: incidentsError } = await supabase
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .in(
        'session_id',
        sessions.map((s) => s.id)
      );
    if (incidentsError) throw incidentsError;
    incidentsFlagged = count || 0;
  }

  return {
    id: exam.id,
    examName: exam.title,
    code: exam.code,
    date: exam.scheduled_date || (exam.created_at ? exam.created_at.slice(0, 10) : null),
    students: total,
    avgScore: pct(avgScorePct),
    avgRiskScore: pct(avgRisk),
    completionRate: pct(completion),
    incidentsFlagged,
    status: exam.status,
  };
}

// GET /api/v1/reports  (admin) -- one row per exam, computed live from
// exam_sessions/incidents rather than a stored snapshot.
export async function getReports(req, res, next) {
  try {
    const { data: exams, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const reports = await Promise.all(exams.map(buildExamReport));
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/reports/:id/download  (admin) -- CSV of per-session detail.
// :id is an exam id, or the literal "all" for ReportsPage's "Export All
// Reports" button, which combines every exam's sessions into one file.
export async function downloadReportCSV(req, res, next) {
  try {
    const reportId = req.params.id;
    // exams(code, title) relies on exam_sessions.exam_id -> exams.id (schema.sql)
    // for Supabase's embedded-resource join syntax.
    let query = supabase.from('exam_sessions').select('*, exams(code, title)').order('started_at', { ascending: true });

    let filename = 'all-exams-report.csv';
    if (reportId && reportId !== 'all') {
      const { data: exam, error: examError } = await supabase.from('exams').select('id, code').eq('id', reportId).maybeSingle();
      if (examError) throw examError;
      if (!exam) throw new ApiError(404, 'Report not found');
      query = query.eq('exam_id', exam.id);
      filename = `${exam.code}-report.csv`;
    }

    const { data: sessions, error } = await query;
    if (error) throw error;

    const header = [
      'Exam Code',
      'Exam Title',
      'Student Name',
      'PRN',
      'Status',
      'Risk Score',
      'Score',
      'Warnings',
      'Started At',
      'Submitted At',
    ];
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [header.map(csvEscape).join(',')];
    for (const s of sessions) {
      lines.push(
        [
          s.exams?.code ?? '',
          s.exams?.title ?? '',
          s.student_name,
          s.student_prn,
          s.status,
          s.risk_score,
          s.score ?? '',
          s.warning_count,
          s.started_at,
          s.submitted_at ?? '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
}
