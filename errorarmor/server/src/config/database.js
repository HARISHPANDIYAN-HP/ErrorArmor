import mongoose from 'mongoose';
import { env } from './environment.js';
import { logger } from '../utils/logger.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  logger.info('MongoDB connected');
}
