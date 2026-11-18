import { verdictOf } from '@prepwise/core/src/coding/judge';

// Workers are started from their own files (not Vite's "?worker" import, which wraps them in a blob that would inherit
// the page's Content-Security-Policy and block evaluating the student's code).
const JsWorker = function JsWorker() { return new Worker(new URL('../workers/jsRunner.worker.js', import.meta.url)); };
const PyWorker = function PyWorker() { return new Worker(new URL('../workers/pyRunner.worker.js', import.meta.url)); };

// Runs a submission in a Web Worker and judges it. A test that runs too long gets its worker terminated, which is
// the only way to stop an infinite loop in the browser. Nothing here touches the network except downloading Python.

const LIMIT_MS = { javascript: 2000, python: 4000 };
let pyWorker = null;
let pyReady = null;

/** Start loading Python (about 10 MB, cached afterwards). Safe to call many times. */
export function preparePython(onStatus) {
  if (pyReady) return pyReady;
  onStatus?.('loading');
  pyWorker = PyWorker();
  pyReady = new Promise((resolve, reject) => {
    pyWorker.onmessage = (e) => {
      if (e.data.type === 'ready') { onStatus?.('ready'); resolve(pyWorker); }
      else if (e.data.type === 'fatal') { reset(); onStatus?.('failed'); reject(new Error(e.data.message)); }
    };
    pyWorker.onerror = () => { reset(); onStatus?.('failed'); reject(new Error('Could not start the Python runner.')); };
  });
  pyReady.catch(() => {});
  pyWorker.postMessage({ type: 'init' });
  return pyReady;
}

function reset() {
  try { pyWorker?.terminate(); } catch { /* already gone */ }
  pyWorker = null;
  pyReady = null;
}

/**
 * @returns {Promise<{verdict: string, results: object[], compileError?: string, logs: string[], timeMs: number}>}
 */
export async function runSubmission({ language, code, problem, onProgress }) {
  const started = performance.now();
  const worker = language === 'python' ? await preparePython() : JsWorker();
  const limit = LIMIT_MS[language];
  const results = [];
  let timer = null;

  const outcome = await new Promise((resolve) => {
    const finish = (extra = {}) => { clearTimeout(timer); resolve({ logs: [], ...extra }); };
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'start') {
        clearTimeout(timer);
        timer = setTimeout(() => {
          results.push({ index: m.index, status: 'timeout', message: `Took longer than ${limit / 1000} seconds. Look for an infinite loop or a slower algorithm.` });
          // Remaining tests are not run after a timeout.
          for (let i = m.index + 1; i < problem.tests.length; i++) results.push({ index: i, status: 'skipped' });
          if (language === 'python') reset(); else worker.terminate();
          onProgress?.(results.length, problem.tests.length);
          finish({ timedOut: true });
        }, limit);
      } else if (m.type === 'case') {
        clearTimeout(timer);
        results.push({ index: m.index, status: m.status, actual: m.actual, message: m.message });
        onProgress?.(results.length, problem.tests.length);
      } else if (m.type === 'done') {
        finish({ compileError: m.compileError, logs: m.logs ?? [] });
      } else if (m.type === 'fatal') {
        reset();
        finish({ compileError: m.message });
      }
    };
    worker.onerror = (e) => {
      if (language === 'python') reset(); else worker.terminate();
      finish({ compileError: `The runner crashed: ${e.message || 'unknown error'}` });
    };
    worker.postMessage({ code, fn: problem.fn, tests: problem.tests, compare: problem.compare });
  });

  if (language === 'javascript' && !outcome.timedOut) worker.terminate();
  const judged = results.filter((r) => r.status !== 'skipped');
  return {
    verdict: verdictOf(judged, outcome.compileError),
    results: [...results].sort((a, b) => a.index - b.index),
    compileError: outcome.compileError,
    logs: outcome.logs,
    timeMs: Math.round(performance.now() - started),
  };
}
