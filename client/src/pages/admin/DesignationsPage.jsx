import { useEffect, useMemo, useState } from 'react';
import Notification from '../../components/common/Notification';
import { getDesignations, createDesignation, updateDesignation, deleteDesignation } from '../../api/designationApi';

const initialForm = { 
  designationName: '', 
  status: 'active' 
};

export default function DesignationsPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const load = async () => {
    try { 
      const res = await getDesignations(); 
      setRows(res.data?.data || []); 
    }
    catch { 
      setRows([]); 
    }
  };

  useEffect(() => { 
    load(); 
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
      designationName: row.designation_name || '',
      status: row.status || 'active',
    });
    setIsModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault(); 
    setError('');
    
    if (!form.designationName.trim()) {
      setError('Designation name is required');
      return;
    }

    try {
      const payload = { 
        ...form,
      };

      if (editingId) {
        await updateDesignation(editingId, payload);
        showNotification('Designation updated successfully!', 'success');
      } else {
        await createDesignation(payload);
        showNotification('Designation created successfully!', 'success');
      }
      
      onClose(); 
      load();
    } catch (e) { 
      const msg = e.response?.data?.message || 'Failed to save';
      setError(msg);
      showNotification(msg, 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Deactivate this designation?')) return;
    try { 
      await updateDesignation(id, { status: 'inactive' }); 
      load(); 
      showNotification('Designation deactivated successfully!', 'success');
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to deactivate designation';
      alert(msg);
      showNotification(msg, 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  // Export to Excel (CSV)
  const exportToExcel = () => {
    if (!filtered.length) {
      showNotification('No designations available to export', 'error');
      return;
    }

    const headers = ['S.NO', 'Designation Name', 'Status'];
    const rowsToExport = filtered.map((row, index) => [
      index + 1,
      `"${String(row.designation_name || '').replace(/"/g, '""')}"`,
      `"${String(row.status || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rowsToExport.map((row) => row.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `designations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showNotification('Designations exported successfully!', 'success');
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
      r.designation_name?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    ));
  }, [rows, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, rows]);

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-12 text-[color:var(--text-primary)] transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-[color:var(--text-primary)]">Designations</h1>
          <p className="text-lg text-[color:var(--text-secondary)]">Create, update and manage designations</p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search designations..." className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-10 pr-4 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" />
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-[color:var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="flex flex-col w-full gap-3 sm:w-auto sm:flex-row">
            <button onClick={exportToExcel} className="flex items-center justify-center w-full rounded-lg bg-[color:var(--success)] px-6 py-3 font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:opacity-90 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V8.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0012.586 4H4zm8 1.414L15.586 8H13a1 1 0 01-1-1V4.414zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
              Export
            </button>
            <button onClick={openCreate} className="flex items-center justify-center w-full rounded-lg bg-[color:var(--accent)] px-6 py-3 font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:opacity-90 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Add Designation
            </button>
          </div>
        </div>

        <div className="mb-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border)]">
              <thead className="bg-[color:var(--accent)]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Designation Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                {filtered.length === 0 ? (
                  <tr><td colSpan="4" className="px-6 py-12 text-center text-[color:var(--text-muted)]">No designations found</td></tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr key={row.id} className={`transition-colors duration-150 ${idx % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]'} hover:bg-[color:var(--surface-hover)]`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--text-primary)]">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--text-primary)]">{row.designation_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${row.status === 'active' ? 'bg-[color:var(--success-soft)] text-[color:var(--success)]' : 'bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)]'}`}>
                          {row.status}
                        </span>
                       </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="rounded-lg bg-[color:var(--accent)] p-2 text-white transition-colors duration-200 hover:opacity-90"
                            title="Edit Designation"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {row.status === 'active' && (
                            <button
                              onClick={() => remove(row.id)}
                              className="rounded-lg bg-[color:var(--danger)] p-2 text-white transition-colors duration-200 hover:opacity-90"
                              title="Deactivate Designation"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
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
                    <h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit Designation' : 'Add Designation'}</h3>
                    <button className="text-white hover:opacity-80" onClick={onClose}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="bg-[color:var(--surface)] px-6 py-5">
                  {error && <div className="mb-4 rounded border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]">{error}</div>}
                  <form className="space-y-5" onSubmit={submit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className={editingId ? "md:col-span-1" : "md:col-span-2"}>
                        <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Designation Name *</label>
                        <input 
                          type="text"
                          value={form.designationName} 
                          onChange={e=>setForm({ ...form, designationName: e.target.value })} 
                          className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" 
                          placeholder="HOD" 
                          required 
                        />
                      </div>
                      {editingId && (
                        <div className="md:col-span-1">
                          <label className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Status</label>
                          <select 
                            value={form.status} 
                            onChange={e=>setForm({ ...form, status: e.target.value })} 
                            className="block w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                      <button type="button" onClick={onClose} className="inline-flex justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 text-sm font-medium text-[color:var(--text-secondary)] shadow-sm hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]">Cancel</button>
                      <button type="submit" className="inline-flex justify-center rounded-lg bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]">{editingId ? 'Update Designation' : 'Create Designation'}</button>
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