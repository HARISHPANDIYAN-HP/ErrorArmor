import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/environment.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import findingRoutes from './routes/findingRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

export function createApp() {
  const app = express();
  if (env.nodeEnv === 'production') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }));
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/scans', scanRoutes);
  app.use('/api/findings', findingRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
