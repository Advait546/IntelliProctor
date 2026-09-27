import { supabase } from '../config/supabaseClient.js';
import { ApiError } from '../middleware/errorHandler.js';
import { applyDetection } from '../utils/risk.js';
import { env } from '../config/env.js';

// Real sessions have no photo -- the antigravity frontend's StudentLiveCard /
// StudentDetailPage render <img src={student.avatar}>, so this gives every
// real session a stable, deterministic placeholder rather than leaving the
// <img> broken. Not a real webcam snapshot -- just an initials avatar.
function placeholderAvatar(name) {
  const initials = (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(initials || '?')}`;
}

function toApiSession(row) {
  return {
    id: row.id,
    examId: row.exam_id,
    name: row.student_name,
    prn: row.student_prn,
    // `rollNumber` is what the antigravity frontend's StudentLiveCard /
    // StudentDetailPage / LiveMonitoringPage search box actually read --
    // `prn` above is kept for the original ai-exam-portal frontend shape.
    rollNumber: row.student_prn,
    avatar: placeholderAvatar(row.student_name),
    currentQuestion: null,
    riskScore: row.risk_score,
    status: row.status,
    faceVisible: row.face_visible,
    phoneDetected: row.phone_detected,
    bookDetected: row.book_detected,
    // Both names are populated: `multiplePerson` matches the original
    // ai-exam-portal frontend, `multiplePersons` (plural) matches the
    // antigravity-branch frontend's ProctoringContext/CameraWidget.
    multiplePerson: row.multiple_person,
    multiplePersons: row.multiple_person,
    headPose: row.head_pose || { pitch: 0, yaw: 0, roll: 0 },
    gazeDirection: row.gaze_direction || 'Center',
    eyeGaze: row.face_visible ? 'Screen Focus' : 'Off Screen',
    lastIncident: row.last_incident,
    warningCount: row.warning_count,
    cameraActive: row.camera_active,
    micActive: row.mic_active,
    ipAddress: row.ip_address,
    browser: row.browser,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
  };
}

let settingsCache = { value: null, fetchedAt: 0 };
async function getSettings() {
  if (Date.now() - settingsCache.fetchedAt < 30_000 && settingsCache.value) {
    return settingsCache.value;
  }
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (error) throw error;
  settingsCache = { value: data, fetchedAt: Date.now() };
  return data;
}

// Best-effort call to the Python proctoring service to drop a session's
// per-session temporal-filter state (see proctoring-service/app/detector.py's
// end_session). Never allowed to fail the caller's request -- worst case the
// service holds onto a little state for an already-finished session until it
// restarts.
async function endProctorSession(sessionId) {
  try {
    await fetch(`${env.proctorServiceUrl}/session/${sessionId}`, { method: 'DELETE' });
  } catch {
    // Proctoring microservice unreachable -- nothing to do, the session is
    // ending on the Node/Supabase side regardless.
  }
}

// POST /api/v1/monitoring/session/start  (student)
// { examId } (original frontend) or { examCode } (antigravity frontend) ->
// creates the exam_sessions row that frame uploads and admin monitoring both
// key off of.
export async function startSession(req, res, next) {
  try {
    const { examId, examCode, ipAddress, browser } = req.body || {};
    if (!examId && !examCode) throw new ApiError(400, 'examId or examCode is required');
    if (!req.auth || req.auth.role !== 'student') throw new ApiError(401, 'Student login required');

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', req.auth.sub)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new ApiError(404, 'Student not found');

    let resolvedExamId = examId;
    if (!resolvedExamId) {
      const code = examCode.toUpperCase();
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (examError) throw examError;

      if (exam) {
        resolvedExamId = exam.id;
      } else {
        // Same auto-provisioning as studentLogin -- the antigravity frontend
        // doesn't create exams via the real API yet, so don't 404 here.
        const { data: created, error: createError } = await supabase
          .from('exams')
          .insert({ code, title: `Exam ${code}`, status: 'Active' })
          .select('id')
          .single();
        if (createError) throw createError;
        resolvedExamId = created.id;
      }
    }

    const { data: session, error } = await supabase
      .from('exam_sessions')
      .insert({
        exam_id: resolvedExamId,
        student_prn: student.prn,
        student_name: student.name,
        ip_address: ipAddress || req.ip,
        browser: browser || req.headers['user-agent'] || null,
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json(toApiSession(session));
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/monitoring/session/:id/frame  (student)
// { imageBase64 } -> forwards the frame to the Python proctoring service,
// persists the resulting risk/incident state, and returns it so the
// CameraWidget can update its overlay immediately.
export async function submitFrame(req, res, next) {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) throw new ApiError(400, 'imageBase64 is required');

    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new ApiError(404, 'Session not found');
    if (session.submitted_at) throw new ApiError(409, 'Session already submitted');

    let detection;
    try {
      const resp = await fetch(`${env.proctorServiceUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // session_id keys the Python service's per-session temporal filter
        // (proctoring-service/app/detector.py) so one student's sustained
        // phone/book detections can't debounce-carry into another student's
        // frames when many exams run concurrently.
        body: JSON.stringify({ image_base64: imageBase64, session_id: session.id }),
      });
      if (!resp.ok) throw new Error(`Proctoring service responded ${resp.status}`);
      detection = await resp.json();
    } catch (err) {
      // Proctoring microservice unreachable/slow: don't fail the exam over it,
      // just skip this frame and tell the caller so it can retry later.
      return res.status(202).json({ skipped: true, reason: err.message });
    }

    const settings = await getSettings();
    const update = applyDetection(session, detection, settings);

    const { data: updatedSession, error: updateError } = await supabase
      .from('exam_sessions')
      .update({
        risk_score: update.riskScore,
        status: update.status,
        warning_count: update.warningCount,
        last_incident: update.lastIncident,
        face_visible: update.faceVisible,
        multiple_person: update.multiplePerson,
        phone_detected: update.phoneDetected,
        book_detected: update.bookDetected,
        head_pose: update.headPose,
        gaze_direction: update.gazeDirection,
      })
      .eq('id', session.id)
      .select()
      .single();
    if (updateError) throw updateError;

    if (update.incidents.length > 0) {
      const rows = update.incidents.map((i) => ({ session_id: session.id, ...toDbIncident(i) }));
      const { error: incidentError } = await supabase.from('incidents').insert(rows);
      if (incidentError) throw incidentError;
    }

    await supabase.from('risk_log').insert({ session_id: session.id, risk: update.riskScore });

    res.json({
      session: toApiSession(updatedSession),
      alerts: update.incidents.map((i) => i.type),
    });
  } catch (err) {
    next(err);
  }
}

function toDbIncident(i) {
  return {
    type: i.type,
    confidence: i.confidence,
    severity: i.severity,
    details: i.details,
  };
}

// POST /api/v1/monitoring/session/:id/submit  (student)
export async function submitSession(req, res, next) {
  try {
    const { answers, score } = req.body || {};
    const { data, error } = await supabase
      .from('exam_sessions')
      .update({ answers: answers || {}, score: score ?? null, submitted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    // Best-effort, non-blocking: drop this session's temporal-filter state on
    // the Python side now that no more frames will arrive for it.
    endProctorSession(req.params.id);

    res.json(toApiSession(data));
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/monitoring/live  (admin) -- all sessions currently in progress
// GET /api/v1/monitoring/live/:examCode  -- only that exam's in-progress sessions
// (the antigravity frontend's monitoringApi.getLiveExaminees always calls the
// second form; the route also accepts no code, for a global live view).
export async function live(req, res, next) {
  try {
    let examId;
    if (req.params.examCode) {
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('id')
        .eq('code', req.params.examCode.toUpperCase())
        .maybeSingle();
      if (examError) throw examError;
      // Unknown exam code: no sessions can belong to it, return an empty
      // list rather than 404ing (the frontend polls this every few seconds
      // and shouldn't have to special-case a transient/typo'd code).
      if (!exam) return res.json([]);
      examId = exam.id;
    }

    let query = supabase.from('exam_sessions').select('*').is('submitted_at', null);
    if (examId) query = query.eq('exam_id', examId);

    const { data, error } = await query.order('started_at', { ascending: false });
    if (error) throw error;
    res.json(data.map(toApiSession));
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/monitoring/student/:id  (admin) -- :id is a session id
export async function getSession(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, 'Session not found');
    res.json(toApiSession(data));
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/monitoring/student/:id/incidents  (admin)
export async function incidents(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('session_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json(
      data.map((i) => ({
        id: i.id,
        timestamp: new Date(i.created_at).toLocaleTimeString(),
        studentId: i.session_id,
        type: i.type,
        confidence: i.confidence,
        severity: i.severity,
        details: i.details,
      }))
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/monitoring/timeline  (admin) -- average risk across all
// sessions, bucketed to the minute, for the last 2 hours.
export async function timeline(req, res, next) {
  try {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('risk_log')
      .select('risk, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const buckets = new Map();
    for (const row of data) {
      const time = new Date(row.created_at).toISOString().slice(11, 16); // HH:MM
      const bucket = buckets.get(time) || { total: 0, count: 0 };
      bucket.total += row.risk;
      bucket.count += 1;
      buckets.set(time, bucket);
    }

    const result = Array.from(buckets.entries()).map(([time, { total, count }]) => ({
      time,
      risk: Math.round(total / count),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/monitoring/student/:id/flag  (admin)
export async function flag(req, res, next) {
  try {
    const { reason } = req.body || {};
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new ApiError(404, 'Session not found');

    const { error: updateError } = await supabase
      .from('exam_sessions')
      .update({
        status: 'Critical',
        risk_score: Math.min(100, session.risk_score + 30),
        warning_count: session.warning_count + 1,
        last_incident: reason || 'Manually flagged by proctor',
      })
      .eq('id', session.id);
    if (updateError) throw updateError;

    await supabase.from('incidents').insert({
      session_id: session.id,
      type: reason || 'Manual Proctor Flag',
      confidence: '100%',
      severity: 'Critical',
      details: 'Flagged directly by live invigilator.',
    });

    res.json({ success: true, message: `Student flagged: ${reason || 'Manual flag'}` });
  } catch (err) {
    next(err);
  }
}
