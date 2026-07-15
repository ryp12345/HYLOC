
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
      // Only show leaves for the logged-in hod member
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
    <div className="min-h-screen px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-gray-900">My Leave Requests</h1>
          <p className="text-lg text-gray-600">View and search your leave requests</p>
        </div>
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <div className="mb-6">
          <form
            className="bg-white rounded-xl shadow p-4 flex flex-row flex-wrap items-end gap-4 w-full"
            onSubmit={e => {
              e.preventDefault();
              setFilter({ ...pendingFilter });
            }}
          >
            <div className="min-w-[150px] max-w-[200px] flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={pendingFilter.from}
                onChange={e => setPendingFilter(f => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="min-w-[150px] max-w-[200px] flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={pendingFilter.to}
                onChange={e => setPendingFilter(f => ({ ...f, to: e.target.value }))}
              />
            </div>
            <div className="min-w-[120px] max-w-[140px] flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={pendingFilter.year}
                onChange={e => setPendingFilter(f => ({ ...f, year: Number(e.target.value) }))}
              >
                {[(currentYear - 1), currentYear, (currentYear + 1)].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-72">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search leaves..." className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-9" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              style={{ minWidth: 100 }}
            >
              Search
            </button>
          </form>
        </div>
        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">From Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">To Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading...</td></tr>
                ) : paginatedLeaves.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">No leave requests found</td></tr>
                ) : (
                  paginatedLeaves.map((leave, idx) => (
                    <tr key={leave.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(leave.from_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(leave.to_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.department_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{leave.leave_reason || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
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
                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {Math.ceil(filteredLeaves.length / PAGE_SIZE)}
              </span>
              <button
                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50"
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
