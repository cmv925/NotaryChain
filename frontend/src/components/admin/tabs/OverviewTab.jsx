import React from 'react';
import {
  Shield, Users, FileText, TrendingUp, DollarSign,
  CheckCircle, XCircle, Clock, RefreshCw, Search,
  BarChart3, Activity, Wallet, LogOut, ChevronDown,
  Eye, UserCheck, UserX, Settings, AlertTriangle, PieChart, Plus,
  Server, HardDrive, Zap, Database, Globe, AlertCircle,
  Lock, Bell, BellOff, Mail, MailX, Save, ToggleLeft, ToggleRight,
  ShieldCheck, Key, Fingerprint, Network
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export const OverviewTab = ({ handleApproveNotary, handleRejectNotary, pendingApplications, processingAction, revenueData, stats }) => (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Applications */}
            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Pending Notary Applications ({pendingApplications.length})
                </h3>
                {pendingApplications.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No pending applications</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApplications.slice(0, 5).map((app) => (
                      <div key={app.id} className="bg-cream-100 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-navy-900 font-medium">{app.user_full_name || 'Unknown'}</p>
                          <p className="text-slate-500 text-sm">{app.user_email}</p>
                          <p className="text-slate-500 text-xs mt-1">
                            Commission: {app.commission_number || 'N/A'} | State: {app.state || 'N/A'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveNotary(app.id)}
                            disabled={processingAction === app.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectNotary(app.id)}
                            disabled={processingAction === app.id}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-coral-500" />
                  Platform Statistics
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Active Users (30d)</span>
                    <span className="text-navy-900 font-bold">{stats?.active_users_30d || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Completed Notarizations</span>
                    <span className="text-green-400 font-bold">{stats?.completed_notarizations || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Documents Sealed</span>
                    <span className="text-navy-500 font-bold">{stats?.documents_sealed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Crypto Payments</span>
                    <span className="text-coral-600 font-bold">{stats?.crypto_payments_count || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Chart */}
            {revenueData && (
              <Card className="bg-white border-slate-200 lg:col-span-2">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Revenue (Last 30 Days)
                  </h3>
                  <div className="h-48 flex items-end gap-1">
                    {revenueData.stripe_daily.slice(-30).map((day, idx) => {
                      const crypto = revenueData.crypto_daily.find(c => c.date === day.date);
                      const total = day.amount + (crypto?.amount || 0);
                      const maxRevenue = Math.max(...revenueData.stripe_daily.map(d => d.amount)) || 100;
                      const height = (total / maxRevenue) * 100;
                      
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center group">
                          <div
                            className="w-full bg-gradient-to-t from-coral-500 to-blue-400 rounded-t transition-all hover:from-coral-500 hover:to-blue-300"
                            style={{ height: `${Math.max(height, 4)}%` }}
                            title={`${day.date}: $${total.toFixed(2)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
);

export default OverviewTab;
