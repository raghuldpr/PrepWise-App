import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Calculator, Cpu, Code2, Network, MessageSquare, ArrowRight } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { getCompanyPreparation, getQuestions } from '../../services/placementService';

const MODULES = [
  { key: 'aptitudeQuestionsCount', label: 'Aptitude', icon: Calculator, link: '/placement/aptitude' },
  { key: 'technicalQuestionsCount', label: 'Technical', icon: Cpu, link: '/placement/technical' },
  { key: 'dsaQuestionsCount', label: 'DSA', icon: Network, link: '/placement/dsa' },
  { key: 'codingQuestionsCount', label: 'Coding', icon: Code2, link: '/placement/coding' },
  { key: 'hrQuestionsCount', label: 'HR', icon: MessageSquare, link: '/mock-interview' },
];

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prep, setPrep] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, q] = await Promise.all([getCompanyPreparation(id), getQuestions({ companyId: id, size: 100 })]);
      setPrep(p);
      setQuestions(q.content || []);
    } catch (err) {
      console.error('Failed to load company preparation:', err);
      setError(err.response?.status === 404 ? 'Company not found.' : 'Could not load this company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <LoadingState message="Loading company preparation..." />
      </div>
    );
  }
  if (error || !prep) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <ErrorState message={error || 'Company not found.'} onRetry={load} />
      </div>
    );
  }

  const { company } = prep;
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <button
        onClick={() => navigate('/placement/companies')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5E5B56] dark:text-[#A0A0A0] hover:text-[#C85232]"
      >
        <ArrowLeft size={16} /> All companies
      </button>

      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="primary" icon={Building2}>
            COMPANY TRACK
          </Badge>
          {company.industry && <Badge>{company.industry}</Badge>}
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-[#111111] dark:text-white">{company.name}</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-2 max-w-3xl">{company.description}</p>
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#C85232]"
          >
            <Globe size={14} /> {company.website.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      <section>
        <h2 className="text-lg font-bold font-heading mb-3">
          Tagged practice questions <span className="text-[#5E5B56] dark:text-[#A0A0A0] font-normal">({prep.totalQuestions})</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {MODULES.map(({ key, label, icon: Icon, link }) => (
            <Card key={key} padding="compact" hoverable onClick={() => navigate(link)} className="flex flex-col gap-1">
              <Icon size={18} className="text-[#C85232]" />
              <span className="text-2xl font-extrabold">{prep[key]}</span>
              <span className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{label}</span>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold font-heading mb-3">Questions asked in this track</h2>
        {questions.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No tagged questions yet"
            description="Questions for this company will appear here as the question bank grows. Practice the general modules in the meantime."
            actionLabel="Open practice"
            onAction={() => navigate('/placement')}
          />
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <Card key={q.id} padding="compact" className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{q.title}</p>
                  <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">
                    {q.categoryName}
                    {q.topic ? ` • ${q.topic}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge size="sm">{q.difficulty}</Badge>
                  <ArrowRight size={14} className="text-[#C85232]" />
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-4">
          Interview rounds, salary ranges and company-specific tips are not included yet.
        </p>
      </section>
    </div>
  );
}
