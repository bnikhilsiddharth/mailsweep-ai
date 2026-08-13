import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { connectDB } from './config/database';
import { logger } from './utils/logger';
import { generalRateLimit } from './middleware/rateLimit';

// Routes
import authRoutes from './routes/auth';
import analysisRoutes from './routes/analysis';
import cleanupRoutes from './routes/cleanup';
import subscriptionRoutes from './routes/subscriptions';
import rulesRoutes from './routes/rules';
import insightsRoutes from './routes/insights';
import settingsRoutes from './routes/settings';

// Workers
import { runWeeklyReports } from './workers/weeklyReports';
import { runStorageSnapshots } from './workers/storageSnapshots';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'mailsweep-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/mailsweep',
    ttl: 7 * 24 * 60 * 60, // 7 days
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// Rate limiting
app.use('/api/', generalRateLimit);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Cron jobs
cron.schedule('0 9 * * 0', async () => {
  logger.info('Running weekly reports cron');
  await runWeeklyReports();
});

cron.schedule('0 */6 * * *', async () => {
  logger.info('Running storage snapshots cron');
  await runStorageSnapshots();
});

app.listen(PORT, () => {
  logger.info(`MailSweep AI Backend running on port ${PORT}`);
});

export default app;
