import mongoose from 'mongoose';

export const STAGES = [
  'Project received', 'File discovery', 'Language & framework detection', 'Syntax & static analysis',
  'Dependency & configuration checks', 'API & integration analysis', 'Tests & security checks',
  'Result aggregation', 'Report generation',
];

const scanSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
    stageIndex: { type: Number, default: 0 },
    options: { categories: { type: [String], default: [] } },
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,
    filesDiscovered: { type: Number, default: 0 },
    filesAnalyzed: { type: Number, default: 0 },
    findingsCount: { type: Number, default: 0 },
    technologies: { languages: [String], frameworks: [String] },
    structure: { type: mongoose.Schema.Types.Mixed },
    summary: {
      bySeverity: { type: mongoose.Schema.Types.Mixed, default: {} },
      byCategory: { type: mongoose.Schema.Types.Mixed, default: {} },
      byVerification: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    checks: [{ _id: false, id: String, name: String, category: String, status: String, note: String }],
    scannerVersions: { type: mongoose.Schema.Types.Mixed },
    errorMessage: String,
  },
  { timestamps: true }
);
scanSchema.index({ owner: 1, createdAt: -1 });

export const Scan = mongoose.model('Scan', scanSchema);
