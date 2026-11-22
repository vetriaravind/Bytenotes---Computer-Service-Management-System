import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Ticket,
  Boxes,
  Users,
  UserCheck,
  FileText,
  Wrench,
  Stethoscope,
  Cpu,
  Laptop,
  CheckSquare,
  Receipt,
  Star,
  ShieldCheck,
  ShieldAlert,
  UserCog
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const role = user?.role;

  // Role-specific navigation tabs with Lucide Icons
  const getTabs = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
          { id: 'tickets', label: 'Service Requests', icon: Ticket },
          { id: 'inventory', label: 'Spare Parts & Stock', icon: Boxes },
          { id: 'technicians', label: 'Technicians Roster', icon: UserCheck },
          { id: 'invoices', label: 'Billing & Invoices', icon: Receipt },
          { id: 'customers', label: 'Customer Registry', icon: Users },
          { id: 'users', label: 'User Management', icon: UserCog }
        ];
      case 'RECEPTIONIST':
        return [
          { id: 'intake', label: 'New Device Intake', icon: Laptop },
          { id: 'customers', label: 'Customers Directory', icon: Users },
          { id: 'tickets', label: 'All Active Tickets', icon: Ticket },
          { id: 'estimates', label: 'Repair Estimates', icon: CheckSquare },
          { id: 'billing', label: 'Invoices & Payments', icon: Receipt }
        ];
      case 'TECHNICIAN':
        return [
          { id: 'workbench', label: 'My Workbench Queue', icon: Wrench },
          { id: 'diagnosis', label: 'Diagnostics & Reports', icon: Stethoscope },
          { id: 'parts', label: 'Spare Parts Requisition', icon: Cpu }
        ];
      case 'CUSTOMER':
        return [
          { id: 'my-tickets', label: 'My Repair Tickets', icon: Ticket },
          { id: 'devices', label: 'My Registered Devices', icon: Laptop },
          { id: 'new-request', label: 'New Service Request', icon: Wrench },
          { id: 'estimates', label: 'Estimates & Approvals', icon: CheckSquare },
          { id: 'invoices', label: 'Invoices & Payments', icon: Receipt },
          { id: 'warranties', label: 'Warranty Status', icon: ShieldCheck },
          { id: 'feedback', label: 'Ratings & Complaints', icon: Star }
        ];
      default:
        return [];
    }
  };

  const tabs = getTabs();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-65px)] p-4 flex flex-col justify-between">
      <div>
        <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Main Menu</p>
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Role Footer Badge */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">ByteNotes Service Center</p>
        <p className="text-[11px] mt-0.5">Role: <span className="font-medium text-blue-600">{role}</span></p>
      </div>
    </aside>
  );
};

export default Sidebar;
