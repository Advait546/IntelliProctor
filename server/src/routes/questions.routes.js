import { Router } from 'express';
import multer from 'multer';
import * as questionsController from '../controllers/questions.controller.js';
import { requireRole } from '../middleware/auth.js';

// In-memory storage: question CSVs are small (a few KB-MB) and we only ever
// parse-then-discard the buffer, no need to touch disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.get('/', requireRole('admin'), questionsController.getQuestionBank);
router.post('/import-csv', requireRole('admin'), upload.single('file'), questionsController.importCSV);

export default router;
