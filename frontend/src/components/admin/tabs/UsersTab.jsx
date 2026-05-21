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

export const UsersTab = ({ notaries, searchQuery, setSearchQuery, setUserRoleFilter, userRoleFilter, users, viewUserDetails }) => (
          <Card className="bg-white border-slate-200" data-testid="users-tab">
            <CardContent className="p-0">
              {/* Toolbar */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-serif text-2xl text-ink-900 tracking-tight">All Users</h3>
                  <p className="text-slate-600 text-sm mt-0.5">{users.length} registered · {users.filter(u => u.is_notary).length} are notaries</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'admin', label: 'Admins' },
                    { id: 'notary', label: 'Notaries' },
                    { id: 'user', label: 'Clients' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setUserRoleFilter(f.id)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                        (userRoleFilter || 'all') === f.id
                          ? 'bg-ink-900 text-cream-100'
                          : 'bg-cream-200 text-slate-700 hover:bg-cream-100'
                      }`}
                      data-testid={`users-filter-${f.id}`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <div className="relative ml-2">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="Search name or email…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-cream-100 border-slate-200 text-ink-900 w-64 h-9 text-sm"
                      data-testid="users-search"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-cream-200/60 sticky top-0">
                    <tr>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-6">User</th>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-3">Role</th>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-3">Status</th>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-3">Notary</th>
                      <th className="text-left text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-3">Joined</th>
                      <th className="text-right text-[11px] uppercase tracking-[0.18em] font-bold text-slate-600 py-3 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => (
                        (u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                        && (!userRoleFilter || userRoleFilter === 'all' ||
                            (userRoleFilter === 'admin' && u.role === 'admin') ||
                            (userRoleFilter === 'notary' && (u.role === 'notary' || u.is_notary)) ||
                            (userRoleFilter === 'user' && u.role !== 'admin' && !u.is_notary))
                      ))
                      .map((user, i) => {
                        const initials = (user.full_name || user.email || '?')
                          .split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                        const avatarBg = user.role === 'admin' ? 'bg-coral-100 text-coral-700'
                          : (user.role === 'notary' || user.is_notary) ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-cream-200 text-slate-700';
                        return (
                          <tr
                            key={user.id}
                            className={`border-b border-slate-100 hover:bg-cream-100 transition-colors ${i % 2 === 1 ? 'bg-cream-100/40' : ''}`}
                            data-testid={`users-row-${user.id}`}
                          >
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[12px] ${avatarBg}`}>
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-ink-900 font-semibold text-[15px] truncate">{user.full_name || 'Unnamed user'}</p>
                                  <p className="text-slate-600 text-[13px] truncate">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                user.role === 'admin' ? 'bg-coral-100 text-coral-700'
                                  : user.role === 'notary' ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-cream-200 text-slate-700'
                              }`}>
                                {user.role || 'client'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                user.status === 'active' || !user.status
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-coral-100 text-coral-700'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' || !user.status ? 'bg-emerald-500' : 'bg-coral-500'}`} />
                                {user.status || 'active'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              {user.is_notary ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 text-[13px] font-medium">
                                  <CheckCircle className="w-4 h-4" /> Yes
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[13px]">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-slate-700 text-[13px]">
                              {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => viewUserDetails(user.id)}
                                className="border-slate-300 text-ink-900 hover:bg-cream-200 h-8 text-[12px]"
                                data-testid={`users-view-${user.id}`}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {users.filter(u => (u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">No users match this filter.</div>
                )}
              </div>
            </CardContent>
          </Card>
);

export default UsersTab;
