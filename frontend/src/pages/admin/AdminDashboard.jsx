import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import Modal, { LoadingSpinner } from '../../components/common/Modal';
import { formatCurrency, formatDate, PRIORITY_CONFIG } from '../../utils/constants';

// Recharts imports for analytics
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Lucide React Icons
import {
  Users,
  Laptop,
  Ticket,
  Clock,
  Wrench,
  CheckCircle,
  UserCheck,
  AlertTriangle,
  IndianRupee,
  Plus,
  Edit,
  Trash2,
  Search,
  FileText,
  Boxes,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  ExternalLink,
  Zap
} from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Data states from MySQL queries
  const [metrics, setMetrics] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Search & filter states
  const [customerSearch, setCustomerSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');

  // Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // Restock Modal State
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [restockQty, setRestockQty] = useState(5);
  const [restockCost, setRestockCost] = useState('');

  // Add Spare Part Modal State
  const [addPartModalOpen, setAddPartModalOpen] = useState(false);
  const [partForm, setPartForm] = useState({
    partName: '',
    partNumber: '',
    category: 'RAM',
    costPrice: '',
    sellingPrice: '',
    quantityInStock: 10,
    reorderThreshold: 3,
    locationBin: 'Bin-A1',
    supplierId: 1
  });

  // Add Technician Modal State
  const [addTechModalOpen, setAddTechModalOpen] = useState(false);
  const [techForm, setTechForm] = useState({
    username: '',
    email: '',
    password: 'Password@123',
    firstName: '',
    lastName: '',
    phone: '',
    employeeCode: '',
    specialization: 'Laptop Motherboard & Component Level Repair',
    experienceYears: 3,
    maxActiveTickets: 6
  });

  // Edit Technician Modal State
  const [editTechModalOpen, setEditTechModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState(null);

  // Add Customer Modal State
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    notes: ''
  });

  // Customer History Modal State
  const [customerHistoryModalOpen, setCustomerHistoryModalOpen] = useState(false);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, ticketsRes, inventoryRes, techRes, invoicesRes, custRes, usersRes] = await Promise.all([
        api.get('/analytics/dashboard').catch(() => ({ data: { success: false } })),
        api.get('/service-requests?limit=50').catch(() => ({ data: { success: false } })),
        api.get('/inventory?limit=50').catch(() => ({ data: { success: false } })),
        api.get('/technicians').catch(() => ({ data: { success: false } })),
        api.get('/billing/invoices?limit=50').catch(() => ({ data: { success: false } })),
        api.get('/customers?limit=50').catch(() => ({ data: { success: false } })),
        api.get('/auth/users?limit=50').catch(() => ({ data: { success: false } }))
      ]);

      if (metricsRes.data.success) setMetrics(metricsRes.data.data);
      if (ticketsRes.data.success) setTickets(ticketsRes.data.data.requests);
      if (inventoryRes.data.success) setInventory(inventoryRes.data.data.parts);
      if (techRes.data.success) setTechnicians(techRes.data.data.technicians);
      if (invoicesRes.data.success) setInvoices(invoicesRes.data.data.invoices);
      if (custRes.data.success) setCustomers(custRes.data.data.customers);
      if (usersRes.data.success) setUsersList(usersRes.data.data.users);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await api.post('/technicians/assign', {
        serviceRequestId: selectedTicket.id,
        technicianId: selectedTechId,
        notes: assignNotes
      });
      setAssignModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Assignment failed');
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/inventory/${selectedPart.id}/restock`, {
        quantity: restockQty,
        unitCost: restockCost || selectedPart.cost_price,
        notes: 'Admin procurement restocking'
      });
      setRestockModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Restock failed');
    }
  };

  const handleCreatePart = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory', {
        ...partForm,
        costPrice: parseFloat(partForm.costPrice),
        sellingPrice: parseFloat(partForm.sellingPrice),
        quantityInStock: parseInt(partForm.quantityInStock, 10),
        reorderThreshold: parseInt(partForm.reorderThreshold, 10),
        supplierId: parseInt(partForm.supplierId, 10) || 1
      });
      setAddPartModalOpen(false);
      setPartForm({
        partName: '',
        partNumber: '',
        category: 'RAM',
        costPrice: '',
        sellingPrice: '',
        quantityInStock: 10,
        reorderThreshold: 3,
        locationBin: 'Bin-A1',
        supplierId: 1
      });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add spare part to inventory');
    }
  };

  const handleAutoAssignLoadBalancer = async (ticket) => {
    try {
      const res = await api.post('/technicians/assign', {
        serviceRequestId: ticket.id,
        technicianId: 'auto',
        notes: 'Auto-assigned by Workload Load Balancer.'
      });
      alert(res.data?.message || 'Ticket successfully assigned via Load Balancer!');
      setAssignModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Load Balancer failed to auto-assign ticket.');
    }
  };

  const handleCreateTechnician = async (e) => {
    e.preventDefault();
    try {
      await api.post('/technicians', techForm);
      setAddTechModalOpen(false);
      setTechForm({
        username: '',
        email: '',
        password: 'Password@123',
        firstName: '',
        lastName: '',
        phone: '',
        employeeCode: '',
        specialization: 'Laptop Motherboard & Component Level Repair',
        experienceYears: 3,
        maxActiveTickets: 6
      });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create technician');
    }
  };

  const handleUpdateTechnician = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/technicians/${editingTech.id}`, editingTech);
      setEditTechModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update technician');
    }
  };

  const handleDeactivateTechnician = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate technician "${name}"?`)) return;
    try {
      await api.delete(`/technicians/${id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate technician');
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', customerForm);
      setAddCustomerModalOpen(false);
      setCustomerForm({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        address: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        notes: ''
      });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create customer');
    }
  };

  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name}"?`)) return;
    try {
      await api.delete(`/customers/${id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Cannot delete customer with existing service history.');
    }
  };

  const handleViewCustomerHistory = async (customer) => {
    try {
      const [histRes, devRes] = await Promise.all([
        api.get(`/customers/${customer.id}/history`),
        api.get(`/customers/${customer.id}/devices`)
      ]);
      setSelectedCustomerHistory({
        customer,
        history: histRes.data.data.history || [],
        devices: devRes.data.data.devices || []
      });
      setCustomerHistoryModalOpen(true);
    } catch (err) {
      alert('Failed to load customer profile');
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      await api.patch(`/auth/users/${user.id}/toggle-status`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle user status');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.ticket_number?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.customer_first_name?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.customer_phone?.includes(ticketSearch);
    const matchesStatus = ticketStatusFilter ? t.status === ticketStatusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {loading ? (
            <LoadingSpinner text="Compiling executive service metrics from MySQL..." />
          ) : (
            <div>
              {/* TAB 1: EXECUTIVE OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Executive Dashboard</h2>
                      <p className="text-sm text-slate-500">Live operational snapshot & MySQL performance metrics</p>
                    </div>
                    <button
                      onClick={loadData}
                      className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Metrics</span>
                    </button>
                  </div>

                  {/* Top Metric Cards - All 9 Core MySQL Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <StatCard
                      title="Total Revenue"
                      value={formatCurrency(metrics?.financials?.total_revenue_collected || 0)}
                      icon={IndianRupee}
                      color="emerald"
                      subtitle={`Invoiced: ${formatCurrency(metrics?.financials?.total_invoiced || 0)}`}
                    />
                    <StatCard
                      title="Total Customers"
                      value={metrics?.stats?.total_customers || 0}
                      icon={Users}
                      color="blue"
                      subtitle="Registered & walk-in clients"
                    />
                    <StatCard
                      title="Total Devices"
                      value={metrics?.stats?.total_devices || 0}
                      icon={Laptop}
                      color="purple"
                      subtitle="Laptops, PCs, printers, etc."
                    />
                    <StatCard
                      title="Total Service Requests"
                      value={metrics?.stats?.total_requests || 0}
                      icon={Ticket}
                      color="indigo"
                      subtitle="Lifetime repair tickets"
                    />
                    <StatCard
                      title="Pending Repairs"
                      value={metrics?.stats?.pending_repairs || 0}
                      icon={Clock}
                      color="amber"
                      subtitle="Jobs in active pipeline"
                    />
                    <StatCard
                      title="In-Progress Repairs"
                      value={metrics?.stats?.in_progress_repairs || 0}
                      icon={Wrench}
                      color="blue"
                      subtitle="On technician workbenches"
                    />
                    <StatCard
                      title="Completed Repairs"
                      value={metrics?.stats?.completed_repairs || 0}
                      icon={CheckCircle}
                      color="emerald"
                      subtitle="Successfully delivered"
                    />
                    <StatCard
                      title="Available Technicians"
                      value={metrics?.stats?.available_technicians || 0}
                      icon={UserCheck}
                      color="emerald"
                      subtitle={`Active: ${metrics?.stats?.active_technicians || 0} staff`}
                    />
                    <StatCard
                      title="Low Stock Spare Parts"
                      value={metrics?.stats?.low_stock_items || 0}
                      icon={AlertTriangle}
                      color="rose"
                      subtitle="At or below reorder threshold"
                    />
                  </div>

                  {/* Middle Charts & Analytics Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Monthly Revenue Chart via Recharts */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                            <span>Monthly Financial Performance</span>
                          </h3>
                          <p className="text-xs text-slate-500">Invoiced billing vs collected payments over recent months</p>
                        </div>
                      </div>

                      <div className="h-64 w-full">
                        {metrics?.revenueChart && metrics.revenueChart.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.revenueChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="month_label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <Tooltip
                                formatter={(value) => [formatCurrency(value), '']}
                                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                              <Bar dataKey="total_invoiced" fill="#93c5fd" name="Invoiced Amount" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="total_collected" fill="#10b981" name="Collected Revenue" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-slate-400">
                            No monthly billing data recorded yet.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technician Performance Ranking */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-base text-slate-900 mb-1">Technician Workload Ranking</h3>
                      <p className="text-xs text-slate-500 mb-4">Active and completed tickets by technician</p>

                      <div className="space-y-3">
                        {metrics?.technicianRanking && metrics.technicianRanking.length > 0 ? (
                          metrics.technicianRanking.map((t, i) => (
                            <div key={i} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                              <div>
                                <p className="font-bold text-sm text-slate-800">{t.first_name} {t.last_name}</p>
                                <p className="text-xs text-slate-400 font-mono">{t.employee_code} • {t.specialization}</p>
                              </div>
                              <div className="text-right">
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                  {t.completed_tickets} Done
                                </span>
                                <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">{t.active_tickets} Active</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 py-4 text-center">No technician activity recorded.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Tables: Recent Service Requests & Recent Payments */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Service Requests */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-base text-slate-900">Recent Service Requests</h3>
                        <button
                          onClick={() => setActiveTab('tickets')}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          View All ({tickets.length})
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Ticket</th>
                              <th className="py-2.5 px-3">Customer</th>
                              <th className="py-2.5 px-3">Device</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metrics?.recentRequests && metrics.recentRequests.length > 0 ? (
                              metrics.recentRequests.map((req) => (
                                <tr key={req.id} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{req.ticket_number}</td>
                                  <td className="py-2.5 px-3 font-medium text-slate-800">{req.customer_first_name} {req.customer_last_name}</td>
                                  <td className="py-2.5 px-3">{req.brand} {req.model}</td>
                                  <td className="py-2.5 px-3">
                                    <StatusBadge status={req.status} />
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="4" className="py-4 text-center text-slate-400">No recent tickets</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Recent Payments */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-base text-slate-900">Recent Payments</h3>
                        <button
                          onClick={() => setActiveTab('invoices')}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          View All Invoices
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Reference</th>
                              <th className="py-2.5 px-3">Customer</th>
                              <th className="py-2.5 px-3">Method</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metrics?.recentPayments && metrics.recentPayments.length > 0 ? (
                              metrics.recentPayments.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-3 font-mono font-medium text-slate-700">{p.payment_reference}</td>
                                  <td className="py-2.5 px-3 font-medium text-slate-800">{p.customer_first_name} {p.customer_last_name}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px]">{p.payment_method}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="4" className="py-4 text-center text-slate-400">No payment transactions recorded</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SERVICE REQUESTS DIRECTORY */}
              {activeTab === 'tickets' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Service Requests Directory</h2>
                      <p className="text-sm text-slate-500">Monitor repair progression, assign technicians & track 10-state lifecycle</p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Search ticket, customer, phone..."
                          value={ticketSearch}
                          onChange={(e) => setTicketSearch(e.target.value)}
                          className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <select
                        value={ticketStatusFilter}
                        onChange={(e) => setTicketStatusFilter(e.target.value)}
                        className="py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="RECEIVED">RECEIVED</option>
                        <option value="UNDER_DIAGNOSIS">UNDER_DIAGNOSIS</option>
                        <option value="WAITING_FOR_CUSTOMER_APPROVAL">WAITING_FOR_CUSTOMER_APPROVAL</option>
                        <option value="WAITING_FOR_SPARE_PARTS">WAITING_FOR_SPARE_PARTS</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="QUALITY_CHECK">QUALITY_CHECK</option>
                        <option value="READY_FOR_DELIVERY">READY_FOR_DELIVERY</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                        <option value="UNREPAIRABLE">UNREPAIRABLE</option>
                      </select>
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
                          <th className="py-3.5 px-4">Technician</th>
                          <th className="py-3.5 px-4">Cost Est.</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
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
                              <span className="text-xs text-slate-400 block">{t.device_type} • SN: {t.serial_number}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${PRIORITY_CONFIG[t.priority]?.badgeClass}`}>
                                {t.priority}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <StatusBadge status={t.status} />
                            </td>
                            <td className="py-3.5 px-4">
                              {t.tech_first_name ? (
                                <span className="text-slate-800 font-medium">
                                  {t.tech_first_name} {t.tech_last_name}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">{formatCurrency(t.estimated_cost)}</td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              {!t.tech_first_name && (
                                <button
                                  type="button"
                                  onClick={() => handleAutoAssignLoadBalancer(t)}
                                  title="Auto-Assign using Workload Load Balancer"
                                  className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                                >
                                  ⚡ Auto-Balance
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedTicket(t);
                                  setSelectedTechId(t.current_technician_id || '');
                                  setAssignModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                {t.current_technician_id ? 'Reassign' : 'Assign'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: SPARE PARTS INVENTORY */}
              {activeTab === 'inventory' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Spare Parts Inventory</h2>
                      <p className="text-sm text-slate-500">Hardware components, reorder thresholds & procurement restock (Module 8)</p>
                    </div>
                    <button
                      onClick={() => setAddPartModalOpen(true)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Spare Part</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                        <tr>
                          <th className="py-3.5 px-4">Part / SKU</th>
                          <th className="py-3.5 px-4">Category</th>
                          <th className="py-3.5 px-4">Stock Level</th>
                          <th className="py-3.5 px-4">Cost Price</th>
                          <th className="py-3.5 px-4">Selling Price</th>
                          <th className="py-3.5 px-4">Bin Location</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-900">{item.part_name}</p>
                              <p className="text-xs text-slate-400 font-mono">{item.part_number}</p>
                            </td>
                            <td className="py-3.5 px-4 font-medium">{item.category}</td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                item.quantity_in_stock <= item.reorder_threshold
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                <span>{item.quantity_in_stock} Units</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4">{formatCurrency(item.cost_price)}</td>
                            <td className="py-3.5 px-4 font-semibold text-emerald-600">{formatCurrency(item.selling_price)}</td>
                            <td className="py-3.5 px-4 font-mono text-xs">{item.location_bin || 'Bin-A1'}</td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedPart(item);
                                  setRestockCost(item.cost_price);
                                  setRestockModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Restock
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: TECHNICIAN WORKLOAD & MANAGEMENT */}
              {activeTab === 'technicians' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Technician Capacity & Roster</h2>
                      <p className="text-sm text-slate-500">Monitor workload limits, track availability & manage employee staff (Module 6)</p>
                    </div>
                    <button
                      onClick={() => setAddTechModalOpen(true)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add New Technician</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {technicians.map((tech) => {
                      const percentage = Math.round((tech.active_ticket_count / tech.max_active_tickets) * 100);
                      return (
                        <div key={tech.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                              <UserCheck className="w-6 h-6 text-blue-600" />
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              tech.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {tech.status}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-bold text-base text-slate-900">{tech.first_name} {tech.last_name}</h3>
                            <p className="text-xs text-slate-400 font-mono">{tech.employee_code} • {tech.email}</p>
                            <p className="text-xs text-slate-600 mt-1 font-medium">{tech.specialization}</p>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span>Workload Guardrail</span>
                              <span>{tech.active_ticket_count} / {tech.max_active_tickets} Max Tickets</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percentage >= 90 ? 'bg-rose-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span>Experience: {tech.experience_years} years</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingTech({ ...tech });
                                  setEditTechModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Technician"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeactivateTechnician(tech.id, `${tech.first_name} ${tech.last_name}`)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Deactivate Technician"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: BILLING & INVOICES */}
              {activeTab === 'invoices' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Billing & Payment Statements</h2>
                    <p className="text-sm text-slate-500">Tax invoices, partial payments & downloadable statements (Module 9)</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                        <tr>
                          <th className="py-3.5 px-4">Invoice #</th>
                          <th className="py-3.5 px-4">Ticket</th>
                          <th className="py-3.5 px-4">Customer</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4">Total</th>
                          <th className="py-3.5 px-4">Paid</th>
                          <th className="py-3.5 px-4">Balance</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Invoice Document</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{inv.invoice_number}</td>
                            <td className="py-3.5 px-4 font-mono text-xs">{inv.ticket_number}</td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">{inv.customer_first_name} {inv.customer_last_name}</td>
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
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5"
                                >
                                  <FileText className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Print / PDF</span>
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

              {/* TAB 6: CUSTOMER REGISTRY */}
              {activeTab === 'customers' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Customer Registry</h2>
                      <p className="text-sm text-slate-500">Manage client profiles, contact information, registered devices & service history (Module 3)</p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Search customer, phone, email..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => setAddCustomerModalOpen(true)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Customer</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                        <tr>
                          <th className="py-3.5 px-4">Name</th>
                          <th className="py-3.5 px-4">Primary Phone</th>
                          <th className="py-3.5 px-4">Email</th>
                          <th className="py-3.5 px-4">Location</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCustomers.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              {c.first_name} {c.last_name}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{c.phone}</td>
                            <td className="py-3.5 px-4 text-slate-600">{c.email || 'N/A'}</td>
                            <td className="py-3.5 px-4 text-slate-600">{c.city || 'Bengaluru'}, {c.state || 'Karnataka'}</td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => handleViewCustomerHistory(c)}
                                className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                History & Devices
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(c.id, `${c.first_name} ${c.last_name}`)}
                                className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: USER MANAGEMENT */}
              {activeTab === 'users' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">User & Employee Access Management</h2>
                      <p className="text-sm text-slate-500">Account status, role-based access control & activation toggling (Module 1)</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                        <tr>
                          <th className="py-3.5 px-4">User</th>
                          <th className="py-3.5 px-4">Role</th>
                          <th className="py-3.5 px-4">Email / Phone</th>
                          <th className="py-3.5 px-4">Account Status</th>
                          <th className="py-3.5 px-4">Created Date</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersList.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <p>{u.first_name} {u.last_name}</p>
                              <p className="text-xs text-slate-400 font-mono font-normal">@{u.username}</p>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <p className="text-slate-800">{u.email}</p>
                              <p className="text-slate-400">{u.phone}</p>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs">{formatDate(u.created_at)}</td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                  u.is_active
                                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                                }`}
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Technician Assignment Modal */}
      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title={`Assign Ticket ${selectedTicket?.ticket_number}`}>
        <form onSubmit={handleAssign} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900">Workload Load Balancer</p>
                <p className="text-[11px] text-amber-700">Auto-routes to least loaded available technician</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleAutoAssignLoadBalancer(selectedTicket)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
            >
              <Zap className="w-3.5 h-3.5" /> Auto-Assign
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Select Available Technician</label>
            <select
              required
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            >
              <option value="">-- Choose Technician --</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name} ({t.employee_code}) - {t.active_ticket_count}/{t.max_active_tickets} Active
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Assignment Instructions</label>
            <textarea
              rows="3"
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="E.g., Prioritize SSD replacement and BIOS update"
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            ></textarea>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Confirm Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* Restock Inventory Modal */}
      <Modal isOpen={restockModalOpen} onClose={() => setRestockModalOpen(false)} title={`Restock ${selectedPart?.part_name}`}>
        <form onSubmit={handleRestock} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Quantity to Add</label>
              <input
                type="number"
                min="1"
                required
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Unit Purchase Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={restockCost}
                onChange={(e) => setRestockCost(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setRestockModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Record Restock In Inventory
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Technician Modal */}
      <Modal isOpen={addTechModalOpen} onClose={() => setAddTechModalOpen(false)} title="Add New Technician Employee">
        <form onSubmit={handleCreateTechnician} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">First Name</label>
              <input
                type="text"
                required
                value={techForm.firstName}
                onChange={(e) => setTechForm({ ...techForm, firstName: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Last Name</label>
              <input
                type="text"
                required
                value={techForm.lastName}
                onChange={(e) => setTechForm({ ...techForm, lastName: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Username</label>
              <input
                type="text"
                required
                value={techForm.username}
                onChange={(e) => setTechForm({ ...techForm, username: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Employee Code</label>
              <input
                type="text"
                required
                placeholder="TECH-002"
                value={techForm.employeeCode}
                onChange={(e) => setTechForm({ ...techForm, employeeCode: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Email</label>
              <input
                type="email"
                required
                value={techForm.email}
                onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Phone</label>
              <input
                type="text"
                required
                value={techForm.phone}
                onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Specialization</label>
            <input
              type="text"
              required
              value={techForm.specialization}
              onChange={(e) => setTechForm({ ...techForm, specialization: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Experience (Years)</label>
              <input
                type="number"
                min="0"
                value={techForm.experienceYears}
                onChange={(e) => setTechForm({ ...techForm, experienceYears: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Max Active Tickets</label>
              <input
                type="number"
                min="1"
                max="15"
                value={techForm.maxActiveTickets}
                onChange={(e) => setTechForm({ ...techForm, maxActiveTickets: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddTechModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Create Technician Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Technician Modal */}
      <Modal isOpen={editTechModalOpen} onClose={() => setEditTechModalOpen(false)} title={`Edit ${editingTech?.first_name} ${editingTech?.last_name}`}>
        {editingTech && (
          <form onSubmit={handleUpdateTechnician} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Specialization</label>
              <input
                type="text"
                required
                value={editingTech.specialization}
                onChange={(e) => setEditingTech({ ...editingTech, specialization: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Experience (Years)</label>
                <input
                  type="number"
                  min="0"
                  value={editingTech.experience_years}
                  onChange={(e) => setEditingTech({ ...editingTech, experience_years: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">Max Active Tickets</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={editingTech.max_active_tickets}
                  onChange={(e) => setEditingTech({ ...editingTech, max_active_tickets: e.target.value })}
                  className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Availability Status</label>
              <select
                value={editingTech.status}
                onChange={(e) => setEditingTech({ ...editingTech, status: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="BUSY">BUSY</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditTechModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
                Update Technician Parameters
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Customer Modal */}
      <Modal isOpen={addCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} title="Register Customer">
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">First Name</label>
              <input
                type="text"
                required
                value={customerForm.firstName}
                onChange={(e) => setCustomerForm({ ...customerForm, firstName: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Last Name</label>
              <input
                type="text"
                required
                value={customerForm.lastName}
                onChange={(e) => setCustomerForm({ ...customerForm, lastName: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Phone Number</label>
              <input
                type="text"
                required
                placeholder="10-digit mobile"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Email</label>
              <input
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Address</label>
            <textarea
              rows="2"
              value={customerForm.address}
              onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddCustomerModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Save Customer Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Devices & Service History Modal */}
      <Modal
        isOpen={customerHistoryModalOpen}
        onClose={() => setCustomerHistoryModalOpen(false)}
        title={`Profile: ${selectedCustomerHistory?.customer?.first_name} ${selectedCustomerHistory?.customer?.last_name}`}
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase text-slate-700 mb-2">Registered Devices</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedCustomerHistory?.devices?.length > 0 ? (
                selectedCustomerHistory.devices.map((d) => (
                  <div key={d.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <p className="font-bold text-slate-800">{d.brand} {d.model} ({d.device_type})</p>
                    <p className="text-slate-500 font-mono">SN: {d.serial_number} • Total Repairs: {d.service_count}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No devices registered yet.</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-slate-700 mb-2">Service History</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedCustomerHistory?.history?.length > 0 ? (
                selectedCustomerHistory.history.map((h) => (
                  <div key={h.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-blue-600">{h.ticket_number}</p>
                      <p className="text-slate-700">{h.reported_issue}</p>
                      <p className="text-slate-400">{formatDate(h.created_at)}</p>
                    </div>
                    <StatusBadge status={h.status} />
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No previous service tickets recorded.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setCustomerHistoryModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Add New Spare Part Modal */}
      <Modal isOpen={addPartModalOpen} onClose={() => setAddPartModalOpen(false)} title="Add New Spare Part to Inventory">
        <form onSubmit={handleCreatePart} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Part Name</label>
              <input
                type="text"
                required
                placeholder="E.g., Kingston 16GB DDR4 3200MHz RAM"
                value={partForm.partName}
                onChange={(e) => setPartForm({ ...partForm, partName: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Part Number / SKU</label>
              <input
                type="text"
                required
                placeholder="E.g., RAM-DDR4-16G-01"
                value={partForm.partNumber}
                onChange={(e) => setPartForm({ ...partForm, partNumber: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Category</label>
              <select
                value={partForm.category}
                onChange={(e) => setPartForm({ ...partForm, category: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              >
                <option value="RAM">RAM / Memory</option>
                <option value="Storage">Storage / SSD / HDD</option>
                <option value="Display">Display / Screen</option>
                <option value="Battery">Battery</option>
                <option value="Motherboard">Motherboard / Chipset</option>
                <option value="Power">Power Adapter / DC Jack</option>
                <option value="Cooling">Thermal / Cooling Fan</option>
                <option value="Keyboard">Keyboard / Trackpad</option>
                <option value="Other">Other Component</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Storage Bin / Location</label>
              <input
                type="text"
                value={partForm.locationBin}
                onChange={(e) => setPartForm({ ...partForm, locationBin: e.target.value })}
                placeholder="E.g., Bin-B3"
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Purchase Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="1500"
                value={partForm.costPrice}
                onChange={(e) => setPartForm({ ...partForm, costPrice: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Customer Selling Price (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="2200"
                value={partForm.sellingPrice}
                onChange={(e) => setPartForm({ ...partForm, sellingPrice: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Initial Stock Quantity</label>
              <input
                type="number"
                min="0"
                required
                value={partForm.quantityInStock}
                onChange={(e) => setPartForm({ ...partForm, quantityInStock: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Low Stock Reorder Alert Threshold</label>
              <input
                type="number"
                min="1"
                required
                value={partForm.reorderThreshold}
                onChange={(e) => setPartForm({ ...partForm, reorderThreshold: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddPartModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
              Save Part to Inventory
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
