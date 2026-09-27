import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireRole('admin'), reportsController.getReports);
router.get('/:id/download', requireRole('admin'), reportsController.downloadReportCSV);

export default router;
