import { useEffect, useMemo, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/userApi';
import { getDepartments } from '../../api/departmentApi';
import { getDesignations } from '../../api/designationApi';

const initialForm = { 
  firstName: '', 
  middleName: '',
  lastName: '', 
  email: '', 
  empid: '',
  phone: '',
  address: '',
  bloodGroup: '',
  departmentId: '',
  designationId: '',
  password: 'Password@123', 
  confirmPassword: 'Password@123',
  role: 'employee', 
  status: 'active' 
};

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  const load = async () => {
    try { const res = await getUsers(); setRows(res.data?.data || []); }
    catch { setRows([]); }
  };
  
  const loadDepartments = async () => {
    try { const res = await getDepartments(); setDepartments(res.data?.data || []); }
    catch { setDepartments([]); }
  };
  
  const loadDesignations = async () => {
    try { const res = await getDesignations(); setDesignations(res.data?.data || []); }
    catch { setDesignations([]); }
  };
  
  useEffect(() => { 
    load(); 
    loadDepartments();
    loadDesignations();
  }, []);

  const onClose = () => { setIsModalOpen(false); setEditingId(null); setForm(initialForm); setError(''); setShowPassword(false); setShowConfirmPassword(false); };
  const openCreate = () => { onClose(); setIsModalOpen(true); };
  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      firstName: row.firstname || '',
      middleName: row.middlename || '',
      lastName: row.lastname || '',
      email: row.email || '',
      empid: row.empid || '',
      phone: row.phone || '',
      address: row.address || '',
      bloodGroup: row.bloodgroup || '',
      departmentId: row.department_id || '',
      designationId: row.designation_id || '',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      role: row.role || 'employee',
      status: row.status || 'active',
    });
    setIsModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const payload = { 
        ...form,
      };
      // Don't send password fields on edit
      if (editingId) {
        delete payload.password;
        delete payload.confirmPassword;
      }
      // Normalize optional fields to null instead of empty strings
      if (!payload.empid) payload.empid = null;
      if (!payload.phone) payload.phone = null;
      if (!payload.address) payload.address = null;
      if (!payload.bloodGroup) payload.bloodGroup = null;
      if (!payload.departmentId) payload.departmentId = null;
      if (!payload.designationId) payload.designationId = null;

      if (editingId) {
        await updateUser(editingId, payload);
        // Optimistically update UI in case list refresh is delayed
        const departmentName = departments.find(d => String(d.id) === String(payload.departmentId))?.department_name || '--N/A--';
        const designationName = designations.find(d => String(d.id) === String(payload.designationId))?.designation_name || '--N/A--';
        setRows(prev => prev.map(r => (
          r.id === editingId
            ? {
                ...r,
                firstname: form.firstName,
                middlename: form.middleName,
                lastname: form.lastName,
                email: form.email,
                empid: payload.empid || null,
                phone: payload.phone || null,
                address: payload.address || null,
                bloodgroup: payload.bloodGroup || null,
                department_id: payload.departmentId || null,
                designation_id: payload.designationId || null,
                department_name: payload.departmentId ? departmentName : '--N/A--',
                designation_name: payload.designationId ? designationName : '--N/A--',
                status: form.status || r.status,
              }
            : r
        )));
      } else {
        await createUser(payload);
      }
      await load();
      onClose();
    } catch (e) { setError(e.response?.data?.message || 'Failed to save'); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this user?')) return;
    try { 
      await deleteUser(id);
      load(); 
    } catch {}
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Filtered, sorted, and paginated data
  const filtered = useMemo(() => {
    // Sort latest first by createdAt or id desc
    const sorted = [...rows].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });
    const q = search.toLowerCase();
    return sorted.filter(r => (
      r.firstname?.toLowerCase().includes(q) ||
      r.lastname?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.role?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
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
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-gray-900">Users</h1>
          <p className="text-lg text-gray-600">Create, update and manage users</p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search users..." className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add User
          </button>
        </div>

        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Emp ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-12 text-center text-gray-500">No users found</td></tr>
                ) : (
                  paginated.map((u, idx) => (
                    <tr key={u.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.empid || '--N/A--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.firstname} {u.middlename || ''} {u.lastname}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.department_name || '--N/A--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.designation_name || '--N/A--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
                            title="Edit User"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => remove(u.id)}
                            className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
                            title="Deactivate User"
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
          {/* Pagination Controls - moved outside table for valid DOM nesting */}
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
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="px-6 py-4 bg-blue-600">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit User' : 'Add User'}</h3>
                    <button className="text-white hover:text-gray-200" onClick={onClose}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="px-6 py-5 bg-white">
                  {error && <div className="mb-4 p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div>}
                  <form className="space-y-5" onSubmit={submit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">Employee ID</label>
                        <input value={form.empid} onChange={e=>setForm({ ...form, empid: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="EMP-001" />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">First Name</label>
                        <input value={form.firstName} onChange={e=>setForm({ ...form, firstName: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="John" required />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">Middle Name</label>
                        <input value={form.middleName} onChange={e=>setForm({ ...form, middleName: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="James" />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">Last Name</label>
                        <input value={form.lastName} onChange={e=>setForm({ ...form, lastName: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Doe" required />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Email</label>
                        <input type="email" value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="john@example.com" required />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">Phone</label>
                        <input value={form.phone} onChange={e=>setForm({ ...form, phone: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="91+ 1234567890" />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">Blood Group</label>
                        <select value={form.bloodGroup} onChange={e=>setForm({ ...form, bloodGroup: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Address</label>
                        <textarea value={form.address} onChange={e=>setForm({ ...form, address: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="123 Main Street, City" rows="2" />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">Department</label>
                        <select value={form.departmentId} onChange={e=>setForm({ ...form, departmentId: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="">Select Department</option>
                          {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">Designation</label>
                        <select value={form.designationId} onChange={e=>setForm({ ...form, designationId: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="">Select Designation</option>
                          {designations.map(desig => (
                            <option key={desig.id} value={desig.id}>{desig.designation_name}</option>
                          ))}
                        </select>
                      </div>
                      {!editingId && (
                        <>
                          <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">Password</label>
                            <div className="relative">
                              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e=>setForm({ ...form, password: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="••••••••" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-700">
                                {showPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-4.753 4.753m4.753-4.753L9.172 9.172M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7C7.523 19 3.732 16.057 2.458 12z" /></svg>
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">Confirm Password</label>
                            <div className="relative">
                              <input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={e=>setForm({ ...form, confirmPassword: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="••••••••" />
                              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-700">
                                {showConfirmPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-4.753 4.753m4.753-4.753L9.172 9.172M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7C7.523 19 3.732 16.057 2.458 12z" /></svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                      {editingId && (
                        <div>
                          <label className="block mb-2 text-sm font-medium text-gray-700">Status</label>
                          <select value={form.status} onChange={e=>setForm({ ...form, status: e.target.value })} className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                      <button type="button" onClick={onClose} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
                      <button type="submit" className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">{editingId? 'Update User':'Create User'}</button>
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
