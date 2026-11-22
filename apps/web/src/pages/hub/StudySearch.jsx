import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Loader2, Search } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import CareerHubHeader from '../../components/hub/CareerHubHeader';
import { searchStudy } from '../../lib/studyIndex';

const EXAMPLES = ['difference between a process and a thread', 'what is a deadlock', 'explain ACID properties', 'how does a hash map handle collisions', 'tell me about yourself'];

/** Bolds the query words (after stemming-free matching on the raw word start) in a short snippet. */
function Snippet({ text, query }) {
  const words = [...new Set(query.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2))];
  const clipped = text.length > 260 ? `${text.slice(0, 257)}...` : text;
  if (words.length === 0) return <>{clipped}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{clipped.split(re).map((part, i) => (i % 2 ? <mark key={i} className="bg-[#C85232]/20 rounded px-0.5 text-inherit">{part}</mark> : <React.Fragment key={i}>{part}</React.Fragment>))}</>;
}

export default function StudySearch() {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (q) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text); setBusy(true); setError('');
    try {
      setHits(await searchStudy(text, { k: 8 }));
      setAsked(text);
    } catch {
      setError('Could not load the study material. Check your connection and try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <CareerHubHeader />
      <div>
        <Badge variant="primary" icon={Search}>STUDY SEARCH</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">Search PrepWise's study material</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          Ask a question in your own words. The closest learning topics, interview questions with model answers, practice questions and coding problems come up. It works on word overlap (TF-IDF), runs on your device, and needs no AI.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={300} aria-label="Search the study material" placeholder="For example: difference between process and thread"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]" />
        <Button type="submit" disabled={busy || !query.trim()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => run(x)} className="text-xs rounded-full border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)] px-3 py-1 hover:border-[#C85232]">{x}</button>)}
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {hits && hits.length === 0 && (
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">Nothing in the study material matches "{asked}". Try other words, or the name of the topic.</p>
      )}
      {hits && hits.length > 0 && (
        <ul className="space-y-3" aria-live="polite">
          {hits.map((h, i) => (
            <li key={h.id}>
              <Card padding="compact" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0"><span className="text-xs font-mono text-[#5E5B56] dark:text-[#A0A0A0]">{i + 1}</span><Badge size="sm">{h.kindLabel}</Badge></div>
                  <span className="text-xs font-mono text-[#5E5B56] dark:text-[#A0A0A0]" title="Cosine similarity, 0 to 1">match {Math.round(h.score * 100)}%</span>
                </div>
                <p className="font-semibold text-sm">{h.passage.title}</p>
                <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]"><Snippet text={h.passage.text} query={asked} /></p>
                <Link to={h.passage.link} className="text-xs font-bold text-[#C85232]">Open</Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> Search matches words, not meaning, so a question phrased very differently from the material can miss. The AI assistant can use these same passages as sources when it is switched on.</p>
    </div>
  );
}
