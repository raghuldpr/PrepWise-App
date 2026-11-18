// Runs a Python solution with Pyodide (CPython compiled to WebAssembly) inside a Web Worker.
// Pyodide is downloaded once from the jsDelivr CDN and then cached by the browser.
import { formatValue, outputsMatch } from '@prepwise/core/src/coding/judge';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs';
let pyodide = null;
const logs = [];
let logChars = 0;
const record = (line) => {
  if (logChars > 2000) return;
  logChars += line.length;
  logs.push(line);
};

async function load() {
  if (pyodide) return pyodide;
  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_URL);
  pyodide = await loadPyodide();
  pyodide.setStdout({ batched: record });
  pyodide.setStderr({ batched: record });
  return pyodide;
}

const cleanError = (err) => {
  const lines = String(err?.message ?? err).trim().split('\n').filter(Boolean);
  return lines.slice(-2).join(' ').slice(0, 300);
};

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      await load();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'fatal', message: `Could not load Python: ${cleanError(err)}. Check your internet connection.` });
    }
    return;
  }
  const { code, fn, tests, compare } = msg;
  let py;
  try {
    py = await load();
  } catch (err) {
    self.postMessage({ type: 'fatal', message: `Could not load Python: ${cleanError(err)}. Check your internet connection.` });
    return;
  }
  logs.length = 0;
  logChars = 0;
  // A fresh namespace per run so one submission cannot see another's variables.
  const ns = py.globals.get('dict')();
  try {
    py.runPython(code, { globals: ns });
  } catch (err) {
    self.postMessage({ type: 'done', compileError: cleanError(err), logs });
    ns.destroy();
    return;
  }
  if (!ns.has(fn)) {
    self.postMessage({ type: 'done', compileError: `Define a function named ${fn}.`, logs });
    ns.destroy();
    return;
  }
  tests.forEach((t, index) => {
    self.postMessage({ type: 'start', index });
    try {
      ns.set('__args', JSON.stringify(t.args));
      py.runPython(`import json as __json\n__result = __json.dumps(${fn}(*__json.loads(__args)))`, { globals: ns });
      const actual = JSON.parse(ns.get('__result'));
      const ok = outputsMatch(actual, t.expected, compare);
      self.postMessage({ type: 'case', index, status: ok ? 'passed' : 'failed', actual: formatValue(actual) });
    } catch (err) {
      let m = cleanError(err);
      if (/not JSON serializable/.test(m)) m = 'Return a list, number, string or boolean (sets and custom objects cannot be compared). ' + m;
      if (/Expecting value|JSONDecodeError/.test(m)) m = 'The function returned nothing (None). ' + m;
      self.postMessage({ type: 'case', index, status: 'error', message: m });
    }
  });
  self.postMessage({ type: 'done', logs });
  ns.destroy();
};
