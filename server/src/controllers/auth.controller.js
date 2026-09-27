import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabaseClient.js';
import { signToken } from '../utils/jwt.js';
import { ApiError } from '../middleware/errorHandler.js';

// POST /api/v1/auth/admin/login  { email, password }
export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw new ApiError(400, 'Email and password are required');

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!admin) throw new ApiError(401, 'Invalid email or password');

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    const token = signToken({ sub: admin.id, role: 'admin', email: admin.email });
    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      token,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/student/login  { code, prn, name, password }
// Also accepts the "antigravity" frontend's field names: { examCode, rollNumber,
// name } with no password at all -- that UI never collects one. Exam code must
// correspond to a real exam (auto-created on the fly if it doesn't exist yet --
// see monitoring.controller.js's startSession for the same pattern). Students
// "self-register" the first time they log in with a given PRN; if a password
// is supplied, the one they choose then is what they must use on subsequent
// logins. If no password is supplied (antigravity UI), the PRN + exam code
// alone identify the student and no password check is performed.
export async function studentLogin(req, res, next) {
  try {
    const body = req.body || {};
    const code = body.code || body.examCode;
    const prn = body.prn || body.rollNumber;
    const { name, password } = body;
    if (!code || !prn) {
      throw new ApiError(400, 'Exam code and PRN/roll number are required');
    }

    let { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, code, status')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    if (examError) throw examError;
    if (!exam) {
      // The antigravity frontend's exam-creation flow doesn't call the real
      // exams API yet, so a student can arrive here with a code that was
      // never persisted. Auto-provision a minimal exam row rather than
      // blocking login -- an admin can flesh it out later from the dashboard.
      const { data: created, error: createError } = await supabase
        .from('exams')
        .insert({ code: code.toUpperCase(), title: `Exam ${code.toUpperCase()}`, status: 'Active' })
        .select('id, code, status')
        .single();
      if (createError) throw createError;
      exam = created;
    }

    const { data: existing, error: findError } = await supabase
      .from('students')
      .select('*')
      .eq('prn', prn)
      .maybeSingle();
    if (findError) throw findError;

    let student = existing;
    if (!student) {
      const password_hash = await bcrypt.hash(password || prn, 10);
      const { data: created, error: createError } = await supabase
        .from('students')
        .insert({ prn, name: name || 'Student', password_hash })
        .select()
        .single();
      if (createError) throw createError;
      student = created;
    } else if (password) {
      // Only enforce the password check when the caller actually sent one.
      const ok = await bcrypt.compare(password, student.password_hash);
      if (!ok) throw new ApiError(401, 'Invalid PRN or password');
    }

    const token = signToken({ sub: student.id, role: 'student', prn: student.prn });
    res.json({
      id: student.id,
      prn: student.prn,
      rollNumber: student.prn,
      name: student.name,
      role: 'Student',
      examCode: exam.code,
      examId: exam.id,
      token,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/verify-code/:code -- used by the antigravity frontend's
// "Enter Exam Code" screen before it lets the student proceed to login.
export async function verifyExamCode(req, res, next) {
  try {
    const code = (req.params.code || '').toUpperCase();
    if (!code) return res.json({ valid: false, error: 'Exam code is required' });

    const { data: exam, error } = await supabase
      .from('exams')
      .select('code, status')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;

    if (!exam) return res.json({ valid: false, error: 'Invalid Exam Code' });
    if (exam.status === 'Completed') {
      return res.json({ valid: false, error: 'This exam has already ended' });
    }
    res.json({ valid: true, code: exam.code });
  } catch (err) {
    next(err);
  }
}
