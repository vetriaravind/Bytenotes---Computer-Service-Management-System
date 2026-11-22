import React, { useState } from 'react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, PRIORITY_CONFIG } from '../../utils/constants';
import { Link } from 'react-router-dom';
import { Wrench, Search, Ticket, Laptop, Clock, UserCheck, CheckCircle2, ArrowRight } from 'lucide-react';

export const TicketTrackerPage = () => {
  const [ticketInput, setTicketInput] = useState('');
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;

    setLoading(true);
    setError('');
    setTicketData(null);

    try {
      const res = await api.get(`/service-requests/track/${ticketInput.trim()}`);
      if (res.data.success) {
        setTicketData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No ticket found with this identifier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">ByteNotes Live Tracker</span>
        </Link>
        <Link to="/login" className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700">
          <span>Portal Login</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 sm:p-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900">Track Computer Repair Status</h1>
          <p className="text-sm text-slate-600">Enter your service receipt ticket number to see real-time repair progress</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleTrack} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-md flex items-center space-x-2">
          <Ticket className="w-5 h-5 text-slate-400 pl-1 ml-2" />
          <input
            type="text"
            required
            placeholder="E.g., BN-2026-0001"
            value={ticketInput}
            onChange={(e) => setTicketInput(e.target.value)}
            className="flex-1 px-3 py-2 text-sm focus:outline-none uppercase font-mono font-semibold"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Track Ticket'}
          </button>
        </form>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {/* Live Tracking Timeline */}
        {ticketData && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between border-b pb-4 gap-2">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Service Ticket</span>
                <h3 className="font-mono text-2xl font-extrabold text-blue-600">{ticketData.ticket.ticketNumber}</h3>
              </div>
              <div className="text-right">
                <StatusBadge status={ticketData.ticket.status} />
                <span className="block text-xs text-slate-400 mt-1">Expected: {formatDate(ticketData.ticket.expectedDeliveryDate) || 'Pending diagnostics'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
              <div>
                <p className="text-slate-400 font-semibold uppercase">Device</p>
                <p className="font-bold text-slate-800 text-sm">{ticketData.ticket.device.brand} {ticketData.ticket.device.model}</p>
                <p className="text-slate-500">{ticketData.ticket.device.type}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase">Assigned Technician</p>
                <p className="font-bold text-slate-800 text-sm">{ticketData.ticket.technician}</p>
                <p className="text-slate-500">Service Center Staff</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Reported Problem</p>
              <p className="text-sm text-slate-800 mt-1 font-medium">{ticketData.ticket.reportedIssue}</p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Complete Status History Timeline</h4>
              <div className="space-y-4">
                {ticketData.timeline?.map((step, idx) => (
                  <div key={idx} className="flex space-x-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100"></div>
                      {idx !== ticketData.timeline.length - 1 && <div className="w-0.5 h-full bg-slate-200 my-1"></div>}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">{step.new_status}</span>
                        <span className="text-slate-400 text-[11px]">{formatDate(step.created_at)}</span>
                      </div>
                      <p className="text-slate-600 mt-1">{step.remarks || 'Status updated.'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TicketTrackerPage;
