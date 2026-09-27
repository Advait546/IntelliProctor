import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { attachAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import monitoringRoutes from './routes/monitoring.routes.js';
import examsRoutes from './routes/exams.routes.js';
import questionsRoutes from './routes/questions.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import reportsRoutes from './routes/reports.routes.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
// Webcam frames arrive as base64 JPEGs in the request body -- Express's
// default 100kb JSON limit is far too small for that.
app.use(express.json({ limit: '15mb' }));
app.use(attachAuth);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/exams', examsRoutes);
app.use('/api/v1/question-bank', questionsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/reports', reportsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`IntelliProctor API listening on http://localhost:${env.port}`);
});
