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
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tl-xl">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Leave Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Alternate Person</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Available on Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeaves.map((leave, idx) => (
                  <tr key={leave.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.user_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.user_role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(leave.from_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(leave.to_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{parseInt(leave.credited_days, 10)} day(s)</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.leave_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.leave_reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.alternate_person || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.available_on_phone ? 'Yes' : 'No'}</td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveApprovalPage;
