import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  getEntitlements,
  getStaffWithStatus,
  updateEntitlement,
  deleteEntitlement
} from "../../../api/leaveEntitlementApi";

const PAGE_SIZE = 10;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const LeaveEntitlementPage = ({ token: propToken }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [entitlements, setEntitlements] = useState([]);
  const [staff, setStaff] = useState([]);
  
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'edit' | null
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(1);
  
  const token = propToken || localStorage.getItem('accessToken');

  useEffect(() => {
    loadEntitlementData();
  }, [year, token]);

  const loadEntitlementData = async () => {
    if (!token) {
      setError('No authentication token found. Please login.');
      return;
    }
    setLoading(true);
    try {
      // console.log('Loading data with token:', token);
      const [entRes, staffRes] = await Promise.all([
        getEntitlements(year, token),
        getStaffWithStatus(year, token)
      ]);
      // console.log('Entitlements response:', entRes);
      // console.log('Staff response:', staffRes);
      setEntitlements(entRes.data);
      setStaff(staffRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load data');
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const sorted = [...entitlements].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });
    const q = search.toLowerCase();
    return sorted.filter(e =>
      e.user_name?.toLowerCase().includes(q) ||
      e.empid?.toLowerCase().includes(q)
    );
  }, [entitlements, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, entitlements]);

  useEffect(() => { setSuccessMessage(''); }, [year]);

  const closeModal = () => {
    setModal(null);
    setSelected(null);
    setError('');
  };



  // Edit Entitlement Modal
  const EditEntitlementModal = () => {
    const [formData, setFormData] = useState({
      leave_entitled: selected?.leave_entitled ?? 0,
      leaves_accumulated: selected?.leaves_accumulated ?? 0,
      leaves_availed: selected?.leaves_availed ?? 0
    });
    const [submitting, setSubmitting] = useState(false);
    const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async e => {
      e.preventDefault();
      setSubmitting(true);
      setError('');
      try {
        await updateEntitlement(selected.id, formData, token);
        await loadEntitlementData();
        closeModal();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to update entitlement');
      }
      setSubmitting(false);
    };
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeModal} />
          <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
            <div className="px-6 py-4 bg-blue-600">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium leading-6 text-white">Edit Entitlement</h3>
                <button className="text-white hover:text-gray-200" onClick={closeModal}>
                  <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-5 bg-white">
              {error && <div className="mb-4 p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div>}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Leave Entitled *</label>
                  <input name="leave_entitled" type="number" value={formData.leave_entitled} onChange={handleChange} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required min={0} />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Leaves Accumulated *</label>
                  <input name="leaves_accumulated" type="number" value={formData.leaves_accumulated} onChange={handleChange} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required min={0} />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Leaves Availed *</label>
                  <input name="leaves_availed" type="number" value={formData.leaves_availed} onChange={handleChange} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required min={0} />
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                  <button type="button" onClick={closeModal} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">{submitting ? 'Updating...' : 'Update'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };

  

  return (
    <div className="min-h-screen px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-gray-900">Leave Entitlements</h1>
        </div>
        

        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or emp ID..." className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="flex gap-2 w-full sm:w-auto items-center">
            <span className="text-sm font-medium text-gray-600">Entitlement Year</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              {[0,1,2].map(offset => (
                <option key={offset} value={new Date().getFullYear()+offset}>{new Date().getFullYear()+offset}</option>
              ))}
            </select>
          </div>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {successMessage}
          </div>
        )}

        

        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Emp ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Year</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Entitled</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Accumulated</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Availed</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan="9" className="px-6 py-12 text-center text-gray-500">No entitlements found</td></tr>
                ) : (
                  paginated.map((e, idx) => (
                    <tr key={e.user_id+e.year} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.user_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.empid}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.year}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.leave_entitled}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.leaves_accumulated}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.leaves_availed}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.leave_balance}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => { setSelected(e); setModal('edit'); }}
                            className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
                            title="Edit Entitlement"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this entitlement?')) {
                                try {
                                  await deleteEntitlement(e.id, token);
                                  await loadEntitlementData();
                                } catch (err) {
                                  setError(err.response?.data?.error || 'Failed to delete entitlement');
                                }
                              }
                            }}
                            className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
                            title="Delete Entitlement"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex justify-end items-center gap-2 px-6 pb-6">
              <button
                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">
                Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
              </span>
              <button
                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50"
                onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))}
                disabled={page === Math.ceil(filtered.length / PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Modals for edit */}
        {modal === 'edit' && <EditEntitlementModal />}
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </div>
    </div>
  );
};

export default LeaveEntitlementPage;
