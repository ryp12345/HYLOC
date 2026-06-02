import { useEffect, useMemo, useState } from 'react';
import Notification from '../../components/common/Notification';
import { getUserRoles, createUserRole, updateUserRole, deleteUserRole } from '../../api/userRoleApi';
import { getUsers } from '../../api/userApi';
import { getRoles } from '../../api/roleApi';

const initialForm = { 
  userId: '', 
  roleId: '', 
  status: 'active' 
};

export default function UserRolePage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const load = async () => {
    try { 
      const res = await getUserRoles(); 
      setRows(res.data?.data || []); 
    }
    catch { setRows([]); }
  };
  
  const loadUsers = async () => {
    try { 
      const res = await getUsers(); 
      setUsers(res.data?.data || []); 
    }
    catch { setUsers([]); }
  };
  
  const loadRoles = async () => {
    try { 
      const res = await getRoles(); 
      setRoles(res.data?.data || []); 
    }
    catch { setRoles([]); }
  };
  
  useEffect(() => { 
    load(); 
    loadUsers();
    loadRoles();
    setSearch('');
  }, []);

  const onClose = () => { 
    setIsModalOpen(false); 
    setEditingId(null); 
    setForm(initialForm); 
    setError(''); 
  };

  const openCreate = () => { 
    onClose(); 
    setIsModalOpen(true); 
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      userId: row.user_id || '',
      roleId: row.role_id || '',
      status: row.status || 'active',
    });
    setIsModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault(); 
    setError('');
    try {
      if (!form.userId || !form.roleId) {
        throw new Error('User and Role are required');
      }

      const payload = { 
        userId: parseInt(form.userId),
        roleId: parseInt(form.roleId),
        status: form.status
      };

      if (editingId) {
        await updateUserRole(editingId, payload);
        showNotification('User role updated successfully!', 'success');
      } else {
        await createUserRole(payload);
        showNotification('User role created successfully!', 'success');
      }
      onClose(); 
      load();
    } catch (e) { 
      const msg = e.response?.data?.message || e.message || 'Failed to save';
      setError(msg);
      showNotification(msg, 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this user role?')) return;
    try { 
      await deleteUserRole(id); 
      load(); 
      showNotification('User role deleted successfully!', 'success');
    } catch {}
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const exportToExcel = () => {
    if (!filtered.length) {
      showNotification('No user roles available to export', 'error');
      return;
    }

    const headers = ['S.NO', 'User', 'Role', 'Status', 'Assigned At'];
    const rowsToExport = filtered.map((row, index) => [
      index + 1,
      `"${String(`${row.firstname || ''} ${row.lastname || ''} (${row.email || ''})`).replace(/"/g, '""')}"`,
      `"${String(row.role_name || '').replace(/"/g, '""')}"`,
      `"${String(row.status || 'active').replace(/"/g, '""')}"`,
      `"${String(new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rowsToExport.map((row) => row.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `user_roles_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showNotification('User roles exported successfully!', 'success');
  };

  const filtered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(r => (
      (r.email?.toLowerCase() || '').includes(q) ||
      (r.firstname?.toLowerCase() || '').includes(q) ||
      (r.lastname?.toLowerCase() || '').includes(q) ||
      (r.role_name?.toLowerCase() || '').includes(q) ||
      (r.status?.toLowerCase() || '').includes(q)
    ));
  }, [rows, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, rows]);

  return (
    <div className="min-h-screen px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-gray-900">User Roles</h1>
          <p className="text-lg text-gray-600">Assign and manage user roles</p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search user roles..." className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="flex flex-col w-full gap-3 sm:w-auto sm:flex-row">
            <button onClick={exportToExcel} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V8.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0012.586 4H4zm8 1.414L15.586 8H13a1 1 0 01-1-1V4.414zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
              Export
            </button>
            <button onClick={openCreate} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Add User Role
            </button>
          </div>
        </div>

        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Assigned At</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No user roles found</td></tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.firstname} {row.lastname} ({row.email})</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.role_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          row.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {row.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
                            title="Edit User Role"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => remove(row.id)}
                            className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
                            title="Delete User Role"
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

        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
                <div className="px-6 py-4 bg-blue-600">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit User Role' : 'Add User Role'}</h3>
                    <button className="text-white hover:text-gray-200" onClick={onClose}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="px-6 py-5 bg-white">
                  {error && <div className="mb-4 p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div>}
                  <form className="space-y-5" onSubmit={submit}>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">User</label>
                      <select
                        value={form.userId}
                        onChange={(e) => setForm({ ...form, userId: e.target.value })}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select User</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.email} - {user.firstname} {user.lastname}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">Role</label>
                      <select
                        value={form.roleId}
                        onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select Role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.role_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                      <button type="button" onClick={onClose} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
                      <button type="submit" className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">{editingId? 'Update Role':'Create Role'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
