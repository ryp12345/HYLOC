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
      const sortedUsers = [...(res.data?.data || [])].sort((a, b) => {
        const aName = `${a.firstname || ''} ${a.lastname || ''} ${a.email || ''}`.trim().toLowerCase();
        const bName = `${b.firstname || ''} ${b.lastname || ''} ${b.email || ''}`.trim().toLowerCase();
        return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
      });
      setUsers(sortedUsers); 
    }
    catch { setUsers([]); }
  };
  
  const loadRoles = async () => {
    try { 
      const res = await getRoles(); 
      const sortedRoles = [...(res.data?.data || [])].sort((a, b) => {
        const aName = String(a.role_name || '').trim().toLowerCase();
        const bName = String(b.role_name || '').trim().toLowerCase();
        return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
      });
      setRoles(sortedRoles); 
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
    if (!merged.length) {
      showNotification('No user roles available to export', 'error');
      return;
    }

    const headers = ['S.NO', 'User', 'Roles', 'Status', 'Assigned At'];
    const rowsToExport = merged.map((row, index) => [
      index + 1,
      `"${String(`${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''} (${row.email || ''})`.trim()).replace(/"/g, '""')}"`,
      `"${String(row.roles.map(r => r.role_name).join(', ')).replace(/"/g, '""')}"`,
      `"${String(row.roles.map(r => r.status || 'active').join(', ')).replace(/"/g, '""')}"`,
      `"${String(row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '').replace(/"/g, '""')}"`,
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

  // Merge role assignments that belong to the same user into a single row
  const merged = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const key = r.email || r.user_id || r.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          firstname: r.firstname,
          middlename: r.middlename,
          lastname: r.lastname,
          email: r.email,
          roles: [],
          createdAt: r.created_at,
        });
      }
      const entry = map.get(key);
      entry.roles.push(r);
      if (r.created_at && (!entry.createdAt || new Date(r.created_at) < new Date(entry.createdAt))) {
        entry.createdAt = r.created_at;
      }
    }
    return [...map.values()];
  }, [filtered]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return merged.slice(start, start + PAGE_SIZE);
  }, [merged, page]);

  useEffect(() => { setPage(1); }, [search, rows]);

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-12 text-[color:var(--text-primary)] transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-[color:var(--text-primary)]">User Roles</h1>
          <p className="text-lg text-[color:var(--text-secondary)]">Assign and manage user roles</p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search user roles..." className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-10 pr-4 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" />
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-[color:var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="flex flex-col w-full gap-3 sm:w-auto sm:flex-row">
            <button onClick={exportToExcel} className="flex items-center justify-center w-full rounded-lg bg-[color:var(--success)] px-6 py-3 font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:opacity-90 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V8.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0012.586 4H4zm8 1.414L15.586 8H13a1 1 0 01-1-1V4.414zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
              Export
            </button>
            <button onClick={openCreate} className="flex items-center justify-center w-full rounded-lg bg-[color:var(--accent)] px-6 py-3 font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:opacity-90 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Add User Role
            </button>
          </div>
        </div>

        <div className="mb-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border)]">
              <thead className="bg-[color:var(--accent)]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Role</th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Assigned At</th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                {merged.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-[color:var(--text-muted)]">No user roles found</td></tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr key={row.key} className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]'} hover:bg-[color:var(--surface-hover)]`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--text-primary)]">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-secondary)]">
                        {`${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.trim()} ({row.email})
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex flex-col gap-2 items-start">
                          {row.roles.map((role) => (
                            <span key={role.id} className="inline-flex whitespace-nowrap rounded-full bg-[color:var(--accent-soft)] px-2.5 py-1 text-xs font-semibold leading-5 text-[color:var(--accent)]">
                              {role.role_name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-2">
                          {row.roles.map((role) => (
                            <span key={role.id} className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold leading-5 ${role.status === 'active' ? 'bg-[color:var(--success-soft)] text-[color:var(--success)]' : 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]'}`}>
                              {role.status || 'active'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[color:var(--text-secondary)]">
                        <div className="flex flex-col gap-2">
                          {row.roles.map((role) => (
                            <span key={role.id} className="whitespace-nowrap">
                              {role.created_at ? new Date(role.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-medium">
                        <div className="flex flex-col items-center gap-2">
                          {row.roles.map((role) => (
                            <div key={role.id} className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => openEdit(role)}
                                className="rounded-lg bg-[color:var(--accent)] p-2 text-white transition-colors duration-200 hover:opacity-90"
                                title={`Edit ${role.role_name} Role`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => remove(role.id)}
                                className="rounded-lg bg-[color:var(--danger)] p-2 text-white transition-colors duration-200 hover:opacity-90"
                                title={`Delete ${role.role_name} Role`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {merged.length > PAGE_SIZE && (
            <div className="flex justify-end items-center gap-2 px-6 pb-6">
              <button
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="text-sm text-[color:var(--text-secondary)]">
                 Page {page} of {Math.ceil(merged.length / PAGE_SIZE)}
              </span>
              <button
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] disabled:opacity-50"
                onClick={() => setPage(p => Math.min(Math.ceil(merged.length / PAGE_SIZE), p + 1))}
                disabled={page === Math.ceil(merged.length / PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
                <div className="bg-[color:var(--accent)] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit User Role' : 'Add User Role'}</h3>
                    <button className="text-white hover:opacity-80" onClick={onClose}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="bg-[color:var(--surface)] px-6 py-5">
                  {error && <div className="mb-4 rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]">{error}</div>}
                  <form className="space-y-5" onSubmit={submit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">User</label>
                        <select
                          value={form.userId}
                          onChange={(e) => setForm({ ...form, userId: e.target.value })}
                          className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
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
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Role</label>
                        <select
                          value={form.roleId}
                          onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                          className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
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
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                      <button type="button" onClick={onClose} className="inline-flex justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 text-sm font-medium text-[color:var(--text-secondary)] shadow-sm hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]">Cancel</button>
                      <button type="submit" className="inline-flex justify-center rounded-lg bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]">{editingId? 'Update Role':'Create Role'}</button>
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
