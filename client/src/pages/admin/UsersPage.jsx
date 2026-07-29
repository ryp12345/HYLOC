import { useEffect, useMemo, useState } from 'react';
import Notification from '../../components/common/Notification';
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from '../../api/userApi';
import { getDepartments } from '../../api/departmentApi';
import { getDesignations } from '../../api/designationApi';
import { API_URL } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// Resolve a stored upload path (e.g. /api/uploads/users/EMP001.jpg) to an absolute URL
const getPhotoUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/api/uploads/') || path.startsWith('/uploads/')) {
    try {
      const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
      return `${appOrigin}${path}`;
    } catch {
      return path;
    }
  }
  try {
    const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
    return `${appOrigin}/api/uploads/users/${String(path).replace(/^\/+/, '')}`;
  } catch {
    return path;
  }
};

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
  staffPhoto: '',
  password: 'Password@123',
  confirmPassword: 'Password@123',
  role: 'employee',
  status: 'active'
};

export default function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const isManagementView = String(user?.role?.name || user?.role || '').toLowerCase() === 'management';

  const load = async () => {
    try { const res = await getUsers(); setRows(res.data?.data || []); }
    catch { setRows([]); }
  };

  const loadDepartments = async () => {
    try {
      const depts = (await getDepartments()).data?.data || [];
      const sorted = [...depts].sort((a, b) => (a.department_name || '').localeCompare(b.department_name || ''));
      setDepartments(sorted);
    }
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

  const onClose = () => { setIsModalOpen(false); setEditingId(null); setForm(initialForm); setError(''); setShowPassword(false); setShowConfirmPassword(false); setPhotoFile(null); setPhotoPreview(''); };
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
      staffPhoto: row.staff_photo || '',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      role: row.role || 'employee',
      status: row.status || 'active',
    });
    setPhotoFile(null);
    setPhotoPreview(getPhotoUrl(row.staff_photo));
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
      if (!payload.staffPhoto) payload.staffPhoto = null;

      // Use multipart/form-data when a new photo file is selected
      let requestData = payload;
      if (photoFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== null && value !== undefined) fd.append(key, value);
        });
        fd.append('staffPhoto', photoFile);
        requestData = fd;
      }

      const newStaffPhoto = photoFile ? photoPreview : (form.staffPhoto || null);

      if (editingId) {
        await updateUser(editingId, requestData);
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
              staff_photo: newStaffPhoto,
              department_name: payload.departmentId ? departmentName : '--N/A--',
              designation_name: payload.designationId ? designationName : '--N/A--',
              status: form.status || r.status,
            }
            : r
        )));
        showNotification('User updated successfully!', 'success');
      } else {
        await createUser(requestData);
        showNotification('User created successfully!', 'success');
      }
      await load();
      onClose();
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save';
      setError(msg);
      showNotification(msg, 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(id);
      load();
      showNotification('User deleted successfully!', 'success');
    } catch { }
  };

  const openReset = (row) => {
    setResetTarget(row);
    setResetError('');
    setIsResetOpen(true);
  };

  const closeReset = () => {
    setIsResetOpen(false);
    setResetTarget(null);
    setResetError('');
    setResetLoading(false);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      await resetUserPassword(resetTarget.id, 'Password@123');
      showNotification('Password reset successfully!', 'success');
      closeReset();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password';
      setResetError(msg);
      setResetLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const exportToExcel = () => {
    if (!filtered.length) {
      showNotification('No users available to export', 'error');
      return;
    }

    const headers = ['S.NO', 'Emp ID', 'Name', 'Email', 'Department', 'Designation', 'Status'];
    const rowsToExport = filtered.map((u, index) => [
      index + 1,
      `"${String(u.empid || '--N/A--').replace(/"/g, '""')}"`,
      `"${String(`${u.firstname || ''} ${u.middlename || ''} ${u.lastname || ''}`.trim()).replace(/"/g, '""')}"`,
      `"${String(u.email || '').replace(/"/g, '""')}"`,
      `"${String(u.department_name || '--N/A--').replace(/"/g, '""')}"`,
      `"${String(u.designation_name || '--N/A--').replace(/"/g, '""')}"`,
      `"${String(u.status || 'active').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rowsToExport.map((row) => row.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showNotification('Users exported successfully!', 'success');
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [sortConfig, setSortConfig] = useState([]);

  const getSortValue = (row, key) => {
    switch (key) {
      case 'name':
        return `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.trim();
      case 'empid':
        return row.empid || '';
      case 'department':
        return row.department_name || '';
      case 'designation':
        return row.designation_name || '';
      case 'email':
        return row.email || '';
      case 'status':
        return row.status || '';
      default:
        return '';
    }
  };

  const handleSort = (key, additive = false) => {
    setSortConfig((current) => {
      const existingIndex = current.findIndex(item => item.key === key);

      if (existingIndex >= 0) {
        const next = [...current];
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          direction: existing.direction === 'asc' ? 'desc' : 'asc',
        };
        return additive
          ? next
          : [next[existingIndex], ...next.filter((_, index) => index !== existingIndex)];
      }

      return additive ? [...current, { key, direction: 'asc' }] : [{ key, direction: 'asc' }];
    });
  };

  // Filtered, sorted, and paginated data
  const filtered = useMemo(() => {
    // Sort by the configured column priority list.
    const sorted = [...rows].sort((a, b) => {
      for (const sortItem of sortConfig) {
        const aValue = String(getSortValue(a, sortItem.key)).toLowerCase();
        const bValue = String(getSortValue(b, sortItem.key)).toLowerCase();
        const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
        if (comparison !== 0) {
          return sortItem.direction === 'asc' ? comparison : -comparison;
        }
      }

      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });

    const departmentValue = String(departmentFilter || '').trim().toLowerCase();
    const designationValue = String(designationFilter || '').trim().toLowerCase();

    const filteredBySelects = sorted.filter((row) => {
      const matchesDepartment = !departmentValue || String(row.department_id || '').toLowerCase() === departmentValue;
      const matchesDesignation = !designationValue || String(row.designation_id || '').toLowerCase() === designationValue;
      return matchesDepartment && matchesDesignation;
    });

    const q = String(search || '').trim().toLowerCase();
    if (!q) return filteredBySelects;

    // Tokenize query so multi-word searches (e.g., "John Doe") match when all tokens exist
    const tokens = q.split(/\s+/).filter(Boolean);

    return filteredBySelects.filter(r => {
      const fields = [
        (r.empid || '').toLowerCase(),
        `${r.firstname || ''} ${r.middlename || ''} ${r.lastname || ''}`.toLowerCase(),
        (r.firstname || '').toLowerCase(),
        (r.middlename || '').toLowerCase(),
        (r.lastname || '').toLowerCase(),
        (r.email || '').toLowerCase(),
        (r.phone || '').toLowerCase(),
        (r.department_name || '').toLowerCase(),
        (r.designation_name || '').toLowerCase(),
        (r.role || '').toLowerCase(),
        (r.status || '').toLowerCase()
      ];

      // All tokens must be present in at least one of the fields
      return tokens.every(t => fields.some(f => f.includes(t)));
    });
  }, [rows, search, sortConfig, departmentFilter, designationFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, rows, sortConfig, departmentFilter, designationFilter]);

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-12 text-[color:var(--text-primary)] transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-[color:var(--text-primary)]">
            {isManagementView ? 'User Credentials' : 'Users'}
          </h1>
          <p className="text-lg text-[color:var(--text-secondary)]">
            {isManagementView ? 'Reset passwords and manage user credentials' : 'Create, update and manage users'}
          </p>
        </div>

        {/* <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="relative w-full">
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search users..." className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="w-full">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.department_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full">
              <select
                value={designationFilter}
                onChange={(e) => setDesignationFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All Designations</option>
                {designations.map((desig) => (
                  <option key={desig.id} value={desig.id}>
                    {desig.designation_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col w-full gap-3 sm:flex-row lg:w-auto">
            <button onClick={exportToExcel} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V8.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0012.586 4H4zm8 1.414L15.586 8H13a1 1 0 01-1-1V4.414zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
              Export
            </button>
            <button onClick={openCreate} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Add User
            </button>
          </div>
        </div> */}

        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-end lg:justify-between">

          {/* Filters Section */}
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {/* Search */}
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-10 pr-4 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
              />

              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-3 top-2.5 h-5 w-5 text-[color:var(--text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Department */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
            >
              <option value="">All Departments</option>

              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.department_name}
                </option>
              ))}
            </select>

            {/* Designation */}
            <select
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
            >
              <option value="">All Designations</option>

              {designations.map((desig) => (
                <option key={desig.id} value={desig.id}>
                  {desig.designation_name}
                </option>
              ))}
            </select>

          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row shrink-0">

            <button
              onClick={exportToExcel}
              className="flex items-center justify-center rounded-lg bg-[color:var(--success)] px-6 py-2 font-medium text-white shadow transition hover:opacity-90"
            >
              Export
            </button>

            {!isManagementView && (
              <button
                onClick={openCreate}
                className="flex items-center justify-center rounded-lg bg-[color:var(--accent)] px-6 py-2 font-medium text-white shadow transition hover:opacity-90"
              >
                Add User
              </button>
            )}

          </div>

        </div>
        <div className="mb-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border)]">
              <thead className="bg-[color:var(--accent)]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">
                    <button type="button" onClick={(e) => handleSort('empid', e.shiftKey)} className="inline-flex items-center gap-2" title="Sort by employee ID">
                      Emp ID
                      <span className="text-[10px]">{sortConfig[0]?.key === 'empid' ? (sortConfig[0].direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Photo</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">
                    <button type="button" onClick={(e) => handleSort('name', e.shiftKey)} className="inline-flex items-center gap-2" title="Sort by staff name">
                      Name
                      <span className="text-[10px]">{sortConfig[0]?.key === 'name' ? (sortConfig[0].direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">
                    <button type="button" onClick={(e) => handleSort('department', e.shiftKey)} className="inline-flex items-center gap-2" title="Sort by department">
                      Department
                      <span className="text-[10px]">{sortConfig[0]?.key === 'department' ? (sortConfig[0].direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">
                    <button type="button" onClick={(e) => handleSort('designation', e.shiftKey)} className="inline-flex items-center gap-2" title="Sort by designation">
                      Designation
                      <span className="text-[10px]">{sortConfig[0]?.key === 'designation' ? (sortConfig[0].direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                {filtered.length === 0 ? (
                  <tr><td colSpan="10" className="px-6 py-12 text-center text-[color:var(--text-muted)]">No users found</td></tr>
                ) : (
                  paginated.map((u, idx) => (
                    <tr key={u.id} className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]'} hover:bg-[color:var(--surface-hover)]`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--text-primary)]">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-secondary)]">{u.empid || '--N/A--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {u.staff_photo ? (
                           <img src={getPhotoUrl(u.staff_photo)} alt="Staff" className="h-12 w-12 rounded-full border border-[color:var(--border)] object-cover" />
                        ) : (
                          <span className="text-sm text-[color:var(--text-muted)]">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--text-primary)]">{u.firstname} {u.middlename || ''} {u.lastname}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-secondary)]">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-secondary)]">{u.department_name || '--N/A--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-secondary)]">{u.designation_name || '--N/A--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'active' ? 'bg-[color:var(--success-soft)] text-[color:var(--success)]' : 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]'
                          }`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          {isManagementView ? (
                            <button
                              onClick={() => openReset(u)}
                              className="rounded-lg bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:opacity-90"
                              title="Reset Password"
                            >
                              Reset Password
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => openEdit(u)}
                                className="rounded-lg bg-[color:var(--accent)] p-2 text-white transition-colors duration-200 hover:opacity-90"
                                title="Edit User"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => remove(u.id)}
                                className="rounded-lg bg-[color:var(--danger)] p-2 text-white transition-colors duration-200 hover:opacity-90"
                                title="Deactivate User"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
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
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="text-sm text-[color:var(--text-secondary)]">
                Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
              </span>
              <button
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-secondary)] disabled:opacity-50"
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
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="bg-[color:var(--accent)] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit User' : 'Add User'}</h3>
                    <button className="text-white hover:opacity-80" onClick={onClose}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="bg-[color:var(--surface)] px-6 py-5">
                  {error && <div className="mb-4 rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]">{error}</div>}
                  <form className="space-y-5" onSubmit={submit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Employee ID<span className='text-red-500'>*</span></label>
                        <input value={form.empid} onChange={e => setForm({ ...form, empid: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="EMP-001" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">First Name<span className='text-red-500'>*</span></label>
                        <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="John" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Middle Name<span className='text-red-500'>*</span></label>
                        <input value={form.middleName} onChange={e => setForm({ ...form, middleName: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="James" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Last Name<span className='text-red-500'>*</span></label>
                        <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="Doe" required />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Email<span className='text-red-500'>*</span></label>
                        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="john@example.com" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Phone</label>
                        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="91+ 1234567890" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Blood Group</label>
                        <select value={form.bloodGroup} onChange={e => setForm({ ...form, bloodGroup: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]">
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
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Address</label>
                        <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="123 Main Street, City" rows="2" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Department<span className='text-red-500'>*</span></label>
                        <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]">
                          <option value="">Select Department</option>
                          {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Designation<span className='text-red-500'>*</span></label>
                        <select value={form.designationId} onChange={e => setForm({ ...form, designationId: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]">
                          <option value="">Select Designation</option>
                          {designations.map(desig => (
                            <option key={desig.id} value={desig.id}>{desig.designation_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Staff Photo</label>
                        {photoPreview && (
                          <img src={photoPreview} alt="Staff preview" className="mb-2 h-20 w-20 rounded-full border border-[color:var(--border)] object-cover" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setPhotoFile(file);
                            setPhotoPreview(file ? URL.createObjectURL(file) : (form.staffPhoto || ''));
                          }}
                          className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                        />
                      </div>
                      {!editingId && (
                        <>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Password<span className='text-red-500'>*</span></label>
                            <div className="relative">
                              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="••••••••" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
                                {showPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-4.753 4.753m4.753-4.753L9.172 9.172M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7C7.523 19 3.732 16.057 2.458 12z" /></svg>
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Confirm Password<span className='text-red-500'>*</span></label>
                            <div className="relative">
                              <input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" placeholder="••••••••" />
                              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
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
                          <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Status</label>
                          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                      <button type="button" onClick={onClose} className="inline-flex justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 text-sm font-medium text-[color:var(--text-secondary)] shadow-sm hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]">Cancel</button>
                      <button type="submit" className="inline-flex justify-center rounded-lg bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]">{editingId ? 'Update User' : 'Create User'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {isResetOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={closeReset} />
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-[color:var(--accent)] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">
                      Reset Password :-{' '}
                      <span className="font-semibold">
                        {resetTarget ? `${resetTarget.firstname || ''} ${resetTarget.middlename || ''} ${resetTarget.lastname || ''}`.trim() || resetTarget.empid : ''}
                      </span>
                    </h3>
                    <button className="text-white hover:opacity-80" onClick={closeReset}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="bg-[color:var(--surface)] px-6 py-5">
                  {resetError && <div className="mb-4 rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]">{resetError}</div>}
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    This will reset the password for{' '}
                    <span className="font-semibold text-[color:var(--text-primary)]">
                      {resetTarget ? `${resetTarget.firstname || ''} ${resetTarget.middlename || ''} ${resetTarget.lastname || ''}`.trim() || resetTarget.empid : ''}
                    </span>{' '}
                    to the default <span className="font-mono font-semibold text-[color:var(--text-primary)]">Password@123</span>.
                  </p>

                  <div className="flex justify-end space-x-4 pt-6">
                    <button type="button" onClick={closeReset} className="inline-flex justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 text-sm font-medium text-[color:var(--text-secondary)] shadow-sm hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]">Cancel</button>
                    <button type="button" onClick={submitReset} disabled={resetLoading} className="inline-flex justify-center rounded-lg bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] disabled:opacity-50">
                      {resetLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
