import React, { useState, useEffect, useMemo } from 'react';
import { getAllLeaves, approveLeave, rejectLeave, updateLeave } from '../../../api/leaveApi';
import Notification from '../../../components/common/Notification';

const LeaveApprovalPage = () => {
  const [leaves, setLeaves] = useState([]);
  //Removed view state (no tabs)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Pending'); // Keep for status filtering only
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  // Leave Search Filter state
  const currentYear = new Date().getFullYear();
  const [filter, setFilter] = useState({
    from: '',
    to: '',
    department: '',
    username: '',
    year: currentYear,
  });
  const [allDepartments, setAllDepartments] = useState([]);
  const [showFilteredTable, setShowFilteredTable] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { getDepartments } = await import('../../../api/departmentApi');
        const response = await getDepartments();
        const departments = response.data?.data || response.data || [];
        setAllDepartments(departments);
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    fetchDepartments();
  }, []);

  // Build department options from allDepartments
  const departmentOptions = useMemo(() => {
    return allDepartments
      .map(d => d.name || d.department_name || d.departmentName || '')
      .filter(name => name)
      .sort();
  }, [allDepartments]);

  const loadLeaves = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Management sees:
      // - All HOD leaves (any duration)
      // - Employee leaves > 2 days
      const response = await getAllLeaves(filters);
      const allLeaves = response.data.data || [];
      const filtered = allLeaves.filter(leave => {
        const role = leave.user_role;
        const duration = parseFloat(leave.credited_days);
        const isHod = role === 'HOD';
        const isEmployee = role === 'Employee';
        // Employees who also hold the HOD role cannot self-approve,
        // so their leaves are routed to Management regardless of duration.
        const ownerIsHod = !!leave.is_hod_holder;
        return isHod || (isEmployee && (duration > 2 || ownerIsHod));
      });
      setLeaves(filtered);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load leaves');
      console.error('Error loading leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleApprove = async (leaveId) => {
    if (!window.confirm('Approve this leave request?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await approveLeave(leaveId);
      await loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve leave');
      console.error('Error approving leave:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (leaveId) => {
    if (!window.confirm('Reject this leave request?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await rejectLeave(leaveId);
      await loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject leave');
      console.error('Error rejecting leave:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (leave) => {
    setEditingLeave(leave);
    setEditStatus(leave.status);
    setIsEditMode(true);
    setShowEditModal(true);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const handleEditStatusSave = async (newStatus) => {
    if (!editingLeave) return;
    const statusToSave = newStatus || editStatus;
    if (!statusToSave) return;
    setLoading(true);
    setError(null);
    try {
      // Update leave status in backend
      await updateLeave(editingLeave.id, { status: statusToSave });
      // Refresh the table from backend
      await loadLeaves();
      // Update local state instantly
      setLeaves(prevLeaves => prevLeaves.map(l =>
        l.id === editingLeave.id ? { ...l, status: statusToSave, user_name: editingLeave.user_name, user_role: editingLeave.user_role } : l
      ));
      setShowEditModal(false);
      setEditingLeave(null);
      setEditStatus('');
      setIsEditMode(false);
      const wasApprovedOrRejected = ['Approved', 'Rejected'].includes(editingLeave.status);
      const isNowPending = statusToSave === 'Pending';
      const message = wasApprovedOrRejected && isNowPending
        ? 'Leave request change success'
        : 'Leave status updated successfully';
      showNotification(message, 'success');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update leave status');
      console.error('Error updating leave status:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaves = useMemo(() => {
    let result = leaves.filter(leave => leave.status === activeTab);
    
    // Apply filters only if showFilteredTable is true
    if (showFilteredTable) {
      // Filter by from date
      if (filter.from) {
        result = result.filter(leave => {
          const leaveToDate = new Date(leave.to_date);
          const filterFromDate = new Date(filter.from);
          return leaveToDate >= filterFromDate;
        });
      }
      
      // Filter by to date
      if (filter.to) {
        result = result.filter(leave => {
          const leaveFromDate = new Date(leave.from_date);
          const filterToDate = new Date(filter.to);
          return leaveFromDate <= filterToDate;
        });
      }
      
      // Filter by department
      if (filter.department) {
        result = result.filter(leave => {
          const leaveDept = leave.department_name || leave.department || '';
          return leaveDept.toLowerCase().includes(filter.department.toLowerCase());
        });
      }
      
      // Filter by username
      if (filter.username) {
        result = result.filter(leave => {
          const userName = leave.user_name || leave.employee_name || leave.name || 
            (leave.firstname && leave.lastname ? `${leave.firstname} ${leave.lastname}` : 
            leave.firstname || leave.lastname || '');
          return userName.toLowerCase().includes(filter.username.toLowerCase());
        });
      }
    }
    
    return result;
  }, [leaves, activeTab, filter, showFilteredTable]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const computeDays = (leave) => {
    // Prefer known fields if available
    const credited = leave?.credited_days ?? leave?.leave_duration ?? leave?.duration;
    if (credited !== undefined && credited !== null && credited !== '') {
      const n = Number(credited);
      if (!Number.isNaN(n)) return n;
    }
    // Fallback: inclusive date difference
    try {
      const from = new Date(leave.from_date);
      const to = new Date(leave.to_date);
      const msPerDay = 24 * 60 * 60 * 1000;
      const diff = Math.round((to - from) / msPerDay) + 1;
      return diff > 0 ? diff : 0;
    } catch (e) {
      return 0;
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] p-6">
      <div className="max-w-7xl mx-auto">
        <Notification
          show={notification.show}
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ show: false, message: '', type: '' })}
        />
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-[color:var(--text-primary)]">Leave Approval (Management)</h1>
          <p className="text-sm text-[color:var(--text-secondary)]">Approve or reject leave requests</p>
        </div>

        {error && (
          <div className="mb-4 rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-[color:var(--danger)]">
            {error}
          </div>
        )}


        {/* Status Tabs */}
        <div className="mb-6 flex gap-2">
          {['Pending', 'Approved', 'Rejected'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                activeTab === tab
                  ? 'bg-[color:var(--accent)] text-white'
                  : 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] hover:bg-[color:var(--accent)] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Leave List with Filters (only for tab selected) */}
        {['Pending', 'Approved', 'Rejected'].includes(activeTab) && (
          <div className="mb-8">
            <div className="mb-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
              <div className="flex flex-row flex-wrap items-end gap-4 w-full">
                <div className="min-w-[150px] max-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">From Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                    value={filter.from}
                    onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}
                  />
                </div>
                <div className="min-w-[150px] max-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">To Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                    value={filter.to}
                    onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}
                  />
                </div>
                <div className="min-w-[120px] max-w-[140px] flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Year</label>
                  <select
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                    value={filter.year}
                    onChange={e => setFilter(f => ({ ...f, year: Number(e.target.value) }))}
                  >
                    {[(currentYear - 1), currentYear, (currentYear + 1)].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[180px] max-w-[240px] flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Department</label>
                  <select
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                    value={filter.department || ''}
                    onChange={e => setFilter(f => ({ ...f, department: e.target.value }))}
                  >
                    <option value="">All Departments</option>
                    {Array.isArray(departmentOptions) && departmentOptions.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[180px] max-w-[240px] flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Username</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                    value={filter.username}
                    onChange={e => setFilter(f => ({ ...f, username: e.target.value }))}
                  />
                </div>
                <div className="min-w-[220px] flex flex-row items-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-[color:var(--accent)] px-4 py-2 font-semibold text-white transition hover:bg-[color:var(--accent-hover)]"
                    onClick={async () => {
                      setShowFilteredTable(true);
                      setCurrentPage(1);
                      // Fetch leaves with year and other filters
                      await loadLeaves({ year: filter.year });
                    }}
                  >
                    Search
                  </button>
                  {showFilteredTable && (
                    <button
                      className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 font-semibold text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
                      onClick={async () => {
                        setShowFilteredTable(false);
                        setFilter({ from: '', to: '', year: new Date().getFullYear(), department: '', username: '' });
                        setCurrentPage(1);
                        await loadLeaves();
                      }}
                      type="button"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ...existing code... */}
        <div className="mb-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border)]">
              <thead className="bg-[color:var(--accent)]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white rounded-tl-xl">S.No</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Date Range</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">No. of Days</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Details</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                {loading ? (
                  <tr><td colSpan="7" className="p-8 text-center text-[color:var(--text-secondary)]">Loading...</td></tr>
                ) : filteredLeaves.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-[color:var(--text-secondary)]">No {activeTab.toLowerCase()} leave requests</td></tr>
                ) : (
                  filteredLeaves.map((leave, idx) => (
                    <tr key={leave.id} className={`${idx % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]/60'} transition-colors duration-150 hover:bg-[color:var(--surface-hover)]`}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{idx + 1}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{leave.user_name}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{formatDate(leave.from_date)} - {formatDate(leave.to_date)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">{computeDays(leave)} day(s)</td>
                      <td className="cursor-pointer whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--accent)]">
                        <button
                          type="button"
                          title="View Details"
                          className="relative inline-flex items-center justify-center group"
                          onClick={() => { setEditingLeave(leave); setEditStatus(leave.status); setIsEditMode(false); setShowEditModal(true); }}
                        >
                          <span className="sr-only">View Details</span>
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[color:var(--surface-elevated)] px-2 py-1 text-xs font-medium text-[color:var(--text-primary)] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                            View Details
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M12.0003 3C17.3924 3 21.8784 6.87976 22.8189 12C21.8784 17.1202 17.3924 21 12.0003 21C6.60812 21 2.12215 17.1202 1.18164 12C2.12215 6.87976 6.60812 3 12.0003 3ZM12.0003 19C16.2359 19 19.8603 16.052 20.7777 12C19.8603 7.94803 16.2359 5 12.0003 5C7.7646 5 4.14022 7.94803 3.22278 12C4.14022 16.052 7.7646 19 12.0003 19ZM12.0003 16.5C9.51498 16.5 7.50026 14.4853 7.50026 12C7.50026 9.51472 9.51498 7.5 12.0003 7.5C14.4855 7.5 16.5003 9.51472 16.5003 12C16.5003 14.4853 14.4855 16.5 12.0003 16.5ZM12.0003 14.5C13.381 14.5 14.5003 13.3807 14.5003 12C14.5003 10.6193 13.381 9.5 12.0003 9.5C10.6196 9.5 9.50026 10.6193 9.50026 12C9.50026 13.3807 10.6196 14.5 12.0003 14.5Z"></path>
                          </svg>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[color:var(--text-primary)]">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          leave.status === 'Pending' ? 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]' :
                          leave.status === 'Approved' ? 'bg-[color:var(--success-soft)] text-[color:var(--success)]' :
                          'bg-[color:var(--danger-soft)] text-[color:var(--danger)]'
                        }`}>
                          {leave.status}
                        </span>
                        {['Approved', 'Rejected'].includes(leave.status) && leave.approver_name && (
                          <div className="mt-1 text-xs text-[color:var(--text-muted)]">by: {leave.approver_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        {leave.status === 'Pending' && (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleApprove(leave.id)}
                              disabled={loading}
                              className="rounded-lg bg-[color:var(--success)] p-2 text-white transition hover:opacity-90 disabled:opacity-40"
                              title="Approve"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleReject(leave.id)}
                              disabled={loading}
                              className="rounded-lg bg-[color:var(--danger)] p-2 text-white transition hover:opacity-90 disabled:opacity-40"
                              title="Reject"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                          {['Approved', 'Rejected'].includes(leave.status) && (
                            <button
                              onClick={() => handleEditClick(leave)}
                              className="rounded-lg p-2 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-hover)]"
                              title="Edit Status"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showEditModal && editingLeave && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => { setShowEditModal(false); setIsEditMode(false); }} />
            <div className="inline-block w-full max-w-lg overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-left align-bottom shadow-xl transition-all transform sm:my-8 sm:align-middle sm:w-full">
              <div className="px-6 py-4 bg-[color:var(--accent)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium leading-6 text-white">Leave Details</h3>
                  <button className="text-white hover:opacity-80" onClick={() => { setShowEditModal(false); setIsEditMode(false); }}>
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="bg-[color:var(--surface)] px-6 py-5">
                <div className="mb-2 text-[color:var(--text-secondary)]">
                  <span className="font-semibold">Name:</span> {editingLeave.user_name}
                </div>
                <div className="mb-2 font-semibold text-[color:var(--text-secondary)]">
                  Duration: {computeDays(editingLeave)} day(s)
                </div>
                <div className="mb-2 text-[color:var(--text-secondary)]">
                  <span className="font-semibold">Date Range:</span> {formatDate(editingLeave.from_date)} - {formatDate(editingLeave.to_date)}
                </div>
                <div className="mb-2 text-[color:var(--text-secondary)]">
                  <span className="font-semibold">Reason:</span> {editingLeave.leave_reason}
                </div>
                <div className="mb-2 text-[color:var(--text-secondary)]">
                  <span className="font-semibold">Status:</span> {editingLeave.status}
                </div>
                {['Approved', 'Rejected'].includes(editingLeave.status) && editingLeave.approver_name && (
                  <div className="mb-2 text-xs text-[color:var(--text-muted)]">by: {editingLeave.approver_name}</div>
                )}
                {(isEditMode || ['Approved', 'Rejected'].includes(editingLeave.status)) && (
                <div className="mt-4 border-t border-[color:var(--border)] pt-4">
                  <div className="mb-3">
                    <label className="mb-1 block text-sm font-semibold text-[color:var(--text-secondary)]">Change Status</label>
                    <select
                      value={editStatus || editingLeave.status}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--accent)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => handleEditStatusSave()}
                      className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
                      disabled={loading || ((editStatus || editingLeave.status) === editingLeave.status)}
                    >
                      Save Status
                    </button>
                    {['Approved', 'Rejected'].includes(editingLeave.status) && (
                      <button
                        type="button"
                        onClick={() => handleEditStatusSave('Pending')}
                        className="rounded-lg bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                        disabled={loading}
                      >
                        Allow Leave Request Change
                      </button>
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApprovalPage;
