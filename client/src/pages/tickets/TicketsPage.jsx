import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteTicket } from '../../api/ticketApi';
import { API_URL } from '../../api/axios';
import Notification from '../../components/common/Notification';
import { getAllTickets, updateTicket, createTicket, getTicketPriorities, getTicketStatuses } from '../../api/ticketApi';
import { getUsers, getAssignableUsers } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';

const initialForm = {
  title: '',
  description: '',
  priority: 'Medium',
  status: 'Open',
  user_id: '',
  assigned_to: '',
  assigned_to_ids: [],
  due_date: '',
  attachment: '',
};

export default function TicketsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [priorities, setPriorities] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState('all');
  // UI-only filter controls (inline, no backend changes)
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isManagementUser = String(user?.role || '').toLowerCase() === 'management';

  // Initialize state from URL (bookmarkable)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const a = params.get('assignee') || '';
    const p = params.get('priority') || '';
    const s = params.get('status') || '';
    const q = params.get('q') || '';
    const o = params.get('overdue') === '1';
    const f = params.get('filter') || 'all';
    const sb = params.get('sortBy') || 'created_at';
    const sd = params.get('sortDir') || 'desc';
    setAssigneeFilter(a);
    setPriorityFilter(p);
    setStatusFilter(s);
    setSearch(q);
    setOverdueOnly(o);
    setFilter(f);
    setSortBy(sb);
    setSortDir(sd);
  }, []); // run once on mount

  // Persist important UI state to URL when changed
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (assigneeFilter) params.set('assignee', assigneeFilter); else params.delete('assignee');
    if (priorityFilter) params.set('priority', priorityFilter); else params.delete('priority');
    if (statusFilter) params.set('status', statusFilter); else params.delete('status');
    if (search) params.set('q', search); else params.delete('q');
    if (overdueOnly) params.set('overdue', '1'); else params.delete('overdue');
    if (filter) params.set('filter', filter); else params.delete('filter');
    if (sortBy) params.set('sortBy', sortBy); else params.delete('sortBy');
    if (sortDir) params.set('sortDir', sortDir); else params.delete('sortDir');
    const newSearch = params.toString();
    if (newSearch !== location.search.replace(/^[?]/, '')) {
      const path = params.toString() ? `${location.pathname}?${params.toString()}` : location.pathname;
      navigate(path, { replace: true });
    }
  }, [assigneeFilter, priorityFilter, statusFilter, search, overdueOnly, filter, sortBy, sortDir]);

  // Delete ticket handler with confirmation modal
  const handleDelete = (id) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTicket(deleteId);
      setNotification({ show: true, message: 'Ticket deleted successfully!', type: 'success' });
      setRows(rows => rows.filter(r => r.id !== deleteId));
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to delete ticket';
      setNotification({ show: true, message: msg, type: 'error' });
    }
    setIsDeleteModalOpen(false);
    setDeleteId(null);
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setDeleteId(null);
  };

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

      // Fetch priorities/statuses separately so we can capture errors per-call
      let prioritiesRes = null;
      let statusesRes = null;
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

      const fetchedTickets = ticketsRes.data?.data || [];
      const uniqueTickets = Array.from(new Map(fetchedTickets.map(t => [t.id, t])).values());
      setRows(uniqueTickets);
      setUsers(usersRes.data?.data || []);
      // Use server-provided lists when available, otherwise fall back to defaults
      const serverPriorities = prioritiesRes?.data?.data;
      const defaultPriorities = ['Low', 'Medium', 'High'];
      setPriorities((serverPriorities && serverPriorities.length) ? serverPriorities : defaultPriorities);
      const serverStatuses = statusesRes?.data?.data;
      const defaultStatuses = [
        'Open',
        // 'Assigned',
        // 'Pending',
        // 'In Progress',
        // 'Resolved',
        // 'Rejected',
        'Closed',
        'Overdue',
      ];
      setStatuses((serverStatuses && serverStatuses.length) ? serverStatuses : defaultStatuses);
    } catch {
      setRows([]);
      setUsers([]);
      setPriorities(['Low', 'Medium', 'High']);
      setStatuses([
        'Open',
        'Pending',
        // 'Resolved',
      ]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target)) {
        setAssigneeDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAssigneeDropdownOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const onClose = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(initialForm);
    setError('');
    setAssigneeDropdownOpen(false);
  };

  const normalizeAssignedIds = (ticket) => {
    if (!ticket) return [];

    const list = [];
    const rawAssignedToIds = Array.isArray(ticket.assigned_to_ids) ? ticket.assigned_to_ids : [];

    if (ticket.assigned_to !== undefined && ticket.assigned_to !== null) {
      if (typeof ticket.assigned_to === 'object') {
        list.push(ticket.assigned_to.id ?? ticket.assigned_to.user_id ?? '');
      } else {
        list.push(ticket.assigned_to);
      }
    }

    list.push(...rawAssignedToIds);

    return [...new Set(list.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
  };

  const getAssignedId = (r) => {
    const ids = normalizeAssignedIds(r);
    return ids.length ? String(ids[0]) : '';
  };

  const getAssignedIds = (r) => normalizeAssignedIds(r).map((value) => String(value));

  const getDisplayAttachmentPath = (attachmentPath) => {
    if (!attachmentPath) return '';
    try {
      return decodeURIComponent(attachmentPath);
    } catch {
      return attachmentPath;
    }
  };

  const getAttachmentHref = (attachmentPath) => {
    if (!attachmentPath) return '';
    if (/^https?:\/\//i.test(attachmentPath)) return attachmentPath;
    if (!attachmentPath.startsWith('/')) return attachmentPath;

    try {
      const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
      const apiBase = API_URL.startsWith('http') ? API_URL : `${window.location.origin}${API_URL}`;

      if (attachmentPath.startsWith('/uploads/')) {
        return `${apiBase}${attachmentPath}`;
      }

      if (attachmentPath.startsWith('/api/')) {
        return `${appOrigin}${attachmentPath}`;
      }

      return `${appOrigin}${attachmentPath}`;
    } catch {
      return attachmentPath;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--NA--';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '--NA--';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getClosedDateDisplay = (row) => {
    if (String(row?.status || '').toLowerCase() !== 'closed' || !row?.updated_at) {
      return '--NA--';
    }

    const closedAt = new Date(row.updated_at);
    if (Number.isNaN(closedAt.getTime())) {
      return '--NA--';
    }

    return formatDate(row.updated_at);
  };

  const openCreate = () => {
    onClose();
    setForm({ ...initialForm, user_id: user?.id ?? '', assigned_to_ids: [] });
    setAssigneeDropdownOpen(false);
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    // If ticket is Open and unassigned (after rejection), clear assigned_to
    let initialStatus = row.status || 'Open';
    const assignedIds = getAssignedIds(row);
    let assignedTo = assignedIds[0] || '';
    if (isManagementUser) {
      assignedTo = assignedIds[0] || '';
    } else {
      const currentUserId = String(user?.id);
      const currentUserAssigned = assignedIds.includes(currentUserId);
      assignedTo = currentUserAssigned ? currentUserId : (assignedIds[0] || '');
    }
    if (initialStatus === 'Open' && !assignedIds.length) {
      assignedTo = '';
    } else if (assignedIds.length && (initialStatus === '' || String(initialStatus) === 'Open')) {
      // initialStatus = 'Assigned';
    }
    setForm({
      title: row.title || '',
      description: row.description || '',
      priority: row.priority || 'Medium',
      status: initialStatus,
      user_id: row.user_id || '',
      assigned_to: assignedTo,
      assigned_to_ids: assignedIds,
      due_date: row.due_date ? row.due_date.slice(0, 10) : '',
      attachment: row.attachment || '',
    });
    setAssigneeDropdownOpen(false);
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
    const selectedAssigneeIds = (() => {
      const rawIds = isManagementUser
        ? form.assigned_to_ids
        : (editingId ? form.assigned_to_ids : [form.assigned_to]);

      return [...new Set((Array.isArray(rawIds) ? rawIds : [rawIds]).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
    })();

    if (!selectedAssigneeIds.length) {
      setError('Assign To is required');
      return;
    }
    try {
      const primaryAssigneeId = selectedAssigneeIds[0];
      if (editingId) {
        // If ticket is Open and creator assigns it, set status to Assigned
        const payload = { ...form, status: form.status };
        if (payload.status === 'Open' && primaryAssigneeId && String(form.user_id) === String(user?.id)) {
          // payload.status = 'Assigned';
        }
        payload.assigned_to = primaryAssigneeId;
        payload.assigned_to_ids = selectedAssigneeIds;
        if (form.attachment && form.attachment instanceof File) {
          const fd = new FormData();
          fd.append('title', payload.title);
          fd.append('description', payload.description);
          fd.append('priority', payload.priority);
          fd.append('status', payload.status);
          fd.append('user_id', String(payload.user_id));
          fd.append('assigned_to', String(payload.assigned_to));
          fd.append('assigned_to_ids', JSON.stringify(payload.assigned_to_ids));
          fd.append('due_date', payload.due_date);
          fd.append('attachment', form.attachment);
          await updateTicket(editingId, fd);
        } else {
          await updateTicket(editingId, payload);
        }
        showNotification('Ticket updated successfully!', 'success');
      } else {
        // Create: if attachment is a File, send multipart/form-data
        if (form.attachment && form.attachment instanceof File) {
          const fd = new FormData();
          fd.append('title', form.title);
          fd.append('description', form.description);
          fd.append('priority', form.priority);
          // New tickets must start in Open; Rejected is an update-only workflow status.
          fd.append('status', 'Open');
          fd.append('user_id', form.user_id);
          fd.append('assigned_to', String(primaryAssigneeId));
          fd.append('assigned_to_ids', JSON.stringify(selectedAssigneeIds));
          fd.append('due_date', form.due_date);
          fd.append('attachment', form.attachment);
          await createTicket(fd);
        } else {
          const payload = { ...form };
          payload.status = 'Open';
          payload.assigned_to = primaryAssigneeId;
          payload.assigned_to_ids = selectedAssigneeIds;
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
  const counts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const allCount = rows.length;
    const mineCount = rows.filter(r => getAssignedIds(r).includes(String(user?.id))).length;
    const overdueCount = rows.filter(r => {
      if (!r.due_date || r.status === 'Closed') return false;
      const d = new Date(r.due_date); d.setHours(0, 0, 0, 0);
      return d < today;
    }).length;
    return { allCount, mineCount, overdueCount };
  }, [rows, user]);

  const isOverdue = (r) => {
    if (!r?.due_date || r?.status === 'Closed') return false;
    const d = new Date(r.due_date); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d < today;
  };

  const renderPriorityChip = (p) => {
    const key = (p || '').toLowerCase();
    const map = {
      critical: 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]',
      high: 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]',
      medium: 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]',
      low: 'bg-[color:var(--success-soft)] text-[color:var(--success)]',
    };
    const cls = map[key] || 'bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)]';
    return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${cls}`}>{p}</span>;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    let result = rows.filter(r => {
      const matchesSearch =
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q) ||
        r.priority?.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      // legacy quick filter compatibility - only enforce 'mine' when no explicit inline filters
      // (assignee/priority/status/overdue/search). This lets selecting Priority or Status work
      // even if the URL has filter=mine from an older view.
      if (
        filter === 'mine' &&
        !assigneeFilter &&
        !priorityFilter &&
        !statusFilter &&
        !overdueOnly &&
        !search &&
        !getAssignedIds(r).includes(String(user?.id))
      ) return false;
      if (filter === 'overdue') {
        if (!r.due_date || r.status === 'Closed') return false;
        const dueDate = new Date(r.due_date); dueDate.setHours(0, 0, 0, 0);
        if (!(dueDate < today)) return false;
      }

      // new inline filters
      if (assigneeFilter && !getAssignedIds(r).includes(String(assigneeFilter))) return false;
      if (priorityFilter && String(r.priority) !== String(priorityFilter)) return false;
      if (statusFilter && String(r.status) !== String(statusFilter)) return false;
      if (overdueOnly) {
        if (!r.due_date || r.status === 'Closed') return false;
        const dueDate = new Date(r.due_date); dueDate.setHours(0, 0, 0, 0);
        if (!(dueDate < today)) return false;
      }

      return true;
    });

    // local sorting
    result.sort((a, b) => {
      const get = (obj, key) => {
        const val = obj?.[key];
        if (!val) return '';
        if (key.includes('date') || key.includes('created') || key.includes('due')) return new Date(val).getTime();
        return String(val).toLowerCase();
      };
      const va = get(a, sortBy);
      const vb = get(b, sortBy);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, search, filter, user, assigneeFilter, priorityFilter, statusFilter, overdueOnly, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, rows, filter]);

  const displayedStatuses = useMemo(() => {
    const list = Array.isArray(statuses) ? [...statuses] : [];
    // Keep core workflow statuses available even if API list is incomplete.
    [
      // 'Resolved',
      'Closed',
    ].forEach(required => {
      if (!list.includes(required)) list.push(required);
    });
    if (form.status && !list.includes(form.status)) {
      // show current ticket status first so select can display it even if it's missing from server list
      list.unshift(form.status);
    }
    const roleNorm = (user?.role || '').toLowerCase();
    if (roleNorm === 'management') {
      return list.filter(s => ['open', 'closed'].includes(String(s).toLowerCase()));
    }
    // If current user is not Management, hide 'Rejected' from the selectable statuses
    if (roleNorm !== 'management') {
      return list.filter(s => String(s).toLowerCase() !== 'rejected');
    }
    return list;
  }, [statuses, form.status]);

  const filterStatusOptions = useMemo(() => {
    const list = Array.isArray(statuses) ? statuses : [];
    return list.filter((statusValue) => String(statusValue).toLowerCase() !== 'rejected');
  }, [statuses]);

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-12 text-[color:var(--text-primary)] transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />

        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-extrabold text-[color:var(--text-primary)]">Tickets</h1>
          <p className="text-lg text-[color:var(--text-secondary)]">Create, update and manage tickets</p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setPanelOpen(p => !p)} className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)] shadow-sm hover:bg-[color:var(--surface-hover)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[color:var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 12v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7L3.293 6.707A1 1 0 013 6V4z" /></svg>
                <span className="text-sm font-semibold">Filters</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transform text-[color:var(--text-muted)] ${panelOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" /></svg>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  aria-pressed={filter === 'all'}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${filter === 'all' ? 'bg-[color:var(--accent)] text-white' : 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7" /></svg>
                  <span>All</span>
                  <span className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${filter === 'all' ? 'bg-[color:var(--surface)] text-[color:var(--accent)]' : 'bg-[color:var(--surface)] text-[color:var(--accent)]'}`}>{counts.allCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('mine')}
                  aria-pressed={filter === 'mine'}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${filter === 'mine' ? 'bg-[color:var(--success)] text-white' : 'bg-[color:var(--success-soft)] text-[color:var(--success)]'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11s1.343 3 3 3 3-1.343 3-3zM21 11v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6" /></svg>
                  <span>Mine</span>
                  <span className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${filter === 'mine' ? 'bg-[color:var(--surface)] text-[color:var(--success)]' : 'bg-[color:var(--surface)] text-[color:var(--success)]'}`}>{counts.mineCount}</span>
                </button>

                {/* <button
                  type="button"
                  onClick={() => setFilter('overdue')}
                  aria-pressed={filter === 'overdue'}
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium cursor-pointer ${filter === 'overdue' ? 'bg-[color:var(--danger)] text-white' : 'bg-red-50 text-red-700'}`}
                > */}
                {/* <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12.9 2.3c-.4-.7-1.4-.7-1.8 0L2.6 18.4c-.4.7.1 1.6.9 1.6h18.9c.8 0 1.3-.9.9-1.6L12.9 2.3z" fill="currentColor" className="opacity-90" />
                    <rect x="11" y="8" width="2" height="6" rx="1" fill="white" />
                    <rect x="11" y="16" width="2" height="2" rx="1" fill="white" />
                  </svg> */}
                {/* <span>Overdue</span> */}
                {/* <span className={`ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-[color:var(--surface)] ${filter === 'overdue' ? 'text-red-600' : 'text-red-700'} ${counts.overdueCount>0 ? 'animate-pulse' : ''}`}>{counts.overdueCount}</span> */}
                {/* </button> */}
              </div>
            </div>

          </div>
          {/* Bulk actions removed (selection checkboxes and toolbar) */}

          {panelOpen && (
            <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-[color:var(--text-secondary)]">Assignee</label>
                  <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)]">
                    <option value="">Any</option>
                    {users.map(u => <option key={u.id} value={u.id}>{`${u.firstname || u.name || u.full_name || u.email}${u.lastname ? ' ' + u.lastname : ''}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[color:var(--text-secondary)]">Priority</label>
                  <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)]">
                    <option value="">Any</option>
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[color:var(--text-secondary)]">Status</label>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--text-primary)]">
                    <option value="">Any</option>
                    {filterStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[color:var(--text-secondary)]">Options</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center rounded-full bg-[color:var(--danger)] px-2 py-1 text-xs text-white">
                      <input type="checkbox" className="mr-2" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
                      <span>Only overdue</span>
                    </label>
                    <button onClick={() => { setAssigneeFilter(''); setPriorityFilter(''); setStatusFilter(''); setOverdueOnly(false); setSearch(''); setFilter('all'); }} className="rounded bg-[color:var(--surface-hover)] px-4 py-2 font-semibold text-[color:var(--text-primary)] transition hover:opacity-90">Clear</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-10 pr-4 text-[color:var(--text-primary)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--focus-ring)]" />
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-[color:var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-end w-full sm:w-auto">
            {(isManagementUser || String(user?.role || '').toLowerCase() === 'hod' || String(user?.role || '').toLowerCase() === 'admin') && (
              <button type="button" onClick={() => navigate('/tickets/reports')} className="inline-flex items-center justify-center w-full rounded-lg bg-[color:var(--accent)] px-4 py-3 font-medium text-white shadow-md transition-all duration-300 hover:scale-105 hover:opacity-90 sm:w-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6-6h2a2 2 0 012 2v7m-9 2h6a2 2 0 002-2v-7m-6 0h8" /></svg>
                Ticket Reports
              </button>
            )}
            <button onClick={openCreate} className="flex items-center justify-center w-full rounded-lg bg-[color:var(--accent)] px-6 py-3 font-medium text-white shadow-sm transition-all duration-300 hover:scale-105 hover:opacity-90 sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Add Ticket
            </button>
          </div>
        </div>



        <div className="mb-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border)]">
              <thead className="bg-[color:var(--accent)]">
                <tr>
                  <th onClick={() => { setSortBy('id'); setSortDir(sortBy === 'id' ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'); }} className="cursor-pointer px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">S.NO {sortBy === 'id' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setSortBy('title'); setSortDir(sortBy === 'title' ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'); }} className="cursor-pointer px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Title {sortBy === 'title' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setSortBy('status'); setSortDir(sortBy === 'status' ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'); }} className="cursor-pointer px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Status {sortBy === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setSortBy('priority'); setSortDir(sortBy === 'priority' ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'); }} className="cursor-pointer px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Priority {sortBy === 'priority' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Attachment</th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Closed Date</th>
                  <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                {filtered.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-[color:var(--text-muted)]">No tickets found</td></tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr key={row.id} className={`${isOverdue(row) ? 'border-l-4 border-[color:var(--danger)] bg-[color:var(--danger-soft)]' : ''} ${idx % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-hover)]'} transition-colors duration-150 hover:bg-[color:var(--surface-hover)]`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--text-primary)]">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--text-primary)]">{row.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {String(row.status || '').toLowerCase() === 'rejected' ? (
                          <span className="inline-flex items-center rounded bg-[color:var(--danger-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--danger)]">{row.status}</span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--accent)]">{row.status}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[color:var(--text-secondary)]">{renderPriorityChip(row.priority)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {row.attachment ? (
                          <a
                            href={getAttachmentHref(row.attachment)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center p-2 text-[color:var(--accent)] hover:opacity-80"
                            title="View Attachment"
                            aria-label="View Attachment"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">--NA--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-[color:var(--text-secondary)]">
                        {getClosedDateDisplay(row)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => {
                              if (String(row.status || '').toLowerCase() === 'closed') return;
                              openEdit(row);
                            }}
                            disabled={String(row.status || '').toLowerCase() === 'closed'}
                            className={`rounded-lg p-2 text-white transition-colors duration-200 ${String(row.status || '').toLowerCase() === 'closed'
                              ? 'cursor-not-allowed bg-[color:var(--accent)] opacity-40'
                              : 'bg-[color:var(--accent)] hover:opacity-90'
                              }`}
                            title={String(row.status || '').toLowerCase() === 'closed' ? 'Closed tickets cannot be edited' : 'Edit Ticket'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {user && row.user_id === user.id && (
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="rounded-lg bg-[color:var(--danger)] p-2 text-white transition-colors duration-200 hover:opacity-90"
                              title="Delete Ticket"
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
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-primary)] disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="text-sm text-[color:var(--text-secondary)]">
                Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
              </span>
              <button
                className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--text-primary)] disabled:opacity-50"
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
              <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={onClose} />
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-[color:var(--surface)] rounded-lg border border-[color:var(--border)] shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="px-6 py-4 bg-[color:var(--accent)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit Ticket' : 'Add Ticket'}</h3>
                    <button className="text-white hover:text-[color:var(--text-primary)]" onClick={onClose}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="px-6 py-5 bg-[color:var(--surface)]">
                  {error && <div className="mb-4 p-3 rounded border border-[color:var(--danger-soft)] text-[color:var(--danger)] bg-[color:var(--danger-soft)] text-sm">{error}</div>}
                  <form className="space-y-5" onSubmit={submit}>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-[color:var(--text-primary)]">Title *</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        className="block w-full bg-[color:var(--surface)] px-4 py-3 border border-[color:var(--border)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] text-[color:var(--text-primary)]"
                        placeholder="Ticket title"
                        required
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-[color:var(--text-primary)]">Description *</label>
                      <textarea
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className="block w-full bg-[color:var(--surface)] px-4 py-3 border border-[color:var(--border)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] text-[color:var(--text-primary)]"
                        placeholder="Ticket description"
                        required
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-[color:var(--text-primary)]">Priority</label>
                        <select
                          value={form.priority}
                          onChange={e => setForm({ ...form, priority: e.target.value })}
                          className="block w-full bg-[color:var(--surface)] px-4 py-3 border border-[color:var(--border)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] text-[color:var(--text-primary)]"
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
                        <label className="block mb-2 text-sm font-medium text-[color:var(--text-primary)]">Assign To *</label>
                        {isManagementUser ? (
                          <div ref={assigneeDropdownRef} className="relative">
                            <button
                              type="button"
                              onClick={() => setAssigneeDropdownOpen((open) => !open)}
                              className={`block w-full bg-[color:var(--surface)] px-4 py-3 text-left border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] ${editingId && !form.assigned_to_ids.length ? 'border-[color:var(--danger)] bg-[color:var(--danger-soft)]' : 'border-[color:var(--border)]'}`}
                              disabled={editingId && form.status === 'Open' && !form.assigned_to_ids.length && String(form.user_id) !== String(user?.id)}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className={form.assigned_to_ids.length ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'}>
                                  {form.assigned_to_ids.length
                                    ? `${form.assigned_to_ids.length} user${form.assigned_to_ids.length > 1 ? 's' : ''} selected`
                                    : 'Select users'}
                                </span>
                                <svg className={`w-4 h-4 text-[color:var(--text-muted)] transition-transform ${assigneeDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {assigneeDropdownOpen && (
                              <div className="absolute z-20 w-full mt-2 bg-[color:var(--surface)]  border border-[color:var(--border)] rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                {users.length === 0 ? (
                                  <div className="px-4 py-3 text-sm text-[color:var(--text-muted)]">No users available</div>
                                ) : (
                                  users
                                    .slice()
                                    .sort((a, b) => String((a.firstname || a.name || a.full_name || '')).localeCompare(String((b.firstname || b.name || b.full_name || ''))))
                                    .map(u => {
                                      const checked = form.assigned_to_ids.includes(String(u.id));
                                      return (
                                        <label
                                          key={u.id}
                                          className="flex items-center gap-3 px-4 py-3 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {
                                              setForm((prev) => {
                                                const currentIds = Array.isArray(prev.assigned_to_ids) ? prev.assigned_to_ids : [];
                                                const userId = String(u.id);
                                                const nextIds = checked
                                                  ? currentIds.filter((id) => String(id) !== userId)
                                                  : [...currentIds, userId];
                                                return {
                                                  ...prev,
                                                  assigned_to_ids: nextIds,
                                                  assigned_to: nextIds[0] || '',
                                                };
                                              });
                                            }}
                                            className="w-4 h-4 text-[color:var(--accent)] border-[color:var(--border)] rounded focus:ring-[color:var(--ring)]"
                                          />
                                          <span>{`${u.firstname || u.name || u.full_name || u.email}${u.lastname ? ' ' + u.lastname : ''}`}</span>
                                        </label>
                                      );
                                    })
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <select
                            value={form.assigned_to}
                            onChange={e => {
                              const newAssigned = e.target.value;
                              // If status is Open and assigning, keep status Open
                              if (form.status === 'Open' && newAssigned) {
                                setForm({ ...form, assigned_to: newAssigned, assigned_to_ids: [newAssigned], status: 'Open' });
                              } else if (!newAssigned && form.status === 'Open') {
                                // If unassigning, keep status Open
                                setForm({ ...form, assigned_to: '', assigned_to_ids: [], status: 'Open' });
                              } else {
                                setForm({ ...form, assigned_to: newAssigned, assigned_to_ids: newAssigned ? [newAssigned] : [] });
                              }
                            }}
                            className={`block w-full bg-[color:var(--surface)] px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] ${editingId && !form.assigned_to ? 'border-[color:var(--danger)] bg-[color:var(--danger-soft)]' : 'border-[color:var(--border)]'} text-[color:var(--text-primary)]`}
                            disabled={editingId && form.status === 'Open' && !form.assigned_to && String(form.user_id) !== String(user?.id)}
                          >
                            {users.length === 0 ? (
                              <option value="" disabled>No users available</option>
                            ) : (
                              <>
                                <option value="">Select user</option>
                                {users
                                  .slice()
                                  .sort((a, b) => String((a.firstname || a.name || a.full_name || '')).localeCompare(String((b.firstname || b.name || b.full_name || ''))))
                                  .map(u => (
                                    <option key={u.id} value={u.id}>{`${u.firstname || u.name || u.full_name || u.email}${u.lastname ? ' ' + u.lastname : ''}`}</option>
                                  ))}
                              </>
                            )}
                          </select>
                        )}

                      </div>
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-[color:var(--text-primary)]">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm({ ...form, status: e.target.value })}
                          className="block w-full bg-[color:var(--surface)] px-4 py-3 border border-[color:var(--border)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] text-[color:var(--text-primary)]"
                        >
                          <option value="">Select status</option>
                          {displayedStatuses.map(s => {
                            const isEditing = Boolean(editingId);
                            const isAssignee = normalizeAssignedIds(form).includes(Number(user?.id));
                            const isCreator = String(form.user_id) === String(user?.id);
                            let disabled = false;
                            let title = '';
                            if (isEditing) {
                              // Management can always reject tickets from edit mode.
                              if (isManagementUser && s === 'Rejected') {
                                disabled = false;
                                title = '';
                              } else if (s === 'Closed') {
                                // Closed is creator-controlled regardless of assignee role.
                                if (!isCreator) {
                                  disabled = true;
                                  title = 'Only the ticket creator can set status to Closed';
                                }
                              } else if (isCreator && !isAssignee) {
                                // Creator who is not the assignee: only Closed is allowed
                                if (s !== 'Closed') {
                                  disabled = true;
                                  title = 'Only the ticket creator can set status to Closed';
                                }
                              } else if (isAssignee) {
                                // Assignee: allow common workflow statuses
                                const assigneeAllowed = [
                                  'Open',
                                  // 'Assigned',
                                  // 'In Progress',
                                  'Rejected',
                                  // 'Resolved',
                                ];
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
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-[color:var(--text-primary)]">Due Date *</label>
                        <input
                          type="date"
                          value={form.due_date}
                          onChange={e => setForm({ ...form, due_date: e.target.value })}
                          className="block w-full bg-[color:var(--surface)] px-4 py-3 border border-[color:var(--border)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] text-[color:var(--text-primary)]"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block mb-2 text-sm font-medium text-[color:var(--text-primary)]">Attachment</label>
                        {editingId && typeof form.attachment === 'string' && form.attachment && (
                          <div className="mb-2">
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                readOnly
                                value={getDisplayAttachmentPath(form.attachment)}
                                className="block w-full px-3 py-2 text-sm  border border-[color:var(--border)] rounded-lg bg-[color:var(--surface-hover)] text-[color:var(--text-primary)]"
                              />
                              <a
                                href={getAttachmentHref(form.attachment)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[color:var(--accent)] hover:opacity-80 whitespace-nowrap"
                              >
                                Open
                              </a>
                            </div>
                            <div className="text-xs text-[color:var(--text-muted)] mt-1">If you do not choose a new file, this attachment will be kept on update.</div>
                          </div>
                        )}
                        {typeof form.attachment === 'object' && form.attachment?.name && (
                          <div className="mb-2 text-sm text-[color:var(--text-secondary)]">
                            New file selected: {form.attachment.name}
                          </div>
                        )}
                        <input
                          type="file"
                          onChange={e => {
                            const file = e.target.files[0];
                            setForm({ ...form, attachment: file || '' });
                          }}
                          className="block w-full bg-[color:var(--surface)] px-4 py-3 border border-[color:var(--border)] rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--ring)] text-[color:var(--text-primary)]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                      <button type="button" onClick={onClose} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-[color:var(--text-primary)] bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg shadow-sm hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--ring)]">Cancel</button>
                      {(() => {
                        const isEditing = Boolean(editingId);
                        const isAssignee = normalizeAssignedIds(form).includes(Number(user?.id));
                        const isCreator = String(form.user_id) === String(user?.id);
                        const disableUpdateBtn = isEditing && isAssignee && !isCreator && !isManagementUser;

                        return (
                          <button
                            type="submit"
                            disabled={disableUpdateBtn}
                            title={disableUpdateBtn ? "Assignees are not allowed to update the ticket directly" : undefined}
                            className={`inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--ring)] ${disableUpdateBtn
                              ? 'bg-[color:var(--surface-hover)] opacity-50 cursor-not-allowed'
                              : 'bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)]'
                              }`}
                          >
                            {editingId ? 'Update Ticket' : 'Create Ticket'}
                          </button>
                        );
                      })()}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={cancelDelete} />
              <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-[color:var(--surface)] rounded-lg border border-[color:var(--border)] shadow-xl sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
                <div className="px-6 py-4 bg-[color:var(--danger)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-white">Delete Ticket</h3>
                    <button className="text-white hover:text-[color:var(--text-primary)]" onClick={cancelDelete}>
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="px-6 py-5 bg-[color:var(--surface)]">
                  <p className="mb-6 text-[color:var(--text-primary)] text-base">Are you sure you want to delete this ticket?</p>
                  <div className="flex justify-end space-x-4">
                    <button onClick={cancelDelete} className="inline-flex justify-center px-6 py-2 text-sm font-medium text-[color:var(--text-primary)] bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg shadow-sm hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--danger)]">Cancel</button>
                    <button onClick={confirmDelete} className="inline-flex justify-center px-6 py-2 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-[color:var(--danger)] hover:bg-[color:var(--danger-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--danger)]">Delete</button>
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
