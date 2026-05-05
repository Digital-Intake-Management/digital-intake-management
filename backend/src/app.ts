/**
 * src/app.ts
 * Express application entry point.
 * Sets up middleware, routes, and starts the server.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth';
import { patientsRouter } from './routes/patients';
import { sessionsRouter } from './routes/sessions';
import { formsRouter } from './routes/forms';
import { adminRouter } from './routes/admin';
import { reportsRouter } from './routes/reports';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { startWeeklyReportJob } from './services/reportScheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Rate limiting (disabled in test environment) ──────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/api/', limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts, please try again later.',
  });
  app.use('/api/auth/', authLimiter);
}

// ── General middleware ─────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' })); // 10mb to accommodate signature data
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/forms', formsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler (must be last) ────────────────────────────────────────
app.use(errorHandler);

// ── Start server (not in test environment) ────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 CareLink backend running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    startWeeklyReportJob();
    console.log('📅 Weekly report scheduler started');
  });
}

export default app;
