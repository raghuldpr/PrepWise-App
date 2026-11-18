import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Trophy, ArrowRight, Globe } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { getCompanies, getCompanyPreparation } from '../../services/placementService';

export default function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [totals, setTotals] = useState({}); // companyId -> total tagged questions
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getCompanies();
      setCompanies(list);
      const preps = await Promise.allSettled(list.map((c) => getCompanyPreparation(c.id)));
      const t = {};
      preps.forEach((p, i) => {
        if (p.status === 'fulfilled') t[list[i].id] = p.value.totalQuestions;
      });
      setTotals(t);
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError('Could not load companies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q),
    );
  }, [companies, search]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4">
        <LoadingState message="Loading company tracks..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="primary" icon={Building2}>
            COMPANY-SPECIFIC PREP
          </Badge>
          <Badge variant="default" icon={Trophy}>
            Placement Target Tracks
          </Badge>
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-[#111111] dark:text-white">
          Target Company Preparation
        </h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          Practice questions tagged to the companies you are targeting.
        </p>
      </div>

      <div className="relative w-full md:w-96">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5E5B56] dark:text-[#A0A0A0]" />
        <input
          type="text"
          placeholder="Search company or industry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-surface text-[#111111] dark:text-white border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No companies found" description="Try a different search term." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <Card key={c.id} hoverable onClick={() => navigate(`/placement/companies/${c.id}`)} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold font-heading">{c.name}</h2>
                {c.industry && <Badge size="sm">{c.industry}</Badge>}
              </div>
              <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] line-clamp-3">{c.description}</p>
              <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                <span className="font-semibold">
                  {totals[c.id] !== undefined ? `${totals[c.id]} tagged questions` : '—'}
                </span>
                <span className="inline-flex items-center gap-1 text-[#C85232] font-semibold">
                  View track <ArrowRight size={14} />
                </span>
              </div>
              {c.website && (
                <span className="text-xs inline-flex items-center gap-1 text-[#5E5B56] dark:text-[#A0A0A0]">
                  <Globe size={12} /> {c.website.replace(/^https?:\/\//, '')}
                </span>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
