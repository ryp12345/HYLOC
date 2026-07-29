
import React, { useState, useEffect, useMemo } from 'react';
import { getAllLeaves } from '../../../api/leaveApi';
import { useAuth } from '../../../context/AuthContext';

const MyLeavePage = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const currentYear = new Date().getFullYear();
  const [filter, setFilter] = useState({
    from: '',
    to: '',
    year: currentYear,
  });
  // For search form fields before applying
  const [pendingFilter, setPendingFilter] = useState({
    from: '',
    to: '',
    year: currentYear,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAllLeaves({});
      const allLeaves = response.data.data || [];
      // Only show leaves for the logged-in management member
      const myLeaves = allLeaves.filter(leave => leave.user_id === user?.id);
      setLeaves(myLeaves);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
    setPendingFilter({
      from: '',
      to: '',
      year: currentYear,
    });
  }, []);

  const filteredLeaves = useMemo(() => {
    // Sort latest first by from_date desc, then id desc
    let result = [...leaves].sort((a, b) => {
      const aTime = a.from_date ? new Date(a.from_date).getTime() : 0;
      const bTime = b.from_date ? new Date(b.from_date).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });
    // Apply filters
    if (filter.from) {
      result = result.filter(leave => new Date(leave.to_date) >= new Date(filter.from));
    }
    if (filter.to) {
      result = result.filter(leave => new Date(leave.from_date) <= new Date(filter.to));
    }
    if (filter.year) {
      result = result.filter(leave => new Date(leave.from_date).getFullYear() === Number(filter.year));
    }
    // Apply search
    const q = search.toLowerCase();
    if (q) {
      result = result.filter(l =>
        l.leave_reason?.toLowerCase().includes(q) ||
        l.department_name?.toLowerCase().includes(q) ||
        l.status?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leaves, search, filter]);

  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLeaves.slice(start, start + PAGE_SIZE);
  }, [filteredLeaves, currentPage]);
  const totalPages = Math.ceil(filteredLeaves.length / PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [search, leaves]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-[color:var(--text-primary)]">My Leave Requests</h1>
          <p className="text-lg text-[color:var(--text-secondary)]">View and search your leave requests</p>
        </div>
        {error && (
          <div className="mb-4 rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-[color:var(--danger)]">
            {error}
          </div>
        )}
        <div className="mb-6">
          <form
            className="flex w-full flex-row flex-wrap items-end gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm"
            onSubmit={e => {
              e.preventDefault();
              setFilter({ ...pendingFilter });
            }}
          >
            <div className="min-w-[150px] max-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">From Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                value={pendingFilter.from}
                onChange={e => setPendingFilter(f => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="min-w-[150px] max-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">To Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                value={pendingFilter.to}
                onChange={e => setPendingFilter(f => ({ ...f, to: e.target.value }))}
              />
            </div>
            <div className="min-w-[120px] max-w-[140px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Year</label>
              <select
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                value={pendingFilter.year}
                onChange={e => setPendingFilter(f => ({ ...f, year: Number(e.target.value) }))}
              >
                {[(currentYear - 1), currentYear, (currentYear + 1)].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-72">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Search</label>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search leaves..." className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-10 pr-4 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" />
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-9 h-5 w-5 text-[color:var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[color:var(--accent)] px-4 py-2 font-semibold text-white transition hover:bg-[color:var(--accent-hover)]"
              style={{ minWidth: 100 }}
            >
              Search
            </button>
          </form>
        </div>
        <div className="mb-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border)]">
              <thead className="bg-[color:var(--accent)]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">From Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">To Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Department</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Reason</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center text-[color:var(--text-secondary)]">Loading...</td></tr>
                ) : paginatedLeaves.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-[color:var(--text-secondary)]">No leave requests found</td></tr>
                ) : (
                  paginatedLeaves.map((leave, idx) => (
                    <tr key={leave.id} className={idx % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]/60'}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{formatDate(leave.from_date)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{formatDate(leave.to_date)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{leave.department_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-[color:var(--text-primary)]">{leave.leave_reason || '-'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          leave.status === 'Pending' ? 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]' :
                          leave.status === 'Approved' ? 'bg-[color:var(--success-soft)] text-[color:var(--success)]' :
                          'bg-[color:var(--danger-soft)] text-[color:var(--danger)]'
                        }`}>
                          {leave.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {filteredLeaves.length > PAGE_SIZE && (
            <div className="flex justify-end items-center gap-2 px-6 pb-6">
              <button
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="text-sm text-[color:var(--text-secondary)]">
                Page {currentPage} of {Math.ceil(filteredLeaves.length / PAGE_SIZE)}
              </span>
              <button
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredLeaves.length / PAGE_SIZE), p + 1))}
                disabled={currentPage === Math.ceil(filteredLeaves.length / PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyLeavePage;
