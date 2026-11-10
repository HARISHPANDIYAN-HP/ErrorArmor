/**
 * Test execution is intentionally NOT enabled. Running uploaded project code requires an isolated sandbox
 * (container/VM, no network, CPU/memory limits). Implement `SandboxRunner.run()` for your infrastructure
 * and register it here; until then this scanner reports the check as skipped instead of faking results.
 */
export const testRunner = {
  id: 'tests',
  name: 'Test runner',
  stage: 6,
  async run(project) {
    const hasTests = project.files.some((f) => /(^|\/)(tests?|__tests__)\//.test(f.rel) || /\.(test|spec)\.[jt]sx?$/.test(f.rel));
    return {
      findings: [],
      analyzed: 0,
      checks: [{
        id: 'tests-run', name: 'Automated test execution', category: 'test', skipped: true,
        note: hasTests
          ? 'Test files were found but executing uploaded code needs an isolated sandbox, which is not configured on this server'
          : 'No test files found; sandbox execution is not configured on this server',
      }],
    };
  },
};
