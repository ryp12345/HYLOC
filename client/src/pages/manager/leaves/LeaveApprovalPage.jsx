import React, { useState, useEffect } from 'react';
import { getMyLeaves, getAllLeaves, approveLeave, rejectLeave } from '../../../api/leaveApi';
import { updateLeave } from '../../../api/leaveApi';
import { useAuth } from '../../../context/AuthContext';

const LeaveApprovalPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState('my-leaves'); // 'my-leaves' or 'approve-leaves'
  const [myLeaves, setMyLeaves] = useState([]);
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Pending');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [editStatus, setEditStatus] = useState('');

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
      // Manager sees Employee leaves from same department, <= 2 days only
      const response = await getAllLeaves({});
      const allLeaves = response.data.data || [];
      
      // Get manager's department from user object
      const managerDepartmentId = user?.departmentId || user?.department_id;
      console.log('Manager department ID:', managerDepartmentId);
      console.log('Manager user object:', user);
      
      // Filter: Employee role with credited_days <= 2 AND same department
      const filtered = allLeaves.filter(leave => {
        const role = leave.user_role;
        const duration = parseFloat(leave.credited_days);
        const leaveDepartmentId = leave.department_id;
        const matches = role === 'Employee' && duration <= 2 && leaveDepartmentId === managerDepartmentId;
        if (role === 'Employee') {
          console.log(`Leave ${leave.id}: duration=${duration}, dept=${leaveDepartmentId}, matches=${matches}`);
        }
        return matches;
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
    if (view === 'my-leaves') {
      loadMyLeaves();
    } else {
      loadEmployeeLeaves();
    }
  }, [view]);

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
    setShowEditModal(true);
  };

  const handleEditStatusSave = async () => {
    if (!editingLeave) return;
    setLoading(true);
    setError(null);
    try {
      // Update leave status in backend
      await updateLeave(editingLeave.id, { status: editStatus });
      // Refresh the table from backend
      await loadEmployeeLeaves();
      // Update local state instantly
      setEmployeeLeaves(prevLeaves => prevLeaves.map(l =>
        l.id === editingLeave.id ? { ...l, status: editStatus, user_name: editingLeave.user_name, user_role: editingLeave.user_role } : l
      ));
      setShowEditModal(false);
      setEditingLeave(null);
      setEditStatus('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update leave status');
      console.error('Error updating leave status:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentLeaves = view === 'my-leaves' ? myLeaves : employeeLeaves;
  const filteredLeaves = currentLeaves.filter(leave => leave.status === activeTab);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Leave Approval (Manager)</h1>
          <p className="text-sm text-gray-600">Manage your leaves and approve employee requests</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* View Toggle Buttons */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => {
              setView('my-leaves');
              setActiveTab('Pending');
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              view === 'my-leaves'
                ? 'bg-purple-600 text-white'
                : 'bg-blue-100 text-gray-700 hover:bg-blue-200'
            }`}
          >
            Status of my Leave Requests
          </button>
          <button
            onClick={() => {
              setView('approve-leaves');
              setActiveTab('Pending');
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              view === 'approve-leaves'
                ? 'bg-purple-600 text-white'
                : 'bg-blue-100 text-gray-700 hover:bg-blue-200'
            }`}
          >
            Approve/Reject Employee Leaves
          </button>
        </div>

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

        {/* Leave List */}
        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tl-xl">S.No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date Range</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700 underline cursor-pointer">
                        <button onClick={() => { setEditingLeave(leave); setShowEditModal(true); }}>
                          View Details
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
                        {leave.status === 'Pending' && (
                          <div className="flex gap-2 justify-center">
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
                          </div>
                        )}
                        {['Approved', 'Rejected'].includes(leave.status) && (
                          <button
                            onClick={() => handleEditClick(leave)}
                            className="p-2 text-blue-600 hover:text-blue-800 rounded-lg"
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
          <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowEditModal(false)} />
            <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-6 py-4 bg-blue-600">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium leading-6 text-white">Leave Details</h3>
                  <button className="text-white hover:text-gray-200" onClick={() => setShowEditModal(false)}>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApprovalPage;
