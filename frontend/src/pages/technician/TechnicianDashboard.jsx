import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import StatusBadge from '../../components/common/StatusBadge';
import Modal, { LoadingSpinner } from '../../components/common/Modal';
import { formatCurrency, formatDate, PRIORITY_CONFIG } from '../../utils/constants';

import {
  Wrench,
  Stethoscope,
  Cpu,
  Check,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Boxes,
  Plus
} from 'lucide-react';

export const TechnicianDashboard = () => {
  const [activeTab, setActiveTab] = useState('workbench');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [inventory, setInventory] = useState([]);

  // Selected Active Job for Diagnosis / Status Transition / Parts Requisition
  const [selectedJob, setSelectedJob] = useState(null);

  // Diagnosis Modal State
  const [diagModalOpen, setDiagModalOpen] = useState(false);
  const [diagForm, setDiagForm] = useState({
    findings: '',
    rootCause: '',
    recommendedAction: '',
    estimatedHours: '1.5',
    estimatedLabourCost: '600'
  });

  // Consume Spare Part Modal State (Scenario 8)
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [partNotes, setPartNotes] = useState('');

  // Status Transition Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [unrepairableReason, setUnrepairableReason] = useState('');

  // Reject Assignment Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectAssignmentId, setRejectAssignmentId] = useState(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  const loadWorkbench = async () => {
    setLoading(true);
    try {
      const [workbenchRes, inventoryRes] = await Promise.all([
        api.get('/technicians/my-workbench').catch(() => ({ data: { success: false } })),
        api.get('/inventory?limit=50').catch(() => ({ data: { success: false } }))
      ]);

      if (workbenchRes.data.success) setJobs(workbenchRes.data.data.jobs);
      if (inventoryRes.data.success) setInventory(inventoryRes.data.data.parts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkbench();
  }, []);

  const handleAcceptAssignment = async (assignmentId) => {
    try {
      await api.post('/technicians/respond-assignment', {
        assignmentId,
        responseStatus: 'ACCEPTED',
        technicianNotes: 'Workbench job accepted. Commencing hardware diagnostic tests.'
      });
      loadWorkbench();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const handleRejectAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/technicians/respond-assignment', {
        assignmentId: rejectAssignmentId,
        responseStatus: 'REJECTED',
        rejectionReason: rejectionReasonText
      });
      alert('Assignment rejected. Notification sent to Admin for reassignment.');
      setRejectModalOpen(false);
      setRejectionReasonText('');
      loadWorkbench();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject assignment');
    }
  };

  const handleSaveDiagnosis = async (e) => {
    e.preventDefault();
    try {
      await api.post('/diagnosis', {
        serviceRequestId: selectedJob.request_id,
        ...diagForm
      });
      alert('Technical diagnosis report saved successfully!');
      setDiagModalOpen(false);
      loadWorkbench();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save diagnosis');
    }
  };

  const handleConsumePart = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/consume', {
        serviceRequestId: selectedJob.request_id,
        inventoryId: selectedPartId,
        quantity: partQty,
        notes: partNotes
      });
      alert('Spare part installed! Inventory automatically deducted from stock.');
      setPartModalOpen(false);
      loadWorkbench();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to consume spare part');
    }
  };

  const handleStatusTransition = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/technicians/update-status', {
        serviceRequestId: selectedJob.request_id,
        targetStatus,
        remarks: statusRemarks,
        unrepairableReason: targetStatus === 'UNREPAIRABLE' ? unrepairableReason : null
      });
      setStatusModalOpen(false);
      loadWorkbench();
    } catch (err) {
      alert(err.response?.data?.message || 'Status transition rejected by state machine.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* TAB 1: WORKBENCH QUEUE */}
          {activeTab === 'workbench' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Technician Workbench Queue</h2>
                  <p className="text-sm text-slate-500">Live assigned hardware repairs, technical diagnostics & repair progression</p>
                </div>
                <span className="px-3.5 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-200">
                  {jobs.length} Active Assigned Jobs
                </span>
              </div>

              {loading ? (
                <LoadingSpinner text="Retrieving technician assigned jobs..." />
              ) : jobs.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">Your workbench queue is clear!</h3>
                  <p className="text-sm text-slate-500 mt-1">No pending repair jobs currently assigned to your bench.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {jobs.map((job) => (
                    <div key={job.assignment_id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-blue-600 text-lg">{job.ticket_number}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_CONFIG[job.priority]?.badgeClass}`}>
                              {job.priority}
                            </span>
                            <StatusBadge status={job.request_status} />
                          </div>
                          <h3 className="font-bold text-slate-900 text-base mt-1">
                            {job.brand} {job.model} <span className="font-mono text-xs text-slate-400 font-normal">({job.serial_number})</span>
                          </h3>
                          <p className="text-xs text-slate-500">
                            Customer: <strong>{job.customer_first_name} {job.customer_last_name}</strong> ({job.customer_phone})
                          </p>
                        </div>

                        <div>
                          {job.assignment_status === 'ASSIGNED' ? (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleAcceptAssignment(job.assignment_id)}
                                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accept Job</span>
                              </button>
                              <button
                                onClick={() => {
                                  setRejectAssignmentId(job.assignment_id);
                                  setRejectModalOpen(true);
                                }}
                                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                              Accepted & Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Problem Description & Intake Notes */}
                      <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-1 border border-slate-100">
                        <p><strong className="text-slate-800">Reported Problem:</strong> {job.reported_issue}</p>
                        <p><strong className="text-slate-800">Physical Condition:</strong> {job.physical_condition || 'Standard wear'}</p>
                        {job.password_pin && (
                          <p className="font-mono text-blue-700">
                            <strong>Unlock PIN / Password:</strong> {job.password_pin}
                          </p>
                        )}
                        <p className="text-slate-400">Intake Date: {formatDate(job.intake_date)} | Expected Delivery: {formatDate(job.expected_delivery_date) || 'TBD'}</p>
                      </div>

                      {/* Technician Actions */}
                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setDiagModalOpen(true);
                          }}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Add Diagnosis Report</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setPartModalOpen(true);
                          }}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          <span>Install Spare Part</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setTargetStatus(job.request_status);
                            setStatusModalOpen(true);
                          }}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Update Repair Status</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIAGNOSTICS & REPORTS */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Technical Diagnostics & Findings</h2>
                <p className="text-sm text-slate-500">Record hardware test findings, root-cause analysis & labour hours</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <div key={job.assignment_id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-blue-600">{job.ticket_number}</span>
                      <StatusBadge status={job.request_status} />
                    </div>
                    <p className="font-bold text-slate-900">{job.brand} {job.model}</p>
                    <p className="text-xs text-slate-600">Issue: {job.reported_issue}</p>
                    <button
                      onClick={() => {
                        setSelectedJob(job);
                        setDiagModalOpen(true);
                      }}
                      className="w-full py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Open Diagnostic Form
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SPARE PARTS REQUISITION */}
          {activeTab === 'parts' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Spare Parts Catalog & Requisition</h2>
                <p className="text-sm text-slate-500">Available hardware components in stock for repair installation</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4">Component</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Available Stock</th>
                      <th className="py-3.5 px-4">Bin Location</th>
                      <th className="py-3.5 px-4 text-right">Selling Price</th>
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
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            item.quantity_in_stock <= item.reorder_threshold ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.quantity_in_stock} in stock
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs">{item.location_bin || 'Bin-A1'}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">{formatCurrency(item.selling_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Reject Assignment Modal */}
      <Modal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Reject Service Assignment">
        <form onSubmit={handleRejectAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Reason for Assignment Rejection *</label>
            <textarea
              rows="3"
              required
              placeholder="E.g., Component out of personal specialization, over capacity on urgent boards, or on scheduled leave"
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            ></textarea>
          </div>
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors">
              Confirm Rejection & Reassign Ticket
            </button>
          </div>
        </form>
      </Modal>

      {/* Diagnosis Modal */}
      <Modal isOpen={diagModalOpen} onClose={() => setDiagModalOpen(false)} title={`Technical Diagnosis - ${selectedJob?.ticket_number}`}>
        <form onSubmit={handleSaveDiagnosis} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Hardware Findings *</label>
            <textarea
              rows="2"
              required
              placeholder="E.g., Motherboard 3.3V rail shorted; swollen capacitor on power delivery stage"
              value={diagForm.findings}
              onChange={(e) => setDiagForm({ ...diagForm, findings: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Root Cause *</label>
            <input
              type="text"
              required
              placeholder="E.g., Voltage surge from non-genuine adapter"
              value={diagForm.rootCause}
              onChange={(e) => setDiagForm({ ...diagForm, rootCause: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Recommended Action *</label>
            <input
              type="text"
              required
              placeholder="E.g., Micro-soldering Mosfet replacement & thermal paste re-application"
              value={diagForm.recommendedAction}
              onChange={(e) => setDiagForm({ ...diagForm, recommendedAction: e.target.value })}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Estimated Labour (Hours)</label>
              <input
                type="number"
                step="0.5"
                required
                value={diagForm.estimatedHours}
                onChange={(e) => setDiagForm({ ...diagForm, estimatedHours: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Estimated Labour Charge (₹)</label>
              <input
                type="number"
                required
                value={diagForm.estimatedLabourCost}
                onChange={(e) => setDiagForm({ ...diagForm, estimatedLabourCost: e.target.value })}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setDiagModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
              Save Diagnostic Report
            </button>
          </div>
        </form>
      </Modal>

      {/* Spare Part Consumption Modal */}
      <Modal isOpen={partModalOpen} onClose={() => setPartModalOpen(false)} title={`Install Spare Part - ${selectedJob?.ticket_number}`}>
        <form onSubmit={handleConsumePart} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Select Component from Stock</label>
            <select
              required
              value={selectedPartId}
              onChange={(e) => setSelectedPartId(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            >
              <option value="">-- Choose Spare Part --</option>
              {inventory.map((p) => (
                <option key={p.id} value={p.id} disabled={p.quantity_in_stock <= 0}>
                  {p.part_name} ({p.part_number}) - {p.quantity_in_stock} In Stock - ₹{p.selling_price}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Quantity Used</label>
              <input
                type="number"
                min="1"
                required
                value={partQty}
                onChange={(e) => setPartQty(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase">Installation Notes</label>
              <input
                type="text"
                placeholder="Installed in slot 1"
                value={partNotes}
                onChange={(e) => setPartNotes(e.target.value)}
                className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setPartModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors">
              Install Component & Deduct Inventory
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Transition Modal */}
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title={`Update Status - ${selectedJob?.ticket_number}`}>
        <form onSubmit={handleStatusTransition} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Target Repair Lifecycle State</label>
            <select
              required
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold"
            >
              <option value="UNDER_DIAGNOSIS">UNDER_DIAGNOSIS</option>
              <option value="WAITING_FOR_CUSTOMER_APPROVAL">WAITING_FOR_CUSTOMER_APPROVAL</option>
              <option value="WAITING_FOR_SPARE_PARTS">WAITING_FOR_SPARE_PARTS</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="QUALITY_CHECK">QUALITY_CHECK</option>
              <option value="READY_FOR_DELIVERY">READY_FOR_DELIVERY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="UNREPAIRABLE">UNREPAIRABLE (Fatal Hardware Damage)</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {targetStatus === 'UNREPAIRABLE' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-rose-800 uppercase">
                Mandatory Explanation: Why is this unit unrepairable? *
              </label>
              <textarea
                rows="2"
                required
                placeholder="E.g., Catastrophic multilayer PCB burnt layers with severed inner data traces."
                value={unrepairableReason}
                onChange={(e) => setUnrepairableReason(e.target.value)}
                className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs"
              ></textarea>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">Remarks & Progression Notes</label>
            <textarea
              rows="2"
              placeholder="E.g., Stress testing CPU/GPU at 100% load for 45 minutes; passed 3DMark test"
              value={statusRemarks}
              onChange={(e) => setStatusRemarks(e.target.value)}
              className="mt-1 w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            ></textarea>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
              Commit State Transition
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TechnicianDashboard;
