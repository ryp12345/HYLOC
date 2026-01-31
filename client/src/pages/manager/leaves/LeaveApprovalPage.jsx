import React, { useState, useEffect } from 'react';
import { getMyLeaves, getAllLeaves, approveLeave, rejectLeave } from '../../../api/leaveApi';
import { useAuth } from '../../../context/AuthContext';

const LeaveApprovalPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState('my-leaves'); // 'my-leaves' or 'approve-leaves'
  const [myLeaves, setMyLeaves] = useState([]);
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Pending');

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
      // Manager sees Employee leaves <= 2 days only
      const response = await getAllLeaves({});
      const allLeaves = response.data.data || [];
      
      // Filter: Employee role with credited_days <= 2
      const filtered = allLeaves.filter(leave => {
        const role = leave.user_role;
        const duration = parseFloat(leave.credited_days);
        return role === 'Employee' && duration <= 2;
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
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredLeaves.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No {activeTab.toLowerCase()} leave requests
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredLeaves.map(leave => {
                const duration = parseFloat(leave.credited_days);
                const requiresManagementApproval = view === 'approve-leaves' && duration > 2;

                return (
                  <div key={leave.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      {/* Column 1: Leave Details */}
                      <div className="flex-1">
                        {view === 'approve-leaves' && (
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-800">
                              {leave.user_name}
                            </h3>
                            <span className="text-xs text-gray-400">
                              EmpID: {leave.empid}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">From:</span>{' '}
                            <span className="text-gray-600">{formatDate(leave.from_date)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">To:</span>{' '}
                            <span className="text-gray-600">{formatDate(leave.to_date)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Duration:</span>{' '}
                            <span className="text-gray-600">{leave.credited_days} day(s)</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Type:</span>{' '}
                            <span className="text-gray-600">{leave.leave_duration}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Leave Type:</span>{' '}
                            <span className="text-gray-600">{leave.leave_type}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Available on Phone:</span>{' '}
                            <span className="text-gray-600">{leave.available_on_phone ? 'Yes' : 'No'}</span>
                          </div>
                        </div>

                        <div className="mt-3 text-sm">
                          <div className="mb-2">
                            <span className="font-medium text-gray-700">Reason:</span>{' '}
                            <span className="text-gray-600">{leave.leave_reason}</span>
                          </div>
                          {leave.alternate_person && (
                            <div className="mb-2">
                              <span className="font-medium text-gray-700">Alternate Person:</span>{' '}
                              <span className="text-gray-600">{leave.alternate_person}</span>
                            </div>
                          )}
                          {leave.additional_alternate && (
                            <div>
                              <span className="font-medium text-gray-700">Additional Alternate:</span>{' '}
                              <span className="text-gray-600">{leave.additional_alternate}</span>
                            </div>
                          )}
                        </div>

                        {(leave.status === 'Approved' || leave.status === 'Rejected') && leave.approver_name && (
                          <div className="mt-2 text-sm text-gray-500">
                            {leave.status} by: {leave.approver_name}
                          </div>
                        )}
                      </div>

                      {/* Column 2: Status & Actions */}
                      <div className="ml-6 flex flex-col items-end gap-3">
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                          leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {leave.status}
                        </span>

                        {view === 'approve-leaves' && leave.status === 'Pending' && (
                          <>
                            {requiresManagementApproval ? (
                              <div className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm font-medium text-center">
                                Requires Management Approval
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(leave.id)}
                                  disabled={loading}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(leave.id)}
                                  disabled={loading}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveApprovalPage;
