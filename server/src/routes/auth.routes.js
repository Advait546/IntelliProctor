import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/admin/login', authController.adminLogin);
// The antigravity frontend calls this same admin login "setter" login --
// same controller, just a different URL the UI happens to call.
router.post('/setter/login', authController.adminLogin);
router.post('/student/login', authController.studentLogin);
router.get('/verify-code/:code', authController.verifyExamCode);

export default router;
