import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import StatusBadge from '../../components/common/StatusBadge';
import Modal, { LoadingSpinner } from '../../components/common/Modal';
import { formatCurrency, formatDate, PRIORITY_CONFIG, COMMON_SERVICES_CATALOG } from '../../utils/constants';

import {
  Ticket,
  Laptop,
  CheckSquare,
  Receipt,
  Star,
  ShieldCheck,
  Plus,
  Wrench,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';

export const CustomerDashboard = () => {
  const [activeTab, setActiveTab] = useState('my-tickets');
  const [loading, setLoading] = useState(true);

  const [tickets, setTickets] = useState([]);
  const [devices, setDevices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [warranties, setWarranties] = useState([]);

  // Estimate Approval Modal State
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Feedback Modal State
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedTicketForFeedback, setSelectedTicketForFeedback] = useState(null);
  const [rating, setRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [isComplaint, setIsComplaint] = useState(false);

  // Register Device Modal State
  const [addDeviceModalOpen, setAddDeviceModalOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    deviceType: 'LAPTOP',
    brand: '',
    model: '',
    serialNumber: '',
    processor: '',
    ram: '',
    storage: '',
    operatingSystem: 'Windows 11',
    physicalCondition: 'Good condition',
    accessoriesReceived: 'Charger',
    passwordPin: ''
  });

  // Create Service Request Modal State
  const [createTicketModalOpen, setCreateTicketModalOpen] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    deviceId: '',
    reportedIssue: '',
    priority: 'MEDIUM'
  });

  const handleSelectServiceProblem = (svc) => {
    setNewTicketForm((prev) => ({
      ...prev,
      reportedIssue: prev.reportedIssue
        ? `${prev.reportedIssue} + ${svc.name} (₹${svc.price})`
        : `${svc.name} (Estimated Service Cost: ₹${svc.price})`
    }));
  };

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, invoicesRes, warrantiesRes, devRes] = await Promise.all([
        api.get('/service-requests').catch(() => ({ data: { success: false, data: { requests: [] } } })),
        api.get('/billing/invoices').catch(() => ({ data: { success: false, data: { invoices: [] } } })),
        api.get('/warranties').catch(() => ({ data: { success: false, data: { warranties: [] } } })),
        api.get('/devices').catch(() => ({ data: { success: false, data: { devices: [] } } }))
      ]);

      if (ticketsRes.data.success) {
        setTickets(ticketsRes.data.data.requests || []);
      }
      if (invoicesRes.data.success) {
        setInvoices(invoicesRes.data.data.invoices || []);
      }
      if (warrantiesRes.data.success) {
        setWarranties(warrantiesRes.data.data.warranties || []);
      }
      if (devRes.data.success) {
        setDevices(devRes.data.data.devices || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerData();
  }, []);

  const openEstimate = async (ticketId) => {
    try {
      const res = await api.get(`/estimates/ticket/${ticketId}`);
      if (res.data.success && res.data.data.estimates.length > 0) {
        const latest = res.data.data.estimates[0];
        const fullEstRes = await api.get(`/estimates/${latest.id}`);
        setSelectedEstimate(fullEstRes.data.data.estimate);
        setIsRejecting(false);
        setCustomerNotes('');
        setRejectionReason('');
        setEstimateModalOpen(true);
      } else {
        alert('No formal estimate has been drafted by the technician yet.');
      }
    } catch (err) {
      alert('Failed to load estimate');
    }
  };

  const handleRespondEstimate = async (action) => {
    try {
      await api.post(`/estimates/${selectedEstimate.id}/respond`, {
        action,
        customerNotes,
        rejectionReason: action === 'REJECT' ? rejectionReason : null
      });
      alert(action === 'APPROVE' ? 'Estimate approved! Repair work is underway.' : 'Estimate rejected.');
      setEstimateModalOpen(false);
      loadCustomerData();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try {
      await api.post('/feedback', {
        serviceRequestId: selectedTicketForFeedback.id,
        rating,
        comments: feedbackComments,
        isComplaint
      });
      alert('Thank you for submitting your feedback!');
      setFeedbackModalOpen(false);
      loadCustomerData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit feedback');
    }
  };

  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    try {
      await api.post('/devices', deviceForm);
      alert('Device registered successfully under your customer profile!');
      setAddDeviceModalOpen(false);
      setDeviceForm({
        deviceType: 'LAPTOP',
        brand: '',
        model: '',
        serialNumber: '',
        processor: '',
        ram: '',
        storage: '',
        operatingSystem: 'Windows 11',
        physicalCondition: 'Good condition',
        accessoriesReceived: 'Charger',
        passwordPin: ''
      });
      loadCustomerData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register device');
    }
  };

  const handleCreateServiceRequest = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/service-requests', {
        deviceId: newTicketForm.deviceId,
        reportedIssue: newTicketForm.reportedIssue,
        priority: newTicketForm.priority,
        estimatedCost: 500
      });
      alert(`Service request ${res.data.data.ticket.ticket_number} created successfully! Our service desk will inspect it.`);
      setCreateTicketModalOpen(false);
      setNewTicketForm({ deviceId: '', reportedIssue: '', priority: 'MEDIUM' });
      loadCustomerData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create service request');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* TAB 1: MY TICKETS & APPROVAL GATES */}
          {activeTab === 'my-tickets' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">My Service Requests</h2>
                  <p className="text-sm text-slate-500">Track device repair progression, review quotations, and authorize technicians</p>
                </div>
                <button
                  onClick={() => setCreateTicketModalOpen(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Service Request</span>
                </button>
              </div>

              {loading ? (
                <LoadingSpinner text="Retrieving your repair tickets..." />
              ) : tickets.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Ticket className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">No service requests active</h3>
                  <p className="text-sm text-slate-500 mt-1">You haven't submitted any repair jobs for service yet.</p>
                  <button
                    onClick={() => setCreateTicketModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                  >
                    Submit First Service Request
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {tickets.map((req) => (
                    <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-blue-600 text-lg">{req.ticket_number}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_CONFIG[req.priority]?.badgeClass}`}>
                              {req.priority}
                            </span>
                            <StatusBadge status={req.status} />
                          </div>
                          <h3 className="font-bold text-slate-900 text-base mt-1">
                            {req.brand} {req.model} <span className="font-mono text-xs text-slate-400 font-normal">({req.serial_number})</span>
                          </h3>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Intake Date: {formatDate(req.created_at)}</span>
                          <span className="text-xs font-semibold text-slate-700 block">
                            Expected Delivery: {formatDate(req.expected_delivery_date) || 'Under inspection'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-1 border border-slate-100">
                        <p><strong className="text-slate-800">Reported Problem:</strong> {req.reported_issue}</p>
                        <p className="text-slate-500">
                          Assigned Technician: {req.tech_first_name ? `${req.tech_first_name} ${req.tech_last_name}` : 'Pending Assignment'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2">
                        <div>
                          <span className="text-xs text-slate-400">Current Cost Estimate:</span>
                          <p className="text-lg font-bold text-slate-900">{formatCurrency(req.final_cost > 0 ? req.final_cost : req.estimated_cost)}</p>
                        </div>

                        <div className="flex space-x-3">
                          {req.status === 'WAITING_FOR_CUSTOMER_APPROVAL' && (
                            <button
                              onClick={() => openEstimate(req.id)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors animate-pulse"
                            >
                              Review & Authorize Estimate
                            </button>
                          )}

                          {req.status === 'DELIVERED' && (
                            <button
                              onClick={() => {
                                setSelectedTicketForFeedback(req);
                                setFeedbackModalOpen(true);
                              }}
                              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-colors"
                            >
                              Rate Service & Feedback
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY REGISTERED DEVICES */}
          {activeTab === 'devices' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">My Registered Computers & Devices</h2>
                  <p className="text-sm text-slate-500">Your laptops, desktops and peripherals registered in the ByteNotes system</p>
                </div>
                <button
                  onClick={() => setAddDeviceModalOpen(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New Device</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {devices.map((d) => (
                  <div key={d.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {d.device_type}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900">{d.brand} {d.model}</h3>
                      <p className="font-mono text-xs text-slate-400">SN: {d.serial_number}</p>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p><strong>CPU:</strong> {d.processor || 'N/A'}</p>
                      <p><strong>RAM:</strong> {d.ram || 'N/A'} | <strong>Storage:</strong> {d.storage || 'N/A'}</p>
                      <p><strong>OS:</strong> {d.operating_system || 'N/A'}</p>
                      <p><strong>Condition:</strong> {d.physical_condition || 'Normal'}</p>
                    </div>

                    <div className="pt-2 text-right">
                      <button
                        onClick={() => {
                          setNewTicketForm({ ...newTicketForm, deviceId: d.id });
                          setCreateTicketModalOpen(true);
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        Request Service for This Device →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: NEW SERVICE REQUEST */}
          {activeTab === 'new-request' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Submit Service Request</h2>
                <p className="text-sm text-slate-500">Initiate repair booking for one of your registered devices</p>
              </div>

              <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <form onSubmit={handleCreateServiceRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">Select Registered Device *</label>
                    <select
                      required
                      value={newTicketForm.deviceId}
                      onChange={(e) => setNewTicketForm({ ...newTicketForm, deviceId: e.target.value })}
                      className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                    >
                      <option value="">-- Choose Your Device --</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.brand} {d.model} ({d.serial_number}) - {d.device_type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">Describe The Problem / Symptoms *</label>
                    <textarea
                      rows="4"
                      required
                      placeholder="E.g., Screen flickers when hinge is opened past 90 degrees; laptop shuts down under gaming load"
                      value={newTicketForm.reportedIssue}
                      onChange={(e) => setNewTicketForm({ ...newTicketForm, reportedIssue: e.target.value })}
                      className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">Priority Preference</label>
                    <select
                      value={newTicketForm.priority}
                      onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
                      className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium (Standard)</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent (Express)</option>
                    </select>
                  </div>

                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md">
                    Submit Repair Ticket
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: ESTIMATES & APPROVALS */}
          {activeTab === 'estimates' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Quotations & Repair Estimates</h2>
                <p className="text-sm text-slate-500">Review repair quotes before technicians proceed with component installation</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tickets.map((t) => (
                  <div key={t.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-blue-600">{t.ticket_number}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="font-bold text-slate-900">{t.brand} {t.model}</p>
                    <p className="text-xs text-slate-600">Issue: {t.reported_issue}</p>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs font-bold text-slate-800">Est: {formatCurrency(t.estimated_cost)}</span>
                      <button
                        onClick={() => openEstimate(t.id)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        View Official Estimate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: INVOICES & PAYMENTS */}
          {activeTab === 'invoices' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Invoices & Payment Receipts</h2>
                <p className="text-sm text-slate-500">Official tax invoices, itemized spare parts, and downloadable statements</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Ticket</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Total Amount</th>
                      <th className="py-3.5 px-4">Paid</th>
                      <th className="py-3.5 px-4">Balance</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Document</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{inv.invoice_number}</td>
                        <td className="py-3.5 px-4 font-mono text-xs">{inv.ticket_number}</td>
                        <td className="py-3.5 px-4">{formatDate(inv.invoice_date)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{formatCurrency(inv.total_amount)}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">{formatCurrency(inv.paid_amount)}</td>
                        <td className="py-3.5 px-4 font-bold text-rose-600">{formatCurrency(inv.balance_amount)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            inv.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {inv.payment_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {inv.pdf_path ? (
                            <a
                              href={`http://localhost:5000${inv.pdf_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold inline-flex items-center space-x-1"
                            >
                              <FileText className="w-3.5 h-3.5 text-rose-500" />
                              <span>View Invoice</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: WARRANTY DETAILS */}
          {activeTab === 'warranties' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Repair Warranty Certificates</h2>
                <p className="text-sm text-slate-500">Service center repair guarantee validities (WAR-YYYYMM-XXXX)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {warranties.map((w) => (
                  <div key={w.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        w.is_valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {w.is_valid ? 'ACTIVE' : 'EXPIRED'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-mono font-bold text-base text-slate-900">{w.warranty_code}</h3>
                      <p className="text-xs text-slate-500">{w.brand} {w.model} ({w.serial_number})</p>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p><strong>Ticket:</strong> {w.ticket_number}</p>
                      <p><strong>Expiry Date:</strong> {formatDate(w.expiry_date)}</p>
                      <p><strong>Days Remaining:</strong> <span className="font-bold text-blue-600">{Math.max(0, w.days_remaining)} days</span></p>
                      <p className="text-[11px] text-slate-400 mt-1">{w.terms}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: RATINGS & FEEDBACK */}
          {activeTab === 'feedback' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Service Ratings & Feedback</h2>
                <p className="text-sm text-slate-500">Share your repair experience with ByteNotes technicians</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-600 mb-4">Completed repairs ready for feedback rating:</p>
                <div className="space-y-3">
                  {tickets
                    .filter((t) => t.status === 'DELIVERED')
                    .map((t) => (
                      <div key={t.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                        <div>
                          <p className="font-mono font-bold text-blue-600 text-sm">{t.ticket_number}</p>
                          <p className="font-semibold text-slate-800 text-sm">{t.brand} {t.model}</p>
                          <p className="text-xs text-slate-500">{t.reported_issue}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTicketForFeedback(t);
                            setFeedbackModalOpen(true);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Submit Rating
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Register Device Modal */}
      <Modal isOpen={addDeviceModalOpen} onClose={() => setAddDeviceModalOpen(false)} title="Register New Hardware Device">
        <form onSubmit={handleRegisterDevice} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Device Type *</label>
              <select
                value={deviceForm.deviceType}
                onChange={(e) => setDeviceForm({ ...deviceForm, deviceType: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold"
              >
                <option value="LAPTOP">Laptop</option>
                <option value="DESKTOP">Desktop</option>
                <option value="PRINTER">Printer</option>
                <option value="MONITOR">Monitor</option>
                <option value="OTHER">Other Peripheral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Brand *</label>
              <input
                type="text"
                required
                placeholder="Dell, Lenovo, HP, Apple..."
                value={deviceForm.brand}
                onChange={(e) => setDeviceForm({ ...deviceForm, brand: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Model *</label>
              <input
                type="text"
                required
                placeholder="Inspiron 15, MacBook Pro..."
                value={deviceForm.model}
                onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Serial Number *</label>
              <input
                type="text"
                required
                placeholder="Service Tag / Serial #"
                value={deviceForm.serialNumber}
                onChange={(e) => setDeviceForm({ ...deviceForm, serialNumber: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Processor</label>
              <input
                type="text"
                placeholder="Intel i7"
                value={deviceForm.processor}
                onChange={(e) => setDeviceForm({ ...deviceForm, processor: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">RAM</label>
              <input
                type="text"
                placeholder="16GB"
                value={deviceForm.ram}
                onChange={(e) => setDeviceForm({ ...deviceForm, ram: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Storage</label>
              <input
                type="text"
                placeholder="512GB SSD"
                value={deviceForm.storage}
                onChange={(e) => setDeviceForm({ ...deviceForm, storage: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Device Unlock PIN / Password</label>
            <input
              type="password"
              placeholder="Stored securely and encrypted"
              value={deviceForm.passwordPin}
              onChange={(e) => setDeviceForm({ ...deviceForm, passwordPin: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddDeviceModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Register Device
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Service Request Modal */}
      <Modal isOpen={createTicketModalOpen} onClose={() => setCreateTicketModalOpen(false)} title="New Service Request">
        <form onSubmit={handleCreateServiceRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Select Registered Device *</label>
            <select
              required
              value={newTicketForm.deviceId}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, deviceId: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            >
              <option value="">-- Choose Your Device --</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.brand} {d.model} ({d.serial_number}) - {d.device_type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">Describe The Problem *</label>
              <span className="text-[11px] text-blue-600 font-semibold">⚡ Quick-pick services below</span>
            </div>

            {/* Quick Pick Service Catalog Pills */}
            <div className="mb-2 p-2 bg-blue-50/70 rounded-xl border border-blue-100">
              <p className="text-[11px] font-bold text-blue-900 mb-1.5 uppercase">Common Services & Auto-Pricing:</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SERVICES_CATALOG.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => handleSelectServiceProblem(svc)}
                    className="px-2 py-1 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-800 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1"
                  >
                    <span>{svc.name}</span>
                    <span className="px-1 py-0.2 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">
                      ₹{svc.price}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows="3"
              required
              placeholder="Please describe symptoms, or pick one or more common services above..."
              value={newTicketForm.reportedIssue}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, reportedIssue: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Priority</label>
            <select
              value={newTicketForm.priority}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium (Standard)</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent (Express)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateTicketModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Create Repair Ticket
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Estimate Modal */}
      <Modal isOpen={estimateModalOpen} onClose={() => setEstimateModalOpen(false)} title={`Estimate Quotation v${selectedEstimate?.version_number}`}>
        {selectedEstimate && (
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
              <div>
                <span className="font-bold text-blue-900 text-sm">Official Repair Quote</span>
                <p className="text-blue-700">Created by Technician on {formatDate(selectedEstimate.created_at)}</p>
              </div>
              <span className="text-xl font-bold text-blue-900">{formatCurrency(selectedEstimate.total_estimate)}</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedEstimate.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-semibold text-slate-800">{item.description}</td>
                      <td className="p-2.5">{item.item_type}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/70 font-semibold">
                    <td colSpan="2" className="p-2.5 text-right">Labour Charges:</td>
                    <td className="p-2.5 text-right">{formatCurrency(selectedEstimate.labour_charge)}</td>
                  </tr>
                  <tr className="bg-slate-50/70 font-semibold">
                    <td colSpan="2" className="p-2.5 text-right">Estimated Tax (GST):</td>
                    <td className="p-2.5 text-right">{formatCurrency(selectedEstimate.tax_amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {isRejecting ? (
              <div className="space-y-2 p-3 bg-rose-50 rounded-xl border border-rose-200">
                <label className="block font-bold text-rose-800 uppercase">Reason for Declining Quotation *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="E.g., Price is beyond my budget; deciding not to proceed with repair"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs"
                ></textarea>
                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() => handleRespondEstimate('REJECT')}
                    className="flex-1 py-2 bg-rose-600 text-white rounded-lg font-bold"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => setIsRejecting(false)}
                    className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEstimateModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Close
                </button>
                <button
                  onClick={() => setIsRejecting(true)}
                  className="px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-xs"
                >
                  Decline Quote
                </button>
                <button
                  onClick={() => handleRespondEstimate('APPROVE')}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm"
                >
                  Approve Quotation & Authorize Repair
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Submit Feedback Modal */}
      <Modal isOpen={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} title="Customer Rating & Feedback">
        <form onSubmit={handleSubmitFeedback} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Rating (1 to 5 Stars)</label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setRating(s)}
                  className={`w-10 h-10 rounded-xl font-bold text-base transition-colors ${
                    rating >= s ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Comments / Review Notes</label>
            <textarea
              rows="3"
              placeholder="How was the quality of repair, turnaround speed, and technician communication?"
              value={feedbackComments}
              onChange={(e) => setFeedbackComments(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            ></textarea>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="complaintCheckbox"
              checked={isComplaint}
              onChange={(e) => setIsComplaint(e.target.checked)}
              className="rounded text-blue-600"
            />
            <label htmlFor="complaintCheckbox" className="text-xs text-slate-700 font-medium">
              Flag as Service Complaint (Requires managerial attention)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFeedbackModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Submit Rating & Feedback
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CustomerDashboard;
