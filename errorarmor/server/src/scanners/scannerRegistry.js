import { syntaxScanner } from './syntaxScanner.js';
import { logicScanner } from './logicScanner.js';
import { configurationScanner } from './configurationScanner.js';
import { dependencyScanner } from './dependencyScanner.js';
import { apiScanner } from './apiScanner.js';
import { securityScanner } from './securityScanner.js';
import { testRunner } from './testRunner.js';

/** `option` is the user-facing category checkbox that enables each scanner. */
export const SCANNERS = [
  { option: 'syntax', scanner: syntaxScanner },
  { option: 'logic', scanner: logicScanner },
  { option: 'configuration', scanner: configurationScanner },
  { option: 'dependencies', scanner: dependencyScanner },
  { option: 'api', scanner: apiScanner },
  { option: 'security', scanner: securityScanner },
  { option: 'tests', scanner: testRunner },
];
export const SCAN_OPTIONS = SCANNERS.map((s) => s.option);

export const scannerForRule = (ruleId) => {
  const prefix = ruleId.split('-')[0];
  const map = { SYNTAX: 'syntax', LOGIC: 'logic', CONFIG: 'configuration', DEP: 'dependencies', API: 'api', SEC: 'security' };
  return SCANNERS.find((s) => s.option === map[prefix]);
};
