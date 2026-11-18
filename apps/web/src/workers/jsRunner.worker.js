// Runs a JavaScript solution against test cases inside a Web Worker (no DOM, no access to the page).
// The page enforces a time limit per test by terminating this worker; a "start" message marks each test.
import { formatValue, outputsMatch } from '@prepwise/core/src/coding/judge';

const logs = [];
let logChars = 0;
const record = (...a) => {
  if (logChars > 2000) return;
  const line = a.map((x) => (typeof x === 'string' ? x : formatValue(x, 200))).join(' ');
  logChars += line.length;
  logs.push(line);
};
self.console = { log: record, info: record, warn: record, error: record, debug: record };

self.onmessage = (e) => {
  const { code, fn, tests, compare } = e.data;
  let solution;
  try {
    solution = new Function(`${code}\n;return typeof ${fn} === 'function' ? ${fn} : undefined;`)();
  } catch (err) {
    self.postMessage({ type: 'done', compileError: `${err.name}: ${err.message}`, logs });
    return;
  }
  if (typeof solution !== 'function') {
    self.postMessage({ type: 'done', compileError: `Define a function named ${fn}.`, logs });
    return;
  }
  tests.forEach((t, index) => {
    self.postMessage({ type: 'start', index });
    try {
      const actual = solution(...structuredClone(t.args));
      const ok = outputsMatch(actual, t.expected, compare);
      self.postMessage({ type: 'case', index, status: ok ? 'passed' : 'failed', actual: formatValue(actual) });
    } catch (err) {
      const msg = err instanceof RangeError ? 'RangeError: too much recursion or memory' : `${err?.name ?? 'Error'}: ${err?.message ?? err}`;
      self.postMessage({ type: 'case', index, status: 'error', message: msg });
    }
  });
  self.postMessage({ type: 'done', logs });
};
