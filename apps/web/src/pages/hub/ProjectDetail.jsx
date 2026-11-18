import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, Clock } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { selectClass } from '../../components/hub/RolePicker';
import { errorMessage, getProjectById, getSavedProjects, saveProject, setProjectStatus, unsaveProject } from '../../services/learningService';

const STATUS = { SAVED: 'Saved', PLANNED: 'Planned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [savedRow, setSavedRow] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, saved] = await Promise.all([getProjectById(id), getSavedProjects()]);
      setProject(p);
      setSavedRow(saved.find((s) => String(s.projectId) === String(id)) ?? null);
    } catch (err) {
      setError(err.response?.status === 404 ? 'This project was not found.' : 'Could not load this project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleSave = async () => {
    setNotice('');
    try {
      if (savedRow) { await unsaveProject(id); setSavedRow(null); } else { setSavedRow(await saveProject(id)); }
    } catch (err) { setNotice(errorMessage(err, 'Could not update your saved projects.')); }
  };
  const changeStatus = async (status) => {
    setNotice('');
    try { setSavedRow(await setProjectStatus(id, status)); } catch (err) { setNotice(errorMessage(err, 'Could not update the status.')); }
  };

  if (loading) return <div className="max-w-4xl mx-auto py-12 px-4"><LoadingState message="Loading the project..." /></div>;
  if (error || !project) return <div className="max-w-4xl mx-auto py-12 px-4"><ErrorState message={error || 'Project not found.'} onRetry={load} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <button onClick={() => navigate('/hub/projects')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5E5B56] dark:text-[#A0A0A0] hover:text-[#C85232]">
        <ArrowLeft size={16} /> All projects
      </button>

      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4 space-y-2">
        <div className="flex flex-wrap gap-2"><Badge variant="primary">{project.domain}</Badge><Badge>{project.difficulty.toLowerCase()}</Badge>{project.fullStack && <Badge>full-stack</Badge>}</div>
        <h1 className="text-3xl font-extrabold font-heading">{project.title}</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] inline-flex items-center gap-1.5"><Clock size={14} /> About {project.hours} hours • {project.languages.join(', ')}</p>
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button type="button" onClick={toggleSave} aria-pressed={!!savedRow} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C85232]">
            {savedRow ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {savedRow ? 'Saved' : 'Save this project'}
          </button>
          {savedRow && (
            <select aria-label="Project status" value={savedRow.status} onChange={(e) => changeStatus(e.target.value)} className={`${selectClass} !mt-0 max-w-[11rem]`}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </div>
        {notice && <p role="alert" className="text-sm text-rose-600">{notice}</p>}
      </div>

      <section><h2 className="text-lg font-bold font-heading mb-2">The problem</h2><p className="text-sm">{project.problemStatement}</p></section>

      <section>
        <h2 className="text-lg font-bold font-heading mb-2">Features to build</h2>
        <ul className="list-disc pl-5 text-sm space-y-1">{project.features.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      <section>
        <h2 className="text-lg font-bold font-heading mb-2">Build plan</h2>
        <ol className="space-y-2">
          {project.milestones.map((m, i) => (
            <Card key={m} padding="compact" className="flex items-start gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-[#C85232] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <p className="text-sm">{m}</p>
            </Card>
          ))}
        </ol>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <Card><h2 className="font-bold font-heading mb-2">Skills it covers</h2>
          <div className="flex flex-wrap gap-1.5">{project.skills.map((s) => <span key={s} className="rounded-full border border-[#5E5B56]/30 px-2.5 py-0.5 text-xs">{s}</span>)}</div>
        </Card>
        <Card><h2 className="font-bold font-heading mb-2">Why it helps in placements</h2>
          <p className="text-sm">{project.whyItsUseful}</p><p className="text-sm mt-2">{project.placementRelevance}</p>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-bold font-heading mb-2">Ideas to extend it</h2>
        <ul className="list-disc pl-5 text-sm space-y-1">{project.futureEnhancements.split('; ').map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-4">
          Add the finished project to your resume, then <Link to="/hub/resume" className="underline text-[#C85232]">check it in the Resume Analyzer</Link>.
        </p>
      </section>
    </div>
  );
}
