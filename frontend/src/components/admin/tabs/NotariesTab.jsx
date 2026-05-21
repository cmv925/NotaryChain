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

export const NotariesTab = ({ notaries, notaryStatusFilter, setNotaryStatusFilter, viewUserDetails }) => (
          <Card className="bg-white border-slate-200" data-testid="notaries-tab">
            <CardContent className="p-0">
              {/* Toolbar */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-serif text-2xl text-ink-900 tracking-tight">Notary Profiles</h3>
                  <p className="text-slate-600 text-sm mt-0.5">
                    {notaries.length} total · {notaries.filter(n => n.status === 'approved').length} approved ·
                    {' '}{notaries.filter(n => n.status === 'pending').length} pending review
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'approved', label: 'Approved' },
                    { id: 'pending', label: 'Pending' },
                    { id: 'rejected', label: 'Rejected' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setNotaryStatusFilter(f.id)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                        (notaryStatusFilter || 'all') === f.id
                          ? 'bg-ink-900 text-cream-100'
                          : 'bg-cream-200 text-slate-700 hover:bg-cream-100'
                      }`}
                      data-testid={`notaries-filter-${f.id}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-cream-200/60">
                    <tr>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-6">Notary</th>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-3">Commission</th>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-3">State</th>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-3">Status</th>
                      <th className="text-right text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notaries
                      .filter(n => !notaryStatusFilter || notaryStatusFilter === 'all' || n.status === notaryStatusFilter)
                      .map((notary, i) => {
                        const initials = (notary.user_full_name || notary.user_email || '?')
                          .split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                        const statusStyle = notary.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : notary.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-coral-100 text-coral-700';
                        const statusDot = notary.status === 'approved' ? 'bg-emerald-500'
                          : notary.status === 'pending' ? 'bg-amber-500'
                          : 'bg-coral-500';
                        return (
                          <tr
                            key={notary.id}
                            className={`border-b border-slate-100 hover:bg-cream-100 transition-colors ${i % 2 === 1 ? 'bg-cream-100/40' : ''}`}
                            data-testid={`notaries-row-${notary.id}`}
                          >
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[12px]">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-ink-900 font-semibold text-[15px] truncate">{notary.user_full_name || 'Unknown notary'}</p>
                                  <p className="text-slate-600 text-[13px] truncate">{notary.user_email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-ink-900 text-[14px] font-mono">
                              {notary.commission_number || <span className="text-slate-400">—</span>}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="inline-block px-2 py-0.5 bg-cream-200 text-ink-900 rounded text-[12px] font-bold tracking-wider">
                                {notary.state || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${statusStyle}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                                {notary.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => viewUserDetails(notary.user_id)}
                                className="border-slate-300 text-ink-900 hover:bg-cream-200 h-8 text-[12px]"
                                data-testid={`notaries-view-${notary.id}`}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {notaries.filter(n => !notaryStatusFilter || notaryStatusFilter === 'all' || n.status === notaryStatusFilter).length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">No notaries match this filter.</div>
                )}
              </div>
            </CardContent>
          </Card>
);

export default NotariesTab;
