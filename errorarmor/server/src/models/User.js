import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    preferences: {
      theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
      defaultCategories: { type: [String], default: ['syntax', 'logic', 'api', 'configuration', 'dependencies', 'security'] },
      aiEnabled: { type: Boolean, default: false },
      retentionDays: { type: Number, default: 30, min: 1, max: 365 },
      languages: { type: [String], default: ['javascript', 'json', 'python'] },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
