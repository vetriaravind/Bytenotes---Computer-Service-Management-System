/**
 * Global Constants & Formatters for ByteNotes Frontend
 */

export const STATUS_CONFIG = {
  RECEIVED: { label: 'Received', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  UNDER_DIAGNOSIS: { label: 'Under Diagnosis', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  WAITING_FOR_CUSTOMER_APPROVAL: { label: 'Waiting for Approval', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  WAITING_FOR_SPARE_PARTS: { label: 'Waiting for Parts', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  QUALITY_CHECK: { label: 'Quality Check', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300' },
  READY_FOR_DELIVERY: { label: 'Ready for Collection', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  DELIVERED: { label: 'Delivered', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
  UNREPAIRABLE: { label: 'Unrepairable', bg: 'bg-gray-200', text: 'text-gray-800', border: 'border-gray-400' }
};

export const PRIORITY_CONFIG = {
  LOW: { label: 'Low', badge: 'bg-slate-100 text-slate-600' },
  MEDIUM: { label: 'Medium', badge: 'bg-blue-100 text-blue-700' },
  HIGH: { label: 'High', badge: 'bg-orange-100 text-orange-700 font-semibold' },
  URGENT: { label: 'Urgent', badge: 'bg-rose-100 text-rose-700 font-bold animate-pulse' }
};

export const COMMON_SERVICES_CATALOG = [
  { id: 'ram', name: 'RAM Service / Upgrade', price: 2000, keywords: ['ram', 'memory'] },
  { id: 'screen', name: 'Screen / Display Replacement', price: 3500, keywords: ['screen', 'display', 'panel', 'flicker', 'cracked'] },
  { id: 'ssd', name: 'SSD / Hard Drive Storage Upgrade', price: 2500, keywords: ['ssd', 'storage', 'hard drive', 'hdd', 'boot'] },
  { id: 'motherboard', name: 'Motherboard Chip-Level Repair', price: 4500, keywords: ['motherboard', 'chip', 'ic', 'short', 'no power', 'dead'] },
  { id: 'battery', name: 'Battery Replacement', price: 2200, keywords: ['battery', 'backup', 'drain', 'swollen'] },
  { id: 'liquid', name: 'Liquid / Water Damage Treatment', price: 1800, keywords: ['water', 'liquid', 'spill', 'corrosion'] },
  { id: 'os', name: 'OS Installation & System Optimization', price: 800, keywords: ['os', 'windows', 'format', 'virus', 'slow', 'software'] },
  { id: 'charging', name: 'Charging Port & Power Jack Repair', price: 1200, keywords: ['charging', 'charger', 'port', 'dc jack', 'pin'] },
  { id: 'thermal', name: 'Thermal Paste & Fan Overhaul', price: 900, keywords: ['heat', 'heating', 'fan', 'thermal', 'overheating'] },
  { id: 'keyboard', name: 'Keyboard Replacement', price: 1400, keywords: ['keyboard', 'keys', 'typing', 'spacebar'] },
  { id: 'diagnostics', name: 'General Hardware Diagnostic Checkup', price: 500, keywords: ['checkup', 'inspection', 'diagnosis'] }
];

export const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};
