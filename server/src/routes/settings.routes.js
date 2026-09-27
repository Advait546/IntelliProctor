import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireRole('admin'), settingsController.getSettings);
router.put('/', requireRole('admin'), settingsController.updateSettings);

export default router;
