import { useEffect, useMemo, useState } from 'react';
import Notification from '../../components/common/Notification';
import { getAllTickets, updateTicket, createTicket, getTicketCategories, getTicketPriorities, getTicketStatuses } from '../../api/ticketApi';
import { getUsers, getAssignableUsers } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';

const initialForm = {
  title: '',
  description: '',
  category: 'Other',
  priority: 'Medium',
  status: 'Open',
  user_id: '',
  assigned_to: '',
  due_date: '',
  attachment: '',
};

export default function TicketsPage() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState('mine');
  const { user } = useAuth();

  const load = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      // Fetch tickets and users independently so a 403 on users doesn't abort everything
      const [ticketsSettled, usersSettled] = await Promise.allSettled([
        getAllTickets(),
        getUsers(),
      ]);

      let ticketsRes = null;
      let usersRes = null;
      if (ticketsSettled.status === 'fulfilled') {
        ticketsRes = ticketsSettled.value;
      } else {
        console.debug('getAllTickets error:', ticketsSettled.reason?.response?.status, ticketsSettled.reason?.response?.data || ticketsSettled.reason?.message);
        ticketsRes = { data: { data: [] } };
      }

      if (usersSettled.status === 'fulfilled') {
        usersRes = usersSettled.value;
      } else {
        console.debug('getUsers error:', usersSettled.reason?.response?.status, usersSettled.reason?.response?.data || usersSettled.reason?.message);
        // Try a lower-privilege endpoint that returns assignable users for non-admins
        try {
          const assignRes = await getAssignableUsers();
          usersRes = assignRes;
        } catch (err) {
          console.debug('getAssignableUsers error:', err?.response?.status, err?.response?.data || err?.message);
          usersRes = { data: { data: [] } };
        }
      }

      // Fetch categories/priorities/statuses separately so we can capture errors per-call
      let categoriesRes = null;
      let prioritiesRes = null;
      let statusesRes = null;
      try {
        categoriesRes = await getTicketCategories();
      } catch (err) {
        console.debug('getTicketCategories error:', err?.response?.status, err?.response?.data || err?.message);
      }
      try {
        prioritiesRes = await getTicketPriorities();
      } catch (err) {
        console.debug('getTicketPriorities error:', err?.response?.status, err?.response?.data || err?.message);
      }
      try {
        statusesRes = await getTicketStatuses();
      } catch (err) {
        console.debug('getTicketStatuses error:', err?.response?.status, err?.response?.data || err?.message);
      }

      setRows(ticketsRes.data?.data || []);
      setUsers(usersRes.data?.data || []);
      // Use server-provided lists when available, otherwise fall back to defaults
      const serverCategories = categoriesRes?.data?.data;
      const serverPriorities = prioritiesRes?.data?.data;
      const defaultCategories = ['Other', 'Bug', 'Feature', 'Support'];
      const defaultPriorities = ['Low', 'Medium', 'High'];
      setCategories((serverCategories && serverCategories.length) ? serverCategories : defaultCategories);
      setPriorities((serverPriorities && serverPriorities.length) ? serverPriorities : defaultPriorities);
      const serverStatuses = statusesRes?.data?.data;
      const defaultStatuses = ['Open', 'Assigned', 'Pending', 'In Progress', 'Resolved', 'Rejected', 'Closed', 'Overdue'];
      setStatuses((serverStatuses && serverStatuses.length) ? serverStatuses : defaultStatuses);
    } catch {
      setRows([]);
      setUsers([]);
      setCategories(['Other', 'Bug', 'Feature', 'Support']);
      setPriorities(['Low', 'Medium', 'High']);
      setStatuses(['Open', 'Pending', 'Resolved']);
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
    setForm({ ...initialForm, user_id: user?.id ?? '' });
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    // If ticket is Open and unassigned (after rejection), clear assigned_to
    let initialStatus = row.status || 'Open';
    let assignedTo = row.assigned_to ? String(row.assigned_to) : '';
    if (initialStatus === 'Open' && !row.assigned_to) {
      assignedTo = '';
    } else if (row.assigned_to && (initialStatus === '' || String(initialStatus) === 'Open')) {
      initialStatus = 'Assigned';
    }
    setForm({
      title: row.title || '',
      description: row.description || '',
      category: row.category || 'Other',
      priority: row.priority || 'Medium',
      status: initialStatus,
      user_id: row.user_id || '',
      assigned_to: assignedTo,
      due_date: row.due_date ? row.due_date.slice(0, 10) : '',
      attachment: row.attachment || '',
    });
    setIsModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required');
      return;
    }
    if (!form.user_id) {
      setError('Created By (User) is required');
      return;
    }
    if (!form.due_date) {
      setError('Due Date is required');
      return;
    }
    try {
      if (editingId) {
        // If ticket is Open and creator assigns it, set status to Assigned
        const payload = { ...form };
        if (payload.status === 'Open' && payload.assigned_to && String(form.user_id) === String(user?.id)) {
          payload.status = 'Assigned';
        }
        if (payload.assigned_to !== '' && payload.assigned_to !== null) payload.assigned_to = Number(payload.assigned_to);
        await updateTicket(editingId, payload);
        showNotification('Ticket updated successfully!', 'success');
      } else {
        // Create: if attachment is a File, send multipart/form-data
        if (form.attachment && form.attachment instanceof File) {
          const fd = new FormData();
          fd.append('title', form.title);
          fd.append('description', form.description);
          fd.append('category', form.category);
          fd.append('priority', form.priority);
            fd.append('status', form.status);
          fd.append('user_id', form.user_id);
          if (form.assigned_to !== '' && form.assigned_to !== null) fd.append('assigned_to', String(Number(form.assigned_to)));
          fd.append('due_date', form.due_date);
          fd.append('attachment', form.attachment);
          await createTicket(fd);
        } else {
          const payload = { ...form };
          if (payload.assigned_to !== '' && payload.assigned_to !== null) payload.assigned_to = Number(payload.assigned_to);
          await createTicket(payload);
        }
        showNotification('Ticket created successfully!', 'success');
      }
      onClose();
      load();
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to save';
      setError(msg);
      showNotification(msg, 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Filtered, sorted, and paginated data
  const filtered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });
    const q = search.toLowerCase();
    return sorted.filter(r => (
      (r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.priority?.toLowerCase().includes(q))
      ) && (filter === 'all' || Number(r.assigned_to) === Number(user?.id))
    );
  }, [rows, search, filter, user]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, rows, filter]);

  const displayedStatuses = useMemo(() => {
    const list = Array.isArray(statuses) ? [...statuses] : [];
    if (form.status && !list.includes(form.status)) {
      // show current ticket status first so select can display it even if it's missing from server list
      list.unshift(form.status);
    }
    return list;
  }, [statuses, form.status]);

  return (
    <div className="min-h-screen px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-gray-900">Tickets</h1>
          <p className="text-lg text-gray-600">Create, update and manage tickets</p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-start gap-3">
            <button
              onClick={() => setFilter('mine')}
              className={`px-4 py-2 rounded-lg border transition ${filter === 'mine' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'}`}
            >
              My Tickets
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg border transition ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'}`}
            >
              All Tickets
            </button>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search tickets..." className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add Ticket
          </button>
        </div>

        

        <div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">S.NO</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No tickets found</td></tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.priority}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
                            title="Edit Ticket"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Delete button can be added here */}
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
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="px-6 py-4 bg-blue-600">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit Ticket' : 'Add Ticket'}</h3>
                    <button className="text-white hover:text-gray-200" onClick={onClose}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="px-6 py-5 bg-white">
                  {error && <div className="mb-4 p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div>}
                  <form className="space-y-5" onSubmit={submit}>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">Title *</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e=>setForm({ ...form, title: e.target.value })}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ticket title"
                        required
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">Description *</label>
                      <textarea
                        value={form.description}
                        onChange={e=>setForm({ ...form, description: e.target.value })}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ticket description"
                        required
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Category</label>
                        <select
                          value={form.category}
                          onChange={e=>setForm({ ...form, category: e.target.value })}
                          className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select category</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Priority</label>
                        <select
                          value={form.priority}
                          onChange={e=>setForm({ ...form, priority: e.target.value })}
                          className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select priority</option>
                          {priorities.map(pri => (
                            <option key={pri} value={pri}>{pri}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Assign To</label>
                        <select
                          value={form.assigned_to}
                          onChange={e => {
                            const newAssigned = e.target.value;
                            // If status is Open and assigning, set status to Assigned
                            if (form.status === 'Open' && newAssigned) {
                              setForm({ ...form, assigned_to: newAssigned, status: 'Assigned' });
                            } else if (!newAssigned && form.status === 'Assigned') {
                              // If unassigning, revert status to Open
                              setForm({ ...form, assigned_to: '', status: 'Open' });
                            } else {
                              setForm({ ...form, assigned_to: newAssigned });
                            }
                          }}
                          className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={editingId && form.status === 'Open' && !form.assigned_to && String(form.user_id) !== String(user?.id)}
                        >
                          {users.length === 0 ? (
                            <option value="" disabled>No users available</option>
                          ) : (
                            <>
                              <option value="">Select user</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>{`${u.firstname || u.name || u.full_name || u.email}${u.lastname ? ' ' + u.lastname : ''}`}</option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm({ ...form, status: e.target.value })}
                          className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select status</option>
                          {displayedStatuses.map(s => {
                            const isEditing = Boolean(editingId);
                            const isAssignee = String(form.assigned_to) === String(user?.id);
                            const isCreator = String(form.user_id) === String(user?.id);
                            let disabled = false;
                            let title = '';
                            if (isEditing) {
                              if (isCreator && !isAssignee) {
                                // Creator who is not the assignee: only Closed is allowed
                                if (s !== 'Closed') {
                                  disabled = true;
                                  title = 'Only the ticket creator can set status to Closed';
                                }
                              } else if (isAssignee) {
                                // Assignee: allow common workflow statuses
                                const assigneeAllowed = ['Open', 'Assigned', 'In Progress', 'Rejected', 'Resolved'];
                                if (!assigneeAllowed.includes(s)) {
                                  disabled = true;
                                  title = 'Only the assigned user can set this status';
                                }
                              } else {
                                // Neither creator nor assignee: cannot change status
                                disabled = true;
                                title = 'You are not permitted to change status';
                              }
                            }
                            return (
                              <option key={s} value={s} disabled={disabled} title={disabled ? title : undefined}>{s}</option>
                            );
                          })}
                        </select>
                        <div className="text-xs text-gray-500 mt-1">Only the assigned user can set status to Open, Assigned, In Progress, Rejected or Resolved. Only the ticket creator can set status to Closed.</div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Due Date *</label>
                        <input
                          type="date"
                          value={form.due_date}
                          onChange={e=>setForm({ ...form, due_date: e.target.value })}
                          className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Attachment</label>
                        <input
                          type="file"
                          onChange={e => {
                            const file = e.target.files[0];
                            setForm({ ...form, attachment: file });
                          }}
                          className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                      <button type="button" onClick={onClose} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
                      <button type="submit" className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">{editingId ? 'Update Ticket' : 'Create Ticket'}</button>
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
