// Rebuilds reading-order text from positioned PDF text items, including two-column resumes.
// (The Iteration 0 spike showed that naive line grouping merges columns.)
// Pure function: the caller (browser or test) supplies items, so no PDF library is needed here.

export type PdfTextItem = { str: string; x: number; y: number; w: number; h: number };

type Cell = { x0: number; x1: number; text: string };
type Row = { y: number; cells: Cell[] };

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};

function buildRows(items: PdfTextItem[]): Row[] {
  const clean = items.filter((i) => i.str.trim().length > 0);
  if (!clean.length) return [];
  const medH = median(clean.map((i) => i.h).filter((h) => h > 0)) || 10;

  // group items into rows by y (PDF y grows upward, so sort descending = top to bottom)
  const sorted = [...clean].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= medH * 0.45);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }

  const gap = Math.max(16, medH * 2.2); // a gap wider than this starts a new cell
  return rows.map((r) => {
    const its = r.items.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    for (const it of its) {
      const last = cells[cells.length - 1];
      if (last && it.x - last.x1 <= gap) {
        const sep = it.x - last.x1 > medH * 0.15 && !last.text.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
        last.text += sep + it.str;
        last.x1 = Math.max(last.x1, it.x + it.w);
      } else cells.push({ x0: it.x, x1: it.x + it.w, text: it.str });
    }
    return { y: r.y, cells: cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() })).filter((c) => c.text) };
  }).filter((r) => r.cells.length);
}

/** Left edges of real text columns, or [] when the page is a single column. */
function detectColumns(rows: Row[]): number[] {
  const multi = rows.filter((r) => r.cells.length >= 2);
  if (multi.length < 3) return [];
  const allX = rows.flatMap((r) => r.cells.flatMap((c) => [c.x0, c.x1]));
  const pageW = Math.max(...allX) - Math.min(...allX);
  if (pageW <= 0) return [];

  // cluster the x0 of cells that are NOT the first cell of a row
  const clusters: { x: number; cells: Cell[] }[] = [];
  for (const r of multi) {
    for (const c of r.cells.slice(1)) {
      const cl = clusters.find((k) => Math.abs(k.x - c.x0) <= 6);
      if (cl) cl.cells.push(c);
      else clusters.push({ x: c.x0, cells: [c] });
    }
  }
  // a column needs 3+ aligned cells whose text is substantial (a tab-aligned date column is narrow)
  const real = clusters.filter((k) => k.cells.length >= 3 && median(k.cells.map((c) => c.x1 - c.x0)) >= pageW * 0.22);
  if (!real.length) return [];
  const minX = Math.min(...rows.map((r) => r.cells[0].x0));
  return [minX, ...real.map((k) => k.x).sort((a, b) => a - b)];
}

export function itemsToText(pages: PdfTextItem[][]): string {
  const out: string[] = [];
  for (const items of pages) {
    const rows = buildRows(items);
    if (!rows.length) continue;
    const cols = detectColumns(rows);
    if (!cols.length) {
      for (const r of rows) out.push(r.cells.map((c) => c.text).join("   "));
      out.push("");
      continue;
    }
    // header rows (before the first multi-cell row) are full width; the rest is read column by column
    const firstMulti = rows.findIndex((r) => r.cells.length >= 2);
    for (const r of rows.slice(0, firstMulti)) out.push(r.cells.map((c) => c.text).join("   "));
    const body = rows.slice(firstMulti);
    const colOf = (x: number) => {
      let idx = 0;
      for (let i = 0; i < cols.length; i++) if (x >= cols[i] - 8) idx = i;
      return idx;
    };
    const buckets: string[][] = cols.map(() => []);
    for (const r of body) for (const c of r.cells) buckets[colOf(c.x0)].push(c.text);
    for (const b of buckets) {
      out.push(...b);
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
