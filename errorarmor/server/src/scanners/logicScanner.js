import { parseJs, walk } from './jsParser.js';
import { makeFinding, snippetAround } from './common.js';

const VALID_TYPEOF = new Set(['undefined', 'object', 'boolean', 'number', 'bigint', 'string', 'symbol', 'function']);
const TERMINATORS = new Set(['ReturnStatement', 'ThrowStatement', 'BreakStatement', 'ContinueStatement']);
const FUNCS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function hasReturn(node) {
  let found = false;
  (function rec(n) {
    if (found || !n || typeof n.type !== 'string') return;
    if (n.type === 'ReturnStatement') { found = true; return; }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'type') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && !FUNCS.has(c.type) && rec(c));
      else if (v && typeof v.type === 'string' && !FUNCS.has(v.type)) rec(v);
    }
  })(node);
  return found;
}

export const logicScanner = {
  id: 'logic',
  name: 'Logic scanner',
  stage: 3,
  async run(project) {
    const findings = [];
    for (const f of project.byExt('.js', '.jsx', '.mjs', '.cjs')) {
      const { ast } = parseJs(project, f);
      if (!ast) continue;
      const text = project.text(f);
      const add = (node, p) => findings.push(makeFinding({
        category: 'logic', verificationStatus: 'heuristic', filePath: f.rel, line: node.loc.start.line,
        column: node.loc.start.column + 1, codeSnippet: snippetAround(text, node.loc.start.line), ...p,
        key: `${p.ruleId}:${node.loc.start.line}`,
      }));

      walk(ast, (n) => {
        if ((n.type === 'IfStatement' || n.type === 'WhileStatement') && n.test.type === 'AssignmentExpression' && n.test.operator === '=')
          add(n.test, {
            ruleId: 'LOGIC-ASSIGN-IN-CONDITION', checkId: 'logic-conditions', severity: 'medium', confidence: 0.7,
            title: 'Assignment used inside a condition', description: 'A single = assigns a value instead of comparing.',
            rootCause: 'A comparison operator (=== or ==) was probably intended.', why: 'The condition will always follow the assigned value, hiding real logic.',
            suggestedFix: 'Use === to compare. If the assignment is intentional, wrap it in an extra pair of parentheses and add a comment.',
            howToVerify: 'Write a test calling this code with both truthy and falsy inputs and check which branch runs.',
          });
        if (n.type === 'BinaryExpression' && ['==', '===', '!=', '!=='].includes(n.operator) &&
          [n.left, n.right].some((s) => s.type === 'Identifier' && s.name === 'NaN'))
          add(n, {
            ruleId: 'LOGIC-NAN-COMPARE', checkId: 'logic-conditions', severity: 'high', confidence: 0.95, verificationStatus: 'static-analysis',
            title: 'Comparison with NaN is always false', description: 'NaN is never equal to anything, including itself.',
            rootCause: 'Using == or === to test for NaN.', why: 'The check can never succeed, so invalid numbers slip through.',
            suggestedFix: 'Use Number.isNaN(value).', correctedExample: 'if (Number.isNaN(value)) { /* handle invalid number */ }',
            docsUrl: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN',
          });
        if (n.type === 'BinaryExpression' && ['==', '===', '!=', '!=='].includes(n.operator)) {
          const [a, b] = [n.left, n.right];
          const t = a.type === 'UnaryExpression' && a.operator === 'typeof' ? b : b.type === 'UnaryExpression' && b.operator === 'typeof' ? a : null;
          if (t && t.type === 'Literal' && typeof t.value === 'string' && !VALID_TYPEOF.has(t.value))
            add(n, {
              ruleId: 'LOGIC-TYPEOF-TYPO', checkId: 'logic-conditions', severity: 'medium', confidence: 0.9, verificationStatus: 'static-analysis',
              title: `typeof compared with invalid string "${t.value}"`, description: 'typeof only returns a fixed set of strings.',
              rootCause: 'Likely a typo in the type name.', why: 'The comparison is always false (or always true for !==).',
              suggestedFix: `Use one of: ${[...VALID_TYPEOF].join(', ')}.`,
            });
        }
        if (n.type === 'ForStatement' && n.test?.type === 'BinaryExpression' && n.test.operator === '<=' &&
          n.test.right.type === 'MemberExpression' && n.test.right.property?.name === 'length')
          add(n.test, {
            ruleId: 'LOGIC-OFF-BY-ONE', checkId: 'logic-boundaries', severity: 'medium', confidence: 0.6,
            title: 'Possible off-by-one error in loop bound', description: 'Loop runs while index <= length, but valid indexes stop at length - 1.',
            rootCause: 'Array indexes are zero-based.', why: 'The last iteration reads past the end (undefined) and can crash or add bad data.',
            suggestedFix: 'Use `i < array.length`.', correctedExample: 'for (let i = 0; i < items.length; i++) { ... }',
            howToVerify: 'Test the loop with an array of 0, 1 and 3 items and assert no undefined entries are processed.',
          });
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property?.name === 'forEach' &&
          n.arguments[0]?.async)
          add(n, {
            ruleId: 'LOGIC-ASYNC-FOREACH', checkId: 'logic-async', severity: 'medium', confidence: 0.7,
            title: 'async callback inside forEach is not awaited', description: 'forEach ignores the promises returned by async callbacks.',
            rootCause: 'Array.forEach does not wait for asynchronous work.', why: 'Code after the loop runs before the work finishes, and errors become unhandled rejections.',
            suggestedFix: 'Use `for (const x of items) { await ... }` or `await Promise.all(items.map(async (x) => ...))`.',
            correctedExample: 'await Promise.all(items.map(async (item) => { await save(item); }));',
          });
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property?.name === 'map') {
          const cb = n.arguments[0];
          if (cb && FUNCS.has(cb.type) && cb.body.type === 'BlockStatement' && !hasReturn(cb.body))
            add(cb, {
              ruleId: 'LOGIC-MAP-NO-RETURN', checkId: 'logic-returns', severity: 'medium', confidence: 0.75,
              title: 'map callback never returns a value', description: '.map() builds a new array from the values you return.',
              rootCause: 'The callback body has braces but no return statement.', why: 'The result is an array of undefined values (or empty JSX).',
              suggestedFix: 'Add `return`, or use an arrow function with an expression body. Use forEach if you only need side effects.',
            });
        }
        if (n.type === 'BlockStatement' || n.type === 'Program' || n.type === 'SwitchCase') {
          const body = n.type === 'SwitchCase' ? n.consequent : n.body;
          for (let i = 0; i < body.length - 1; i++) if (TERMINATORS.has(body[i].type)) {
            const nxt = body[i + 1];
            if (nxt.type !== 'FunctionDeclaration' && !(nxt.type === 'BreakStatement' && n.type === 'SwitchCase'))
              add(nxt, {
                ruleId: 'LOGIC-UNREACHABLE', checkId: 'logic-reachability', severity: 'low', confidence: 0.9, verificationStatus: 'static-analysis',
                title: 'Unreachable code after return/throw/break', description: 'This statement can never run.',
                rootCause: 'A return, throw, break or continue appears earlier in the same block.', why: 'Dead code hides mistakes and confuses readers.',
                suggestedFix: 'Remove the dead code or move the return to the end of the block.',
              });
            break;
          }
        }
      });
    }
    const checks = [
      ['logic-conditions', 'Suspicious conditions'], ['logic-boundaries', 'Loop and boundary checks'],
      ['logic-async', 'Async flow checks'], ['logic-returns', 'Missing return values'], ['logic-reachability', 'Unreachable code'],
    ].map(([id, name]) => ({ id, name, category: 'logic' }));
    return { findings, checks, analyzed: 0 };
  },
};
