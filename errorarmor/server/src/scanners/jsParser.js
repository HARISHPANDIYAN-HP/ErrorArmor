import * as acorn from 'acorn';
import jsx from 'acorn-jsx';

const JsxParser = acorn.Parser.extend(jsx());
const base = { ecmaVersion: 'latest', locations: true, allowHashBang: true, allowAwaitOutsideFunction: true };

const clean = (m) => m.replace(/\s*\(\d+:\d+\)$/, '');

/** Parses JS/JSX with acorn. Tries ES module first, then script mode (CommonJS top-level return). Cached per file. */
export function parseJs(project, file) {
  if (project.parseCache.has(file.abs)) return project.parseCache.get(file.abs);
  const code = project.text(file);
  let result;
  try {
    result = { ast: JsxParser.parse(code, { ...base, sourceType: 'module' }) };
  } catch (first) {
    try {
      result = { ast: JsxParser.parse(code, { ...base, sourceType: 'script', allowReturnOutsideFunction: true }) };
    } catch {
      result = { error: { message: clean(first.message), line: first.loc?.line || 1, column: (first.loc?.column ?? 0) + 1 } };
    }
  }
  project.parseCache.set(file.abs, result);
  return result;
}

export function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'type') continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, visit, node); }
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}
