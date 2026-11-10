import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';

const num = (v, d) => {
  if (v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/errorarmor',
  jwtSecret: process.env.JWT_SECRET || '',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  storageDir: path.resolve(process.env.STORAGE_DIR || './storage'),
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 25),
  maxFiles: num(process.env.MAX_FILES, 5000),
  maxUnzippedMb: num(process.env.MAX_UNZIPPED_MB, 150),
  scanTimeoutSec: num(process.env.SCAN_TIMEOUT_SEC, 120),
  queueConcurrency: num(process.env.QUEUE_CONCURRENCY, 2),
};

if (!env.jwtSecret) {
  if (env.nodeEnv === 'production') throw new Error('JWT_SECRET must be set in production');
  env.jwtSecret = 'dev-only-' + crypto.randomBytes(24).toString('hex');
  console.warn('[env] JWT_SECRET not set - using a temporary secret (sessions reset on restart).');
}
