import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    source: {
      kind: { type: String, enum: ['zip-upload', 'demo'], default: 'zip-upload' },
      originalName: String,
      sizeBytes: Number,
      extracted: Number,
      skippedIgnored: Number,
      skippedUnsupported: Number,
      skippedLarge: Number,
    },
    technologies: { type: [String], default: [] },
    storagePath: { type: String, select: false }, // never returned to clients
  },
  { timestamps: true }
);
projectSchema.index({ owner: 1, createdAt: -1 });

export const Project = mongoose.model('Project', projectSchema);
