import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import StatusBadge from '../../components/common/StatusBadge';
import Modal, { LoadingSpinner } from '../../components/common/Modal';
import { formatDate, formatCurrency, PRIORITY_CONFIG, COMMON_SERVICES_CATALOG } from '../../utils/constants';

import {
  Laptop,
  Users,
  Ticket,
  CheckSquare,
  Receipt,
  Search,
  Plus,
  Edit,
  Printer,
  DollarSign,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText
} from 'lucide-react';

export const ReceptionistDashboard = () => {
  const [activeTab, setActiveTab] = useState('intake');
  const [loading, setLoading] = useState(false);

  // Intake Multi-Step Form State
  const [customerForm, setCustomerForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: ''
  });

  const [deviceForm, setDeviceForm] = useState({
    deviceType: 'LAPTOP',
    brand: '',
    model: '',
    serialNumber: '',
    processor: '',
    ram: '',
    storage: '',
    operatingSystem: 'Windows 11',
    physicalCondition: 'Minor casing scratches; display intact',
    accessoriesReceived: 'Power Adapter & Cable; Laptop Bag',
    passwordPin: ''
  });

  const [ticketForm, setTicketForm] = useState({
    reportedIssue: '',
    priority: 'MEDIUM',
    estimatedCost: '500',
    expectedDeliveryDate: ''
  });

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [intakeSuccess, setIntakeSuccess] = useState(null);

  // Directory Data
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [tickets, setTickets] = useState([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [invoices, setInvoices] = useState([]);

  // Edit Customer Modal State
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Ticket Status History Modal State
  const [statusHistoryModalOpen, setStatusHistoryModalOpen] = useState(false);
  const [selectedTicketHistory, setSelectedTicketHistory] = useState(null);

  // Create Estimate Modal State
  const [createEstimateModalOpen, setCreateEstimateModalOpen] = useState(false);
  const [estimateTicketId, setEstimateTicketId] = useState('');
  const [estimateLabour, setEstimateLabour] = useState('600');
  const [estimateTaxRate, setEstimateTaxRate] = useState('18');
  const [estimateItems, setEstimateItems] = useState([
    { description: 'Screen Diagnostic & Disassembly Labour', itemType: 'LABOUR', quantity: 1, unitPrice: 600 }
  ]);

  // Invoice & Payment Modal State
  const [createInvoiceModalOpen, setCreateInvoiceModalOpen] = useState(false);
  const [invoiceTicketId, setInvoiceTicketId] = useState('');
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');

  // Auto-pricing service selection handler
  const handleSelectServiceProblem = (service) => {
    setTicketForm((prev) => {
      let currentIssue = prev.reportedIssue.trim();
      let newIssue = currentIssue;
      if (!newIssue) {
        newIssue = service.name;
      } else if (!newIssue.includes(service.name)) {
        newIssue = `${newIssue}, ${service.name}`;
      }
      return {
        ...prev,
        reportedIssue: newIssue,
        estimatedCost: service.price.toString()
      };
    });
  };

  const handleIssueTextChange = (text) => {
    const lower = text.toLowerCase();
    const matched = COMMON_SERVICES_CATALOG.find((s) =>
      s.keywords.some((kw) => lower.includes(kw))
    );
    setTicketForm((prev) => ({
      ...prev,
      reportedIssue: text,
      estimatedCost: matched ? matched.price.toString() : prev.estimatedCost
    }));
  };

  const loadData = async () => {
    try {
      const [custRes, ticketRes, invRes] = await Promise.all([
        api.get(`/customers?search=${customerSearch}&limit=50`).catch(() => ({ data: { success: false } })),
        api.get('/service-requests?limit=50').catch(() => ({ data: { success: false } })),
        api.get('/billing/invoices?limit=50').catch(() => ({ data: { success: false } }))
      ]);
      if (custRes.data.success) setCustomers(custRes.data.data.customers);
      if (ticketRes.data.success) setTickets(ticketRes.data.data.requests);
      if (invRes.data.success) setInvoices(invRes.data.data.invoices);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerSearch]);

  const handleFullIntake = async (e) => {
    e.preventDefault();
    setLoading(true);
    setIntakeSuccess(null);

    try {
      // 1. Create or Find Customer
      let customerId = null;
      try {
        const custRes = await api.post('/customers', customerForm);
        customerId = custRes.data.data.customer.id;
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.errors?.existingCustomerId) {
          customerId = err.response.data.errors.existingCustomerId;
        } else {
          throw err;
        }
      }

      // 2. Register Device
      const devRes = await api.post('/devices', {
        ...deviceForm,
        customerId
      });
      const deviceId = devRes.data.data.device.id;

      // 3. Optional: Upload intake damage photographs (Multer)
      if (selectedPhotos.length > 0) {
        const formData = new FormData();
        for (let i = 0; i < selectedPhotos.length; i++) {
          formData.append('photos', selectedPhotos[i]);
        }
        formData.append('caption', 'Intake desk condition photo');
        await api.post(`/devices/${deviceId}/attachments`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // 4. Create Service Ticket (BN-2026-XXXX)
      const ticketRes = await api.post('/service-requests', {
        customerId,
        deviceId,
        reportedIssue: ticketForm.reportedIssue,
        priority: ticketForm.priority,
        estimatedCost: ticketForm.estimatedCost,
        expectedDeliveryDate: ticketForm.expectedDeliveryDate || null,
        intakeRemarks: `Condition: ${deviceForm.physicalCondition} | Accessories: ${deviceForm.accessoriesReceived}`
      });

      const newTicket = ticketRes.data.data.ticket;

      setIntakeSuccess({
        ticketNumber: newTicket.ticket_number,
        requestId: newTicket.id,
        customerName: `${customerForm.firstName} ${customerForm.lastName}`,
        device: `${deviceForm.brand} ${deviceForm.model}`
      });

      // Reset Form fields
      setCustomerForm({ firstName: '', lastName: '', phone: '', email: '', address: '' });
      setDeviceForm({
        deviceType: 'LAPTOP',
        brand: '',
        model: '',
        serialNumber: '',
        processor: '',
        ram: '',
        storage: '',
        operatingSystem: 'Windows 11',
        physicalCondition: 'Minor casing scratches; display intact',
        accessoriesReceived: 'Power Adapter & Cable; Laptop Bag',
        passwordPin: ''
      });
      setTicketForm({ reportedIssue: '', priority: 'MEDIUM', estimatedCost: '500', expectedDeliveryDate: '' });
      setSelectedPhotos([]);

      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Intake registration failed. Please verify inputs.');
    } finally {
      setLoading(false);
    }
  };

  const openReceipt = async (ticketId) => {
    try {
      const res = await api.get(`/service-requests/${ticketId}/receipt`);
      setReceiptData(res.data.data.receipt);
      setReceiptModalOpen(true);
    } catch (err) {
      alert('Failed to generate receipt');
    }
  };

  const openTicketHistory = async (ticket) => {
    try {
      const res = await api.get(`/service-requests/${ticket.id}`);
      setSelectedTicketHistory({
        ticket,
        history: res.data.data.statusHistory || []
      });
      setStatusHistoryModalOpen(true);
    } catch (err) {
      alert('Failed to load status history');
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/customers/${editingCustomer.id}`, editingCustomer);
      setEditCustomerModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update customer');
    }
  };

  const handleAddEstimateItem = () => {
    setEstimateItems([
      ...estimateItems,
      { description: 'Replacement Spare Component', itemType: 'PART', quantity: 1, unitPrice: 500 }
    ]);
  };

  const handleCreateEstimate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/estimates', {
        serviceRequestId: estimateTicketId,
        labourCharge: estimateLabour,
        taxRate: estimateTaxRate,
        items: estimateItems
      });
      alert('Repair estimate created successfully! Ticket moved to WAITING_FOR_CUSTOMER_APPROVAL.');
      setCreateEstimateModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create estimate');
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/billing/invoices', {
        serviceRequestId: invoiceTicketId
      });
      alert(`Invoice ${res.data.data.invoice.invoice_number} generated successfully!`);
      setCreateInvoiceModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate invoice');
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/billing/payments', {
        invoiceId: paymentInvoiceId,
        amount: paymentAmount,
        paymentMethod,
        transactionId: transactionRef,
        paymentType: 'FINAL_SETTLEMENT',
        notes: 'Reception payment collection'
      });
      alert('Payment recorded successfully!');
      setRecordPaymentModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment recording failed');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const q = ticketSearch.toLowerCase();
    return (
      t.ticket_number?.toLowerCase().includes(q) ||
      t.customer_first_name?.toLowerCase().includes(q) ||
      t.customer_phone?.includes(q) ||
      t.brand?.toLowerCase().includes(q) ||
      t.model?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* TAB 1: DEVICE INTAKE WORKFLOW */}
          {activeTab === 'intake' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Walk-in Customer & Device Intake Desk</h2>
                <p className="text-sm text-slate-500">Atomic registration: Customer, hardware specifications, condition photos & service ticket</p>
              </div>

              {intakeSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-900">
                      Ticket <strong className="font-mono text-blue-600">{intakeSuccess.ticketNumber}</strong> created for {intakeSuccess.customerName} ({intakeSuccess.device}).
                    </p>
                  </div>
                  <button
                    onClick={() => openReceipt(intakeSuccess.requestId)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Service Receipt</span>
                  </button>
                </div>
              )}

              <form onSubmit={handleFullIntake} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                {/* SECTION 1: CUSTOMER DETAILS */}
                <div>
                  <h3 className="font-bold text-sm text-blue-600 uppercase tracking-wider mb-3 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                    <span>Customer Information (Prevents duplicate phone numbers)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">First Name *</label>
                      <input
                        type="text"
                        required
                        value={customerForm.firstName}
                        onChange={(e) => setCustomerForm({ ...customerForm, firstName: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={customerForm.lastName}
                        onChange={(e) => setCustomerForm({ ...customerForm, lastName: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                        placeholder="9876543210"
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: DEVICE DETAILS & PHYSICAL DAMAGE */}
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="font-bold text-sm text-blue-600 uppercase tracking-wider mb-3 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">2</span>
                    <span>Device Specifications & Intake Condition</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Device Type *</label>
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
                      <label className="block text-xs font-semibold text-slate-700">Brand *</label>
                      <input
                        type="text"
                        required
                        placeholder="Dell, HP, Lenovo, Apple..."
                        value={deviceForm.brand}
                        onChange={(e) => setDeviceForm({ ...deviceForm, brand: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Model *</label>
                      <input
                        type="text"
                        required
                        placeholder="Inspiron 15, ThinkPad T14..."
                        value={deviceForm.model}
                        onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Hardware Serial Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="SN / Service Tag"
                        value={deviceForm.serialNumber}
                        onChange={(e) => setDeviceForm({ ...deviceForm, serialNumber: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Processor</label>
                      <input
                        type="text"
                        placeholder="Intel Core i5-12400"
                        value={deviceForm.processor}
                        onChange={(e) => setDeviceForm({ ...deviceForm, processor: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">RAM</label>
                      <input
                        type="text"
                        placeholder="16GB DDR4"
                        value={deviceForm.ram}
                        onChange={(e) => setDeviceForm({ ...deviceForm, ram: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Storage</label>
                      <input
                        type="text"
                        placeholder="512GB NVMe SSD"
                        value={deviceForm.storage}
                        onChange={(e) => setDeviceForm({ ...deviceForm, storage: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Unlock PIN / Password (Encrypted)</label>
                      <input
                        type="password"
                        placeholder="Will be encrypted at rest"
                        value={deviceForm.passwordPin}
                        onChange={(e) => setDeviceForm({ ...deviceForm, passwordPin: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Physical Condition & Scratches</label>
                      <input
                        type="text"
                        value={deviceForm.physicalCondition}
                        onChange={(e) => setDeviceForm({ ...deviceForm, physicalCondition: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Accessories Received</label>
                      <input
                        type="text"
                        value={deviceForm.accessoriesReceived}
                        onChange={(e) => setDeviceForm({ ...deviceForm, accessoriesReceived: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Multi-Photo Upload via Multer */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-700">Upload Pre-Existing Condition Photos</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => setSelectedPhotos(e.target.files)}
                      className="mt-1 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>

                {/* SECTION 3: REPAIR COMPLAINT & PRIORITY */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                    <h3 className="font-bold text-sm text-blue-600 uppercase tracking-wider flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</span>
                      <span>Customer Complaint & Problem Pricing</span>
                    </h3>
                    <span className="text-xs text-slate-500 mt-1 sm:mt-0 font-medium">
                      💡 Select common service to auto-fill initial price
                    </span>
                  </div>

                  {/* Quick-Pick Common Service Tags with Auto-Pricing */}
                  <div className="mb-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wide">
                      ⚡ Quick Add Common Service (Auto-Prices Initial Cost):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_SERVICES_CATALOG.map((svc) => (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => handleSelectServiceProblem(svc)}
                          className="px-2.5 py-1.5 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-800 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center space-x-1.5 active:scale-95"
                        >
                          <span>{svc.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 group-hover:bg-blue-700 text-blue-700 text-[10px] font-bold">
                            ₹{svc.price}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Reported Issue / Symptoms *</label>
                    <textarea
                      rows="3"
                      required
                      placeholder="E.g., RAM failure (giving beep sounds and blue screens); or screen replacement..."
                      value={ticketForm.reportedIssue}
                      onChange={(e) => handleIssueTextChange(e.target.value)}
                      className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Priority Level</label>
                      <select
                        value={ticketForm.priority}
                        onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium (Standard)</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent (Express)</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700">Initial Estimated Fee (₹) *</label>
                        <span className="text-[10px] text-blue-600 font-bold">Auto-calculated</span>
                      </div>
                      <input
                        type="number"
                        required
                        value={ticketForm.estimatedCost}
                        onChange={(e) => setTicketForm({ ...ticketForm, estimatedCost: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-blue-50/50 border border-blue-200 text-blue-900 font-bold rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Expected Delivery Date</label>
                      <input
                        type="date"
                        value={ticketForm.expectedDeliveryDate}
                        onChange={(e) => setTicketForm({ ...ticketForm, expectedDeliveryDate: e.target.value })}
                        className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing Intake...' : 'Submit & Create Service Request (BN-2026-XXXX)'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: CUSTOMERS DIRECTORY */}
          {activeTab === 'customers' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Customers Directory</h2>
                  <p className="text-sm text-slate-500">Search customer records by phone, name, or email (Deduplicated)</p>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search by phone or name..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4">Customer Name</th>
                      <th className="py-3.5 px-4">Primary Phone</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">City</th>
                      <th className="py-3.5 px-4">Devices</th>
                      <th className="py-3.5 px-4">Repairs</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{c.first_name} {c.last_name}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">{c.phone}</td>
                        <td className="py-3.5 px-4">{c.email || 'N/A'}</td>
                        <td className="py-3.5 px-4">{c.city || 'N/A'}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{c.total_devices || 0}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{c.total_service_requests || 0}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setEditingCustomer({ ...c });
                              setEditCustomerModalOpen(true);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ALL ACTIVE TICKETS */}
          {activeTab === 'tickets' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Service Tickets Queue</h2>
                  <p className="text-sm text-slate-500">Track 10-state lifecycle progression & generate intake receipts</p>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search ticket number, customer..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4">Ticket #</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Device</th>
                      <th className="py-3.5 px-4">Priority</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Estimated Delivery</th>
                      <th className="py-3.5 px-4 text-right">Receipt / History</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{t.ticket_number}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{t.customer_first_name} {t.customer_last_name}</p>
                          <p className="text-xs text-slate-400">{t.customer_phone}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-800">{t.brand} {t.model}</span>
                          <span className="text-xs text-slate-400 block">{t.device_type}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_CONFIG[t.priority]?.badgeClass}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium">{formatDate(t.expected_delivery_date) || 'TBD'}</td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => openReceipt(t.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            <span>Receipt</span>
                          </button>
                          <button
                            onClick={() => openTicketHistory(t)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>History</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: REPAIR ESTIMATES */}
          {activeTab === 'estimates' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Repair Quotations & Estimates</h2>
                  <p className="text-sm text-slate-500">Draft repair estimates with labour and spare parts line items for customer approval</p>
                </div>
                <button
                  onClick={() => setCreateEstimateModalOpen(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Draft New Estimate</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3">Tickets Awaiting Customer Estimates / Under Diagnosis:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tickets
                    .filter((t) => ['RECEIVED', 'UNDER_DIAGNOSIS', 'WAITING_FOR_CUSTOMER_APPROVAL'].includes(t.status))
                    .map((t) => (
                      <div key={t.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-blue-600 text-sm">{t.ticket_number}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{t.customer_first_name} {t.customer_last_name}</p>
                        <p className="text-xs text-slate-600">{t.brand} {t.model} • {t.reported_issue}</p>
                        <div className="pt-2 flex justify-between items-center">
                          <span className="text-xs text-slate-500 font-medium">Est: {formatCurrency(t.estimated_cost)}</span>
                          <button
                            onClick={() => {
                              setEstimateTicketId(t.id);
                              setCreateEstimateModalOpen(true);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            Draft Estimate
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BILLING & PAYMENTS */}
          {activeTab === 'billing' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Invoices & Customer Payments</h2>
                  <p className="text-sm text-slate-500">Generate tax invoices, collect cash/UPI/card payments & print statements (Module 9)</p>
                </div>
                <button
                  onClick={() => setCreateInvoiceModalOpen(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Generate New Invoice</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Ticket</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Total</th>
                      <th className="py-3.5 px-4">Paid</th>
                      <th className="py-3.5 px-4">Balance</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{inv.invoice_number}</td>
                        <td className="py-3.5 px-4 font-mono text-xs">{inv.ticket_number}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{inv.customer_first_name} {inv.customer_last_name}</td>
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
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {inv.balance_amount > 0 && (
                            <button
                              onClick={() => {
                                setPaymentInvoiceId(inv.id);
                                setPaymentAmount(inv.balance_amount);
                                setRecordPaymentModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Collect Payment
                            </button>
                          )}
                          {inv.pdf_path && (
                            <a
                              href={`http://localhost:5000${inv.pdf_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center space-x-1"
                            >
                              <FileText className="w-3.5 h-3.5 text-rose-500" />
                              <span>PDF</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit Customer Modal */}
      <Modal isOpen={editCustomerModalOpen} onClose={() => setEditCustomerModalOpen(false)} title="Update Customer Details">
        {editingCustomer && (
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">First Name</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.first_name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Last Name</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.last_name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Email</label>
                <input
                  type="email"
                  value={editingCustomer.email || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Alternate Phone</label>
                <input
                  type="text"
                  value={editingCustomer.alt_phone || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, alt_phone: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Address</label>
              <textarea
                rows="2"
                value={editingCustomer.address || ''}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              ></textarea>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditCustomerModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
                Save Customer Information
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Printable Service Receipt Modal */}
      <Modal isOpen={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} title="Service Intake Receipt">
        {receiptData && (
          <div className="space-y-4 text-xs font-sans p-2">
            <div className="text-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">{receiptData.serviceCenter.name}</h2>
              <p className="text-slate-500">{receiptData.serviceCenter.address} | Tel: {receiptData.serviceCenter.phone}</p>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Receipt: {receiptData.receiptNumber}</span>
              <span className="font-mono text-blue-600">Ticket: {receiptData.ticketNumber}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg space-y-1">
              <p><strong>Customer:</strong> {receiptData.customer.name} ({receiptData.customer.phone})</p>
              <p><strong>Device:</strong> {receiptData.device.brand} {receiptData.device.model} ({receiptData.device.type})</p>
              <p><strong>Serial Number:</strong> {receiptData.device.serialNumber}</p>
              <p><strong>Condition:</strong> {receiptData.device.condition}</p>
              <p><strong>Accessories:</strong> {receiptData.device.accessories}</p>
            </div>
            <div className="border-t pt-2 space-y-1">
              <p><strong>Reported Issue:</strong> {receiptData.service.reportedIssue}</p>
              <p><strong>Initial Estimate:</strong> {formatCurrency(receiptData.service.estimatedCost)}</p>
              <p><strong>Expected Delivery:</strong> {formatDate(receiptData.service.expectedDeliveryDate) || 'Pending diagnostics'}</p>
            </div>
            <div className="pt-2 text-center text-slate-400 text-[11px]">
              Please present this receipt when collecting your serviced computer.
            </div>
            <button
              onClick={() => window.print()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold mt-2"
            >
              Print Receipt
            </button>
          </div>
        )}
      </Modal>

      {/* Ticket Status History Timeline Modal */}
      <Modal
        isOpen={statusHistoryModalOpen}
        onClose={() => setStatusHistoryModalOpen(false)}
        title={`Audit Timeline: ${selectedTicketHistory?.ticket?.ticket_number}`}
      >
        <div className="space-y-3 max-h-72 overflow-y-auto p-1">
          {selectedTicketHistory?.history?.length > 0 ? (
            selectedTicketHistory.history.map((st, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-900">{st.new_status}</span>
                  <span className="text-slate-400">{formatDate(st.created_at)}</span>
                </div>
                <p className="text-slate-600">{st.remarks || 'Status updated.'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Updated by: {st.changed_by_name || 'Staff'}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No status transitions recorded yet.</p>
          )}
        </div>
      </Modal>

      {/* Create Repair Estimate Modal */}
      <Modal isOpen={createEstimateModalOpen} onClose={() => setCreateEstimateModalOpen(false)} title="Draft Repair Quotation / Estimate">
        <form onSubmit={handleCreateEstimate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Select Service Ticket</label>
            <select
              required
              value={estimateTicketId}
              onChange={(e) => setEstimateTicketId(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
            >
              <option value="">-- Choose Ticket --</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ticket_number} - {t.customer_first_name} {t.customer_last_name} ({t.brand} {t.model})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Labour Charge (₹)</label>
              <input
                type="number"
                required
                value={estimateLabour}
                onChange={(e) => setEstimateLabour(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">GST / Tax Rate (%)</label>
              <input
                type="number"
                required
                value={estimateTaxRate}
                onChange={(e) => setEstimateTaxRate(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">Estimate Line Items</label>
              <button
                type="button"
                onClick={handleAddEstimateItem}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                + Add Line Item
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {estimateItems.map((item, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => {
                      const copy = [...estimateItems];
                      copy[index].description = e.target.value;
                      setEstimateItems(copy);
                    }}
                    className="col-span-3 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <select
                    value={item.itemType}
                    onChange={(e) => {
                      const copy = [...estimateItems];
                      copy[index].itemType = e.target.value;
                      setEstimateItems(copy);
                    }}
                    className="col-span-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="PART">Part</option>
                    <option value="LABOUR">Labour</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const copy = [...estimateItems];
                      copy[index].unitPrice = parseFloat(e.target.value) || 0;
                      setEstimateItems(copy);
                    }}
                    className="col-span-2 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateEstimateModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
              Send Estimate for Customer Approval
            </button>
          </div>
        </form>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal isOpen={createInvoiceModalOpen} onClose={() => setCreateInvoiceModalOpen(false)} title="Generate Tax Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Select Service Ticket</label>
            <select
              required
              value={invoiceTicketId}
              onChange={(e) => setInvoiceTicketId(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
            >
              <option value="">-- Choose Ticket --</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ticket_number} - {t.customer_first_name} {t.customer_last_name} ({t.status})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            Invoice will automatically populate line items from installed parts & approved labour estimates.
          </p>
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateInvoiceModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
              Create Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Collect Customer Payment Modal */}
      <Modal isOpen={recordPaymentModalOpen} onClose={() => setRecordPaymentModalOpen(false)} title="Record Customer Payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Payment Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Payment Mode</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              >
                <option value="UPI">UPI / QR Code</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Transaction ID / Notes</label>
              <input
                type="text"
                placeholder="UPI ref or cash note"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setRecordPaymentModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors">
              Confirm Payment Receipt
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ReceptionistDashboard;
