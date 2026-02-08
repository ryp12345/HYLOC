import React, { useState, useEffect } from 'react';
import { getTicketCounts, createTicket } from '../../api/devTicketsApi';
import { Link } from 'react-router-dom';

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

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

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
        <button onClick={openModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Raise New Ticket</button>
        <Link to="/tickets" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">View All Tickets</Link>
      </div>

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
    </div>
  );
};

export default RaiseTicket;
