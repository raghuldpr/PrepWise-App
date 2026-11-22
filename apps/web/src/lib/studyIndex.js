import { buildIndex, search } from '@prepwise/core/src/rag/tfidf';

// Search over PrepWise's own study material, entirely in the browser. The corpus (about 390 passages) is loaded
// on first use as its own chunk so it never slows the rest of the app; the TF-IDF index is built once per page load.
let ready = null;

export function loadStudyIndex() {
  if (!ready) {
    ready = import('@prepwise/content/src/rag-corpus').then((m) => {
      const corpus = m.buildCorpus();
      return { index: buildIndex(corpus), byId: new Map(corpus.map((p) => [p.id, p])), kindLabel: m.KIND_LABEL, size: corpus.length };
    });
    ready.catch(() => { ready = null; }); // allow a retry after a failed download
  }
  return ready;
}

/** Top passages for a question, with the words that matched. */
export async function searchStudy(query, { k = 5, minScore = 0.08 } = {}) {
  const { index, byId, kindLabel } = await loadStudyIndex();
  return search(index, query, { k, minScore }).map((h) => ({ ...h, passage: byId.get(h.id), kindLabel: kindLabel[byId.get(h.id).kind] }));
}
