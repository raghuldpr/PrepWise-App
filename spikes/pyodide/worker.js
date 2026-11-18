// Spike C: run Python (Pyodide) inside a classic Web Worker.
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodideReady = (async () => {
  const t0 = performance.now();
  const py = await loadPyodide();
  self.postMessage({ type: "loaded", ms: Math.round(performance.now() - t0) });
  return py;
})();

self.onmessage = async (e) => {
  const { code, tests, fn } = e.data;
  const py = await pyodideReady;
  const t0 = performance.now();
  const results = [];
  try {
    py.runPython(code);
    for (const t of tests) {
      try {
        py.globals.set("__args", py.toPy(t.input));
        const out = py.runPython(`import json\njson.dumps(${fn}(*__args))`);
        results.push({ input: t.input, expected: t.expected, actual: JSON.parse(out), pass: JSON.stringify(JSON.parse(out)) === JSON.stringify(t.expected) });
      } catch (err) {
        results.push({ input: t.input, error: String(err).split("\n").slice(-2).join(" ") , pass: false });
      }
    }
  } catch (err) {
    results.push({ error: "compile/runtime: " + String(err).split("\n").slice(-2).join(" "), pass: false });
  }
  self.postMessage({ type: "result", ms: Math.round(performance.now() - t0), results });
};
