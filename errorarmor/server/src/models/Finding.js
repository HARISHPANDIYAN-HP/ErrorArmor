import mongoose from 'mongoose';

export const CATEGORIES = [
  'syntax', 'type', 'logic', 'api', 'frontend', 'backend', 'database', 'integration', 'runtime', 'dependency',
  'configuration', 'auth', 'security', 'performance', 'accessibility', 'test', 'build', 'quality',
];
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
export const VERIFICATION = ['confirmed-by-test', 'static-analysis', 'heuristic', 'ai-suggested', 'false-positive', 'resolved'];

const findingSchema = new mongoose.Schema(
  {
    scan: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ruleId: { type: String, required: true },
    checkId: String,
    fingerprint: { type: String, required: true, index: true },
    category: { type: String, enum: CATEGORIES, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true }, // kept separate from severity
    verificationStatus: { type: String, enum: VERIFICATION, required: true },
    title: { type: String, required: true },
    description: String,
    rootCause: String,
    why: String,
    suggestedFix: String,
    correctedExample: String,
    codeSnippet: String, // short, secret-redacted excerpt only (never whole files)
    filePath: String,
    line: Number,
    column: Number,
    relatedFiles: { type: [String], default: [] },
    howToReproduce: String,
    howToVerify: String,
    docsUrl: String,
    fix: { type: mongoose.Schema.Types.Mixed }, // machine-applicable single-line fix hint
    proposedPatch: {
      status: { type: String, enum: ['proposed', 'none'], default: 'none' },
      diff: String,
      note: String,
      createdAt: Date,
    },
    reviewStatus: { type: String, enum: ['open', 'reviewed', 'false-positive', 'resolved'], default: 'open' },
    feedback: [{ _id: false, helpful: Boolean, comment: String, at: Date }],
  },
  { timestamps: true }
);
findingSchema.index({ scan: 1, severity: 1, category: 1 });

export const Finding = mongoose.model('Finding', findingSchema);
