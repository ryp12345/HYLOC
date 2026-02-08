import React, { useEffect, useState } from 'react';
import { getAllTickets, updateTicket } from '../../api/devTicketsApi';
import { useAuth } from '../../context/AuthContext';

const statusOptions = ['Open', 'Pending', 'Resolved'];
const priorityOptions = ['High', 'Medium', 'Low'];

export default function TicketList() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(false);

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
    loadTickets();
  }, []);

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
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

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

  const canEditAll = (ticket) => user && ticket.created_by === user.id;
  const isDeveloper = user && user.role && user.role.toLowerCase() === 'developer';

  return (
    <div className="max-w-5xl mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">All Tickets</h2>
      {loading ? <div>Loading...</div> : (
        <div className="overflow-x-auto rounded-lg shadow border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Description</th>
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
                        <input name="title" value={editForm.title} onChange={handleEditChange} className="border rounded px-2 py-1 w-32 focus:ring-2 focus:ring-blue-500" />
                      ) : ticket.title}
                    </td>
                    <td className="border px-4 py-2 align-top">
                      {editingId === ticket.id ? (
                        <input name="description" value={editForm.description} onChange={handleEditChange} className="border rounded px-2 py-1 w-48 focus:ring-2 focus:ring-blue-500" />
                      ) : ticket.description}
                    </td>
                    <td className="border px-4 py-2 align-top">
                      {editingId === ticket.id ? (
                        <select name="priority" value={editForm.priority} onChange={handleEditChange} className="border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500">
                          {priorityOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
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
                          <button
                            onClick={() => saveEdit(ticket.id)}
                            className="p-2 text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700"
                            title="Save"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
                            title="Cancel"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(ticket)}
                          className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
                          title="Edit Ticket"
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
  );
}
