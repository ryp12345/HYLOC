import React, { useState, useEffect, useRef } from 'react';
import { getTicketCounts, createTicket, getAllTickets, updateTicket } from '../../api/devTicketsApi';
import { useAuth } from '../../context/AuthContext';

const statusOptions = ['Open', 'Pending', 'Resolved'];
const priorityOptions = ['High', 'Medium', 'Low'];

const RaiseTicket = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    attachment: null
  });

  // Dynamic ticket counts
  const [ticketCounts, setTicketCounts] = useState({
    new: 0,
    pending: 0,
    resolved: 0,
    total: 0
  });

  const { user } = useAuth() || {};
  const [showTickets, setShowTickets] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(false);
  const descRefs = useRef({});
  const [isDescOverflow, setIsDescOverflow] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);
  const [descModalTicketId, setDescModalTicketId] = useState(null);
  const [descCanEdit, setDescCanEdit] = useState(false);

  useEffect(() => {
    fetchTicketCounts();
  }, []);

  const fetchTicketCounts = async () => {
    try {
      const res = await getTicketCounts();
      setTicketCounts(res.data);
    } catch (err) {
      setTicketCounts({ new: 0, pending: 0, resolved: 0, total: 0 });
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await getAllTickets();
      setTickets(res.data || []);
    } catch {
      setTickets([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (showTickets) {
      loadTickets();
    }
  }, [showTickets]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const startEdit = (ticket) => {
    setEditingId(ticket.id);
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setShowDescModal(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!editingId) {
      setIsDescOverflow(false);
      return;
    }

    const el = descRefs.current[editingId];

    const checkOverflow = () => {
      const node = descRefs.current[editingId];
      if (!node) {
        setIsDescOverflow(false);
        return;
      }
      const overflow = (node.scrollWidth > node.clientWidth) || (node.scrollHeight > node.clientHeight);
      setIsDescOverflow(overflow);
    };

    // run check after paint for reliable measurements
    let raf1 = 0, raf2 = 0, timeoutId = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(checkOverflow);
    });
    // fallback
    timeoutId = setTimeout(checkOverflow, 50);

    // observe size changes if available
    let ro;
    if (typeof window !== 'undefined' && window.ResizeObserver) {
      ro = new ResizeObserver(checkOverflow);
      if (el) ro.observe(el);
    }

    window.addEventListener('resize', checkOverflow);

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(timeoutId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [editingId, editForm.description]);

  const saveEdit = async (id) => {
    try {
      await updateTicket(id, editForm);
      setEditingId(null);
      setEditForm({});
      loadTickets();
      alert('Ticket updated successfully!');
    } catch (err) {
      alert('Failed to update ticket: ' + (err.response?.data?.error || err.message));
    }
  };

  const closeDescModal = () => {
    if (descModalTicketId) {
      const original = tickets.find(t => t.id === descModalTicketId)?.description;
      setEditForm(prev => ({ ...prev, description: original ?? prev.description }));
      setDescModalTicketId(null);
    }
    setShowDescModal(false);
  };

  const saveDescFromModal = async () => {
    if (!descModalTicketId) return;
    try {
      setLoading(true);
      await updateTicket(descModalTicketId, { description: editForm.description });
      setShowDescModal(false);
      setDescModalTicketId(null);
      loadTickets();
      alert('Description updated successfully!');
    } catch (err) {
      alert('Failed to update description: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const canEditAll = (ticket) => user && ticket.created_by === user.id;
  const isDeveloper = user && user.role && user.role.toLowerCase() === 'developer';

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createTicket({
        title: form.title,
        description: form.description,
        priority: form.priority,
        attachment_url: null
      });
      console.log('Ticket created successfully:', response.data);
      // Refresh ticket counts
      fetchTicketCounts();
      // Reset form
      setForm({
        title: '',
        description: '',
        priority: 'Medium',
        attachment: null
      });
      closeModal();
      alert('Ticket created successfully!');
    } catch (err) {
      console.error('Failed to create ticket - Full error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      alert('Failed to create ticket: ' + (err.response?.data?.error || err.message || 'Please try again.'));
    }
  };

  // Card component with LeavesPage colors
  const TicketCard = ({ title, count, colorClass }) => (
    <div className={`ticket-card ${colorClass} rounded-lg shadow-lg p-6 text-white flex-1`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium opacity-90 mb-2">{title}</h3>
          <p className="text-3xl font-bold mt-2">{count}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold mb-6">Raise Ticket</h2>
        {/* Cards for Ticket New, Ticket Pending, Ticket Resolved, Total Ticket */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <TicketCard title="Ticket New" count={ticketCounts.new} colorClass="bg-gradient-to-r from-blue-500 to-blue-600" />
          <TicketCard title="Ticket Pending" count={ticketCounts.pending} colorClass="bg-gradient-to-r from-green-500 to-green-600" />
          <TicketCard title="Ticket Resolved" count={ticketCounts.resolved} colorClass="bg-gradient-to-r from-yellow-500 to-yellow-600" />
          <TicketCard title="Total Tickets" count={ticketCounts.total} colorClass="bg-gradient-to-r from-red-500 to-red-600" />
        </div>
        <div className="flex gap-4 mb-8">
          <button
            onClick={openModal}
            className={`px-4 py-2 rounded-lg transition font-semibold ${!showTickets ? 'bg-blue-700 text-white' : 'bg-blue-400 text-white'} hover:bg-blue-700`}
          >
            Raise New Ticket
          </button>
          <button
            onClick={() => setShowTickets(true)}
            className={`px-4 py-2 rounded-lg transition font-semibold ${showTickets ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'} hover:bg-blue-600`}
          >
            View All Tickets
          </button>
        </div>
      </div>

      {showTickets && (
        <div className="max-w-5xl mx-auto py-8">
          <h2 className="text-2xl font-bold mb-6">All Tickets</h2>
          {loading ? <div>Loading...</div> : (
            <div className="overflow-x-auto rounded-lg shadow border bg-white">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-48">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tickets.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-8 text-gray-500">No tickets found</td></tr>
                  ) : tickets.map(ticket => {
                    return (
                      <tr key={ticket.id} className={editingId === ticket.id ? 'bg-blue-50' : 'hover:bg-gray-50 transition'}>
                        <td className="border px-4 py-2 align-top">{ticket.id}</td>
                        <td className="border px-4 py-2 align-top">
                          {editingId === ticket.id ? (
                            (isDeveloper && !canEditAll(ticket)) ? (
                              ticket.title
                            ) : (
                              <input name="title" value={editForm.title} onChange={handleEditChange} className="border rounded px-2 py-1 w-32 focus:ring-2 focus:ring-blue-500" />
                            )
                          ) : ticket.title}
                        </td>
                        <td className="border px-4 py-2 align-top">
                          {editingId === ticket.id ? (
                            (isDeveloper && !canEditAll(ticket)) ? (
                              ticket.description
                            ) : (
                              <div className="flex items-center">
                                <div ref={el => { if (el) descRefs.current[ticket.id] = el; else delete descRefs.current[ticket.id]; }} className="border rounded px-2 py-1 w-32 truncate whitespace-nowrap overflow-hidden text-sm text-gray-700">
                                  {editForm.description}
                                </div>
                                {(isDescOverflow || (editForm.description && editForm.description.length > 32)) && (
                                  <button type="button" onClick={() => { setDescModalTicketId(ticket.id); setDescCanEdit(canEditAll(ticket)); setShowDescModal(true); }} className="ml-2 text-sm text-blue-600 underline">more...</button>
                                )}
                              </div>
                            )
                          ) : ticket.description}
                        </td>
                        <td className="border px-4 py-2 align-top">
                          {editingId === ticket.id ? (
                            (isDeveloper && !canEditAll(ticket)) ? (
                              ticket.priority
                            ) : (
                              <select name="priority" value={editForm.priority} onChange={handleEditChange} className="border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500">
                                {priorityOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            )
                          ) : ticket.priority}
                        </td>
                        <td className="border px-4 py-2 align-top">
                          {editingId === ticket.id ? (
                            <select name="status" value={editForm.status} onChange={handleEditChange} className="border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500">
                              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : ticket.status}
                        </td>
                        <td className="border px-4 py-2 align-top text-center">
                          {editingId === ticket.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => saveEdit(ticket.id)} className="p-2 text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700" title="Save">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button onClick={cancelEdit} className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700" title="Cancel">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { if (canEditAll(ticket) || isDeveloper) startEdit(ticket); }}
                              className={`p-2 transition-colors duration-200 rounded-lg ${canEditAll(ticket) || isDeveloper ? 'text-white bg-blue-600 hover:bg-blue-700' : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}
                              title={canEditAll(ticket) || isDeveloper ? 'Edit Ticket' : 'Edit (disabled)'}
                              aria-disabled={!(canEditAll(ticket) || isDeveloper)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeModal} />
            <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-md w-full relative">
              <div className="px-6 py-4 bg-blue-600 flex items-center justify-between">
                <h3 className="text-lg font-medium leading-6 text-white">Raise a New Ticket</h3>
                <button onClick={closeModal} className="text-white hover:text-gray-200 text-2xl font-bold">&times;</button>
              </div>
              <div className="px-6 py-5 bg-white">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Title</label>
                    <input
                      type="text"
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                      required
                      className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      required
                      className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      name="priority"
                      value={form.priority}
                      onChange={handleChange}
                      className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attachment</label>
                    <input
                      type="file"
                      name="attachment"
                      accept="*"
                      onChange={handleChange}
                      className="block w-full"
                    />
                  </div>
                  <div className="flex justify-end space-x-4 pt-4">
                    <button type="button" onClick={closeModal} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
                    <button type="submit" className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Submit</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Description modal for 'more...' */}
      {showDescModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowDescModal(false)} />
            <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-md w-full relative">
              <div className="px-6 py-4 bg-blue-600 flex items-center justify-between">
                <h3 className="text-lg font-medium leading-6 text-white">Full Description</h3>
                <button onClick={() => setShowDescModal(false)} className="text-white hover:text-gray-200 text-2xl font-bold">&times;</button>
              </div>
              <div className="px-6 py-5 bg-white">
                {descCanEdit ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Edit Description</label>
                    <textarea
                      name="description"
                      value={editForm.description}
                      onChange={handleEditChange}
                      className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={6}
                    />
                    <div className="flex justify-end pt-4">
                      <button onClick={closeDescModal} className="inline-flex justify-center px-4 py-2 mr-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
                      <button onClick={saveDescFromModal} className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap text-gray-700">{editForm.description}</div>
                    <div className="flex justify-end pt-4">
                      <button onClick={() => setShowDescModal(false)} className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50">Close</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RaiseTicket;
