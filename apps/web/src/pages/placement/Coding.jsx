import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleDashed, Search, Terminal, Timer } from 'lucide-react';
import { CODING_PROBLEMS } from '@prepwise/content';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { getCodingStatus } from '../../services/codingService';

const DIFF = {
  EASY: 'text-emerald-700 dark:text-emerald-400',
  MEDIUM: 'text-amber-700 dark:text-amber-400',
  HARD: 'text-rose-700 dark:text-rose-400',
};
const chip = (active) =>
  `px-3 py-1.5 rounded-full text-xs font-semibold border ${active ? 'bg-[#C85232] border-[#C85232] text-white' : 'border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)] hover:border-[#C85232]/60'}`;

export default function Coding() {
  const [status, setStatus] = useState({});
  const [statusError, setStatusError] = useState(false);
  const [difficulty, setDifficulty] = useState('ALL');
  const [topic, setTopic] = useState('ALL');
  const [show, setShow] = useState('ALL'); // ALL | TODO | SOLVED
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCodingStatus()
      .then((rows) => !cancelled && setStatus(Object.fromEntries(rows.map((r) => [r.problemId, r]))))
      .catch(() => !cancelled && setStatusError(true));
    return () => { cancelled = true; };
  }, []);

  const topics = useMemo(() => ['ALL', ...[...new Set(CODING_PROBLEMS.map((p) => p.topic))].sort()], []);
  const solved = CODING_PROBLEMS.filter((p) => status[p.id]?.solved);
  const byDifficulty = (d) => ({ total: CODING_PROBLEMS.filter((p) => p.difficulty === d).length, done: solved.filter((p) => p.difficulty === d).length });

  const shown = CODING_PROBLEMS.filter((p) => {
    const s = status[p.id];
    return (difficulty === 'ALL' || p.difficulty === difficulty)
      && (topic === 'ALL' || p.topic === topic)
      && (show === 'ALL' || (show === 'SOLVED' ? s?.solved : !s?.solved))
      && (`${p.title} ${p.topic}`.toLowerCase().includes(query.trim().toLowerCase()));
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={Terminal}>CODING PRACTICE</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">Solve problems in your browser</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          Write JavaScript or Python and run it against real test cases. Your code runs on your own device, so it is instant and private. Nothing is graded by an AI.
        </p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card padding="compact"><p className="text-xs uppercase font-bold text-[#5E5B56] dark:text-[#A0A0A0]">Solved</p><p className="text-3xl font-extrabold font-mono text-[#C85232]">{solved.length}<span className="text-base font-normal text-[#5E5B56]"> / {CODING_PROBLEMS.length}</span></p></Card>
        {['EASY', 'MEDIUM', 'HARD'].map((d) => {
          const { total, done } = byDifficulty(d);
          return <Card key={d} padding="compact"><p className={`text-xs uppercase font-bold ${DIFF[d]}`}>{d.toLowerCase()}</p><p className="text-3xl font-extrabold font-mono">{done}<span className="text-base font-normal text-[#5E5B56]"> / {total}</span></p></Card>;
        })}
      </div>
      {statusError && <p role="alert" className="text-sm text-amber-700">Your solved marks could not be loaded. You can still practise.</p>}

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5E5B56]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search problems" aria-label="Search problems"
            className="w-full rounded-xl pl-9 pr-3 py-2 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
          {['ALL', 'EASY', 'MEDIUM', 'HARD'].map((d) => <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} className={chip(difficulty === d)}>{d === 'ALL' ? 'All levels' : d.toLowerCase()}</button>)}
          {[['ALL', 'Any status'], ['TODO', 'Not solved'], ['SOLVED', 'Solved']].map(([k, l]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className={chip(show === k)}>{l}</button>)}
        </div>
        <label className="text-xs font-semibold block">
          Topic{' '}
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="ml-2 rounded-lg px-2 py-1 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]">
            {topics.map((t) => <option key={t} value={t}>{t === 'ALL' ? 'All topics' : t}</option>)}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">No problems match these filters.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((p) => {
            const s = status[p.id];
            return (
              <li key={p.id}>
                <Link to={`/placement/coding/${p.id}`} className="block">
                  <Card padding="compact" hoverable className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {s?.solved ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" aria-label="Solved" /> : s ? <Timer size={20} className="text-amber-600 shrink-0" aria-label="Attempted" /> : <CircleDashed size={20} className="text-[#5E5B56] shrink-0" aria-label="Not started" />}
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p.title}</p>
                        <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{p.topic}{s && !s.solved ? ` • best ${s.bestPassed} of ${s.total} tests` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-bold uppercase ${DIFF[p.difficulty]}`}>{p.difficulty.toLowerCase()}</span>
                      <ArrowRight size={16} className="text-[#C85232]" />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">
        Want multiple-choice questions on the same topics? Try <Link to="/placement/dsa" className="underline text-[#C85232]">DSA practice</Link>.
      </p>
    </div>
  );
}
