import React from 'react';
import { Users, UserCheck, FileText, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

/**
 * Five live KPI cards across the top of the Command Authority Suite.
 * The grid is wrapped with `data-testid="admin-stats-grid"` so the onboarding
 * tour can highlight it as a single hotspot.
 */
export default function AdminStatsGrid({ stats }) {
  if (!stats) return null;

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8"
      data-testid="admin-stats-grid"
    >
      <Card className="bg-gradient-to-br from-coral-500/20 to-coral-600/10 border-coral-300/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs">Total Users</p>
              <p className="text-2xl font-bold text-navy-900">{stats.total_users}</p>
            </div>
            <Users className="w-8 h-8 text-coral-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs">Active Notaries</p>
              <p className="text-2xl font-bold text-navy-900">{stats.total_notaries}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-navy-700/20 to-navy-700/10 border-navy-300/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs">Notarizations</p>
              <p className="text-2xl font-bold text-navy-900">{stats.total_notarizations}</p>
            </div>
            <FileText className="w-8 h-8 text-navy-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-600/20 to-orange-600/10 border-coral-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs">Revenue (USD)</p>
              <p className="text-2xl font-bold text-navy-900">${stats.total_revenue_usd}</p>
            </div>
            <DollarSign className="w-8 h-8 text-coral-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-600/20 to-yellow-600/10 border-yellow-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs">Pending Apps</p>
              <p className="text-2xl font-bold text-navy-900">{stats.pending_notary_applications}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
