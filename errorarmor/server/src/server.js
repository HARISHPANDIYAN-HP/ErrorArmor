import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from './config/environment.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { purgeExpired, recoverInterruptedScans } from './services/scanService.js';

process.on('unhandledRejection', (e) => logger.error('Unhandled rejection', { error: e?.message }));

async function main() {
  fs.mkdirSync(env.storageDir, { recursive: true });
  await connectDatabase();
  await recoverInterruptedScans();
  purgeExpired().catch((e) => logger.error('Retention purge failed', { error: e.message }));
  const timer = setInterval(() => purgeExpired().catch(() => {}), 6 * 3600 * 1000);
  const server = createApp().listen(env.port, () => logger.info(`ErrorArmor API listening on http://localhost:${env.port}`));
  const stop = async () => { clearInterval(timer); server.close(); await mongoose.disconnect(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => { logger.error('Failed to start', { error: e.message }); process.exit(1); });
