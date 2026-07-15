import React, { useState, useEffect, useMemo } from 'react';
import { getMyLeaves, getAllLeaves, approveLeave, rejectLeave } from '../../../api/leaveApi';
import { updateLeave } from '../../../api/leaveApi';
import { useAuth } from '../../../context/AuthContext';
import Notification from '../../../components/common/Notification';

const LeaveApprovalPage = () => {
  const { user } = useAuth();
  // Only show approve/reject employee leaves
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [activeTab, setActiveTab] = useState('Pending');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  // Leave Search Filters state
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

  const loadMyLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getMyLeaves({});
      setMyLeaves(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load your leaves');
      console.error('Error loading my leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      // HOD sees ALL Employee leaves from same department (any duration)
      const response = await getAllLeaves({ year: filter.year });
      const allLeaves = response.data.data || [];
      const hodDepartmentId = user?.departmentId || user?.department_id;
      const filtered = allLeaves.filter(leave => {
        const role = leave.user_role;
        const leaveDepartmentId = leave.department_id;
        return role === 'Employee' && leaveDepartmentId === hodDepartmentId;
      });
      setEmployeeLeaves(filtered);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load employee leaves');
      console.error('Error loading employee leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeeLeaves();
  }, [filter.year]);

  const handleApprove = async (leaveId) => {
    if (!window.confirm('Approve this leave request?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await approveLeave(leaveId);
      await loadEmployeeLeaves();
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
      await loadEmployeeLeaves();
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
      await loadEmployeeLeaves();
      // Update local state instantly
      setEmployeeLeaves(prevLeaves => prevLeaves.map(l =>
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

  const currentLeaves = employeeLeaves;
  
  const filteredLeaves = useMemo(() => {
    let result = currentLeaves.filter(leave => leave.status === activeTab);
    
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

      // Filter by year (kept in local filter too, to avoid edge mismatches)
      if (filter.year) {
        result = result.filter(leave => {
          const leaveYear = new Date(leave.from_date).getFullYear();
          return leaveYear === Number(filter.year);
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
  }, [currentLeaves, activeTab, filter, showFilteredTable]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const computeDays = (leave) => {
    // Prefer credited_days if provided by backend
    const credited = leave?.credited_days;
    if (credited !== undefined && credited !== null && credited !== '') {
      const n = Number(credited);
      if (!Number.isNaN(n)) return n;
    }
    // Fallback: compute inclusive difference between from_date and to_date
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
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <Notification
          show={notification.show}
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ show: false, message: '', type: '' })}
        />
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-gray-800">Leave Approval (HOD)</h1>
          <p className="text-sm text-gray-600">Approve or reject employee leave requests</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {['Pending', 'Approved', 'Rejected'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-gray-700 hover:bg-blue-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Leave List with Filters (only for approve/reject employee leaves) */}
        {['Pending', 'Approved', 'Rejected'].includes(activeTab) && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
              <div className="flex flex-wrap items-end gap-4 w-full">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
                  <input
                    type="date"
                    className="border rounded px-3 py-2"
                    value={filter.from}
                    onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
                  <input
                    type="date"
                    className="border rounded px-3 py-2"
                    value={filter.to}
                    onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}
                  />
                </div>
                <div className="min-w-[200px] max-w-[320px] flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={filter.department || ''}
                    onChange={e => setFilter(f => ({ ...f, department: e.target.value }))}
                  >
                    <option value="">All Departments</option>
                    {Array.isArray(departmentOptions) && departmentOptions.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search names..."
                      className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={filter.username}
                      onChange={e => setFilter(f => ({ ...f, username: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { setShowFilteredTable(true); setCurrentPage(1); } }}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
                  <select
                    className="border rounded px-3 py-2"
                    value={filter.year}
                    onChange={e => setFilter(f => ({ ...f, year: Number(e.target.value) }))}
                  >
                    {[(currentYear - 1), currentYear, (currentYear + 1)].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {/* Search + Reset Buttons */}
                <div className="flex flex-row items-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                    onClick={async () => {
                      setShowFilteredTable(true);
                      setCurrentPage(1);
                      await loadLeaves({ year: filter.year });
                    }}
                  >
                    Search
                  </button>
                  {showFilteredTable && (
                    <button
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-300 transition"
                      onClick={() => {
                        setShowFilteredTable(false);
                        setFilter({ from: '', to: '', year: new Date().getFullYear(), department: '', username: '' });
                        setCurrentPage(1);
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
        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tl-xl">S.No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date Range</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">No. of Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="7" className="p-8 text-center text-gray-500">Loading...</td></tr>
                ) : filteredLeaves.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-gray-500">No {activeTab.toLowerCase()} leave requests</td></tr>
                ) : (
                  filteredLeaves.map((leave, idx) => (
                    <tr key={leave.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{
                        leave.user_name
                        || leave.employee_name
                        || leave.name
                        || (leave.firstname && leave.lastname ? `${leave.firstname} ${leave.lastname}`
                          : leave.firstname || leave.lastname || '-')
                      }</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(leave.from_date)} - {formatDate(leave.to_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{computeDays(leave)} day(s)</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700 cursor-pointer">
                        <button
                          type="button"
                          title="View Details"
                          className="relative inline-flex items-center justify-center group"
                          onClick={() => { setEditingLeave(leave); setEditStatus(leave.status); setIsEditMode(false); setShowEditModal(true); }}
                        >
                          <span className="sr-only">View Details</span>
                          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                            View Details
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M12.0003 3C17.3924 3 21.8784 6.87976 22.8189 12C21.8784 17.1202 17.3924 21 12.0003 21C6.60812 21 2.12215 17.1202 1.18164 12C2.12215 6.87976 6.60812 3 12.0003 3ZM12.0003 19C16.2359 19 19.8603 16.052 20.7777 12C19.8603 7.94803 16.2359 5 12.0003 5C7.7646 5 4.14022 7.94803 3.22278 12C4.14022 16.052 7.7646 19 12.0003 19ZM12.0003 16.5C9.51498 16.5 7.50026 14.4853 7.50026 12C7.50026 9.51472 9.51498 7.5 12.0003 7.5C14.4855 7.5 16.5003 9.51472 16.5003 12C16.5003 14.4853 14.4855 16.5 12.0003 16.5ZM12.0003 14.5C13.381 14.5 14.5003 13.3807 14.5003 12C14.5003 10.6193 13.381 9.5 12.0003 9.5C10.6196 9.5 9.50026 10.6193 9.50026 12C9.50026 13.3807 10.6196 14.5 12.0003 14.5Z"></path>
                          </svg>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {leave.status}
                        </span>
                        {['Approved', 'Rejected'].includes(leave.status) && leave.approver_name && (
                          <div className="text-xs text-gray-400 mt-1">by: {leave.approver_name}</div>
                        )}
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                         {(() => {
                           const isOwn = leave.user_id != null && user?.id != null
                             && Number(leave.user_id) === Number(user.id);
                           const ownerIsHod = !!leave.is_hod_holder;
                           const actionDisabled = isOwn || ownerIsHod;
                           if (leave.status === 'Pending') {
                             return (
                               <div className="flex gap-2 justify-center">
                                  {(parseFloat(leave.credited_days) > 2 || actionDisabled) ? (
                                    <div className="relative group inline-flex">
                                      <div className="flex gap-2">
                                        <button
                                          disabled
                                          className="p-2 text-white bg-gray-400 rounded-lg cursor-not-allowed"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </button>
                                        <button
                                          disabled
                                          className="p-2 text-white bg-gray-400 rounded-lg cursor-not-allowed"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                                        {actionDisabled ? 'Approval available in Management login' : 'Only Management can approve/reject leaves > 2 days'}
                                      </span>
                                    </div>
                                  ) : (
                                   <>
                                     <button
                                       onClick={() => handleApprove(leave.id)}
                                       disabled={loading}
                                       className="p-2 text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                                       title="Approve"
                                     >
                                       <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                       </svg>
                                     </button>
                                     <button
                                       onClick={() => handleReject(leave.id)}
                                       disabled={loading}
                                       className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                                       title="Reject"
                                     >
                                       <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                       </svg>
                                     </button>
                                   </>
                                 )}
                               </div>
                             );
                           }
                            if (['Approved', 'Rejected'].includes(leave.status)) {
                              return (
                                <div className="relative group inline-flex">
                                  <button
                                    onClick={() => handleEditClick(leave)}
                                    disabled={actionDisabled}
                                    className={`p-2 rounded-lg ${actionDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  {actionDisabled && (
                                    <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                                      Edit available in Management login
                                    </span>
                                  )}
                                </div>
                              );
                            }
                           return null;
                         })()}
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
          <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => { setShowEditModal(false); setIsEditMode(false); }} />
            <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-6 py-4 bg-blue-600">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium leading-6 text-white">Leave Details</h3>
                  <button className="text-white hover:text-gray-200" onClick={() => { setShowEditModal(false); setIsEditMode(false); }}>
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="px-6 py-5 bg-white">
                <div className="mb-2 text-gray-700">
                  <span className="font-semibold">Name:</span> {editingLeave.user_name}
                </div>
                <div className="mb-2 text-black font-semibold">
                  Duration: {String(editingLeave.credited_days)} day(s)
                </div>
                <div className="mb-2 text-gray-700">
                  <span className="font-semibold">Date Range:</span> {formatDate(editingLeave.from_date)} - {formatDate(editingLeave.to_date)}
                </div>
                <div className="mb-2 text-gray-700">
                  <span className="font-semibold">Reason:</span> {editingLeave.leave_reason}
                </div>
                <div className="mb-2 text-gray-700">
                  <span className="font-semibold">Status:</span> {editingLeave.status}
                </div>
                {['Approved', 'Rejected'].includes(editingLeave.status) && editingLeave.approver_name && (
                  <div className="mb-2 text-gray-500 text-xs">by: {editingLeave.approver_name}</div>
                )}
                {isEditMode && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="mb-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Change Status</label>
                    <select
                      value={editStatus || editingLeave.status}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                      disabled={loading || ((editStatus || editingLeave.status) === editingLeave.status)}
                    >
                      Save Status
                    </button>
                    {['Approved', 'Rejected'].includes(editingLeave.status) && (
                      <button
                        type="button"
                        onClick={() => handleEditStatusSave('Pending')}
                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:bg-gray-400"
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
