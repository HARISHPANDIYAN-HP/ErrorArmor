// DEMONSTRATION DATA ONLY - shown on the landing page and /sample. Real scans never use this file.
export const sampleReport = {
  project: 'student-portal (demo)',
  summary: { filesAnalyzed: 42, confirmedFailures: 3, staticFindings: 8, suspectedLogic: 2, warnings: 5, passed: 18 },
  findings: [
    { id: 's1', title: 'Potential API route mismatch', severity: 'medium', category: 'api', verification: 'heuristic', confidence: 0.8, file: 'frontend/src/api/students.js', line: 24, why: 'Frontend calls GET /api/students but the backend declares GET /api/student.', fix: 'Align the endpoint path on both sides and verify with an integration test.' },
    { id: 's2', title: 'Possible undefined property access', severity: 'medium', category: 'logic', verification: 'heuristic', confidence: 0.6, file: 'frontend/src/pages/Grades.jsx', line: 58, why: 'student.profile.avatar is read before profile is guaranteed to exist.', fix: 'Use optional chaining: student.profile?.avatar.' },
    { id: 's3', title: 'Environment variable API_TOKEN is not declared in .env.example', severity: 'medium', category: 'configuration', verification: 'static-analysis', confidence: 0.8, file: 'backend/services/mail.js', line: 12, why: 'The variable is used in code but missing from the example env file.', fix: 'Add API_TOKEN= to .env.example.' },
    { id: 's4', title: 'Dependency "moment" appears unused', severity: 'info', category: 'dependency', verification: 'heuristic', confidence: 0.6, file: 'package.json', line: null, why: 'No import of this package was found.', fix: 'Run npm uninstall moment if it is really unused.' },
    { id: 's5', title: 'API requests without visible error handling', severity: 'low', category: 'api', verification: 'heuristic', confidence: 0.55, file: 'frontend/src/api/courses.js', line: 9, why: 'No try/catch or .catch() found around fetch calls.', fix: 'Wrap awaited calls in try/catch and show an error message.' },
  ],
};
