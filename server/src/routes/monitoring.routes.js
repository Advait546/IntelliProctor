import { Router } from 'express';
import * as monitoringController from '../controllers/monitoring.controller.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// --- Student-facing: proctoring session lifecycle -------------------------
router.post('/session/start', requireRole('student'), monitoringController.startSession);
router.post('/session/:id/frame', requireRole('student'), monitoringController.submitFrame);
router.post('/session/:id/submit', requireRole('student'), monitoringController.submitSession);

// --- Admin-facing: live monitoring dashboard -------------------------------
// examCode is optional -- monitoringApi.getLiveExaminees(examCode) on the
// frontend calls `/monitoring/live/${examCode}`, but GET /monitoring/live
// (no code) also works and returns every in-progress session across all exams.
router.get('/live/:examCode?', requireRole('admin'), monitoringController.live);
router.get('/student/:id', requireRole('admin'), monitoringController.getSession);
router.get('/student/:id/incidents', requireRole('admin'), monitoringController.incidents);
router.get('/timeline', requireRole('admin'), monitoringController.timeline);
router.post('/student/:id/flag', requireRole('admin'), monitoringController.flag);

export default router;
