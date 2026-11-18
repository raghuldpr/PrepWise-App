import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bookmark, BookmarkCheck, Clock, Lightbulb } from 'lucide-react';
import { ROLES } from '@prepwise/content';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import { selectClass, useProfileRole } from '../../components/hub/RolePicker';
import {
  errorMessage, getProjectOptions, getSavedProjects, recommendProjects, saveProject, setProjectStatus, unsaveProject,
} from '../../services/learningService';

const DIFF = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };
const STATUS = { SAVED: 'Saved', PLANNED: 'Planned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };

export default function ProjectFinder() {
  const { profileRoleId, loaded } = useProfileRole();
  const [options, setOptions] = useState({ domains: [], languages: [] });
  const [f, setF] = useState({ language: '', domain: '', difficulty: '', fullStackRequired: false, roleId: '' });
  const [results, setResults] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSaved = useCallback(async () => {
    try { setSaved(await getSavedProjects()); } catch { setError('Could not load your saved projects.'); }
  }, []);

  useEffect(() => {
    getProjectOptions().then(setOptions).catch(() => {});
    loadSaved();
  }, [loadSaved]);

  const search = useCallback(async (filters) => {
    setLoading(true);
    setError('');
    try {
      setResults(await recommendProjects({
        language: filters.language || null, domain: filters.domain || null, difficulty: filters.difficulty || null,
        fullStackRequired: filters.fullStackRequired, roleId: filters.roleId || null,
      }));
    } catch (err) {
      setError(errorMessage(err, 'Could not find projects. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // first load: suggestions for the profile's target role
  useEffect(() => {
    if (!loaded) return;
    const next = { ...f, roleId: profileRoleId || '' };
    setF(next);
    search(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const savedIds = new Set(saved.map((s) => s.projectId));
  const toggleSave = async (id) => {
    try {
      if (savedIds.has(id)) await unsaveProject(id); else await saveProject(id);
      await loadSaved();
    } catch (err) {
      setError(errorMessage(err, 'Could not update your saved projects.'));
    }
  };
  const changeStatus = async (id, status) => {
    try { await setProjectStatus(id, status); await loadSaved(); } catch (err) { setError(errorMessage(err, 'Could not update the status.')); }
  };

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={Lightbulb}>PROJECT FINDER</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">Projects worth building</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          A hand-picked list of portfolio projects. Results are ranked by your filters and by the skills you are still missing for your target role, and each one says why.
        </p>
      </div>

      <Card className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block text-sm font-semibold">Language
            <select value={f.language} onChange={(e) => set('language', e.target.value)} className={selectClass}>
              <option value="">Any</option>{options.languages.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Domain
            <select value={f.domain} onChange={(e) => set('domain', e.target.value)} className={selectClass}>
              <option value="">Any</option>{options.domains.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Difficulty
            <select value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)} className={selectClass}>
              <option value="">Any</option>{Object.entries(DIFF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Target role
            <select value={f.roleId} onChange={(e) => set('roleId', e.target.value)} className={selectClass}>
              <option value="">From my profile</option>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.fullStackRequired} onChange={(e) => set('fullStackRequired', e.target.checked)} /> Only full-stack projects
        </label>
        <div><Button onClick={() => search(f)} disabled={loading}>{loading ? 'Searching...' : 'Find projects'}</Button></div>
        {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {error}</p>}
      </Card>

      {loading && !results && <LoadingState message="Finding projects..." />}

      {results && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold font-heading">Recommended ({results.length})</h2>
          {results.length === 0 && <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">No project matches all of these filters. Try loosening one.</p>}
          {results.map((p) => (
            <Card key={p.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link to={`/hub/projects/${p.id}`} className="text-lg font-bold font-heading hover:text-[#C85232]">{p.title}</Link>
                  <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-0.5 inline-flex items-center gap-3">
                    <span>{p.domain}</span><span>{DIFF[p.difficulty]}</span><span className="inline-flex items-center gap-1"><Clock size={12} /> about {p.hours} h</span>
                  </p>
                </div>
                <button type="button" onClick={() => toggleSave(p.id)} aria-pressed={savedIds.has(p.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C85232]">
                  {savedIds.has(p.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {savedIds.has(p.id) ? 'Saved' : 'Save'}
                </button>
              </div>
              <p className="text-sm">{p.problemStatement}</p>
              <div className="flex flex-wrap gap-1.5">{p.skills.map((s) => <span key={s} className="rounded-full border border-[#5E5B56]/30 px-2.5 py-0.5 text-xs">{s}</span>)}</div>
              {p.reasons?.length > 0 && <p className="text-xs text-emerald-700 dark:text-emerald-300">Why: {p.reasons.join(' • ')}</p>}
            </Card>
          ))}
        </section>
      )}

      {saved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold font-heading">Your saved projects</h2>
          {saved.map((s) => s.project && (
            <Card key={s.id} padding="compact" className="flex flex-wrap items-center justify-between gap-3">
              <Link to={`/hub/projects/${s.projectId}`} className="font-semibold text-sm hover:text-[#C85232]">{s.project.title}</Link>
              <select aria-label={`Status of ${s.project.title}`} value={s.status} onChange={(e) => changeStatus(s.projectId, e.target.value)} className={`${selectClass} !mt-0 max-w-[11rem]`}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
