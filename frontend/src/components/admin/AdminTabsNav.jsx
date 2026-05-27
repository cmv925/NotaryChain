import React from 'react';
import {
  BarChart3, Server, ShieldCheck, PieChart, Users, UserCheck, Activity,
} from 'lucide-react';

const TABS = [
  { id: 'overview',   label: 'Overview',   icon: BarChart3 },
  { id: 'operations', label: 'Operations', icon: Server },
  { id: 'security',   label: 'Security',   icon: ShieldCheck },
  { id: 'analytics',  label: 'Analytics',  icon: PieChart },
  { id: 'users',      label: 'Users',      icon: Users },
  { id: 'notaries',   label: 'Notaries',   icon: UserCheck },
  { id: 'audit',      label: 'Audit Logs', icon: Activity },
];

/**
 * Tab navigation row for the Command Authority Suite. Wrapped with
 * `data-testid="admin-tabs-nav"` so the onboarding tour can highlight it.
 */
export default function AdminTabsNav({ activeTab, onSelect }) {
  return (
    <div className="mb-6">
      <div
        className="flex gap-2 border-b border-slate-200 overflow-x-auto"
        data-testid="admin-tabs-nav"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-coral-500 border-b-2 border-coral-300'
                : 'text-slate-500 hover:text-navy-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
