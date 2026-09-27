import { Router } from 'express';
import * as examsController from '../controllers/exams.controller.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/', requireRole('admin'), examsController.createExam);
router.get('/', requireRole('admin'), examsController.getExams);
// Public, same trust level as /auth/verify-code -- just exam metadata, no PII.
router.get('/code/:code', examsController.getExamByCode);
router.post('/:examId/publish', requireRole('admin'), examsController.publishExam);
router.post('/:examId/questions', requireRole('admin'), examsController.saveQuestions);

export default router;
