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

export const OperationsTab = ({ alertForm, alertSettings, editingAlerts, exportIncidentPdf, exportingIncidents, fetchIncidents, fetchOpsMetrics, fetchServiceHealth, fetchStorageAnalytics, incidents, loadingHealth, loadingIncidents, loadingOps, loadingStorageAnalytics, opsData, saveAlertSettings, savingAlerts, serviceHealth, setAlertForm, setEditingAlerts, storageAnalytics }) => (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
                <Server className="w-6 h-6 text-cyan-500" />
                Production Operations
              </h2>
              <Button
                onClick={fetchOpsMetrics}
                disabled={loadingOps}
                variant="outline"
                className="border-slate-200"
                data-testid="ops-refresh-btn"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOps ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loadingOps && !opsData ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin" />
              </div>
            ) : opsData ? (
              <>
                {/* System Status Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="ops-system-status">
                  {Object.entries(opsData.system).map(([service, status]) => (
                    <div key={service} className={`rounded-lg p-3 border flex items-center gap-3 ${
                      status === 'live' || status === 'healthy' || status === 's3'
                        ? 'bg-coral-500/10 border-coral-200'
                        : status === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-gray-500/10 border-slate-200'
                    }`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        status === 'live' || status === 'healthy' || status === 's3'
                          ? 'bg-emerald-400 animate-pulse' : status === 'degraded' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
                      }`} />
                      <div>
                        <p className="text-navy-900 text-sm font-medium capitalize">{service}</p>
                        <p className="text-slate-500 text-xs capitalize">{status}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hedera Blockchain Section */}
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-navy-900 mb-5 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-coral-600" />
                      Hedera Hashgraph
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        opsData.hedera.network === 'mainnet' ? 'bg-coral-500/20 text-coral-600' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {opsData.hedera.network}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-hbar-balance">
                        <p className="text-slate-500 text-xs mb-1">HBAR Balance</p>
                        <p className="text-2xl font-bold text-coral-600">
                          {opsData.hedera.balance_hbar != null ? opsData.hedera.balance_hbar.toFixed(2) : '--'}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">{opsData.hedera.account_id}</p>
                      </div>
                      <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-total-seals">
                        <p className="text-slate-500 text-xs mb-1">Total Seals</p>
                        <p className="text-2xl font-bold text-navy-900">{opsData.hedera.total_seals}</p>
                        <p className="text-slate-500 text-xs mt-1">{opsData.hedera.hcs_submitted} on-chain</p>
                      </div>
                      <div className="bg-cream-100 rounded-lg p-4">
                        <p className="text-slate-500 text-xs mb-1">Seals (30d)</p>
                        <p className="text-2xl font-bold text-navy-900">{opsData.hedera.seals_30d}</p>
                        <p className="text-slate-500 text-xs mt-1">{opsData.hedera.seals_7d} last 7d</p>
                      </div>
                      <div className="bg-cream-100 rounded-lg p-4">
                        <p className="text-slate-500 text-xs mb-1">Est. Cost (30d)</p>
                        <p className="text-2xl font-bold text-coral-600">${opsData.hedera.estimated_cost_30d}</p>
                        <p className="text-slate-500 text-xs mt-1">{opsData.hedera.total_topics} topics</p>
                      </div>
                    </div>

                    {/* Seal Trend Chart */}
                    {opsData.hedera.seal_trend.length > 0 && (
                      <div>
                        <p className="text-slate-500 text-sm mb-3">Seal Activity (30 days)</p>
                        <div className="h-24 flex items-end gap-1">
                          {opsData.hedera.seal_trend.map((day, idx) => {
                            const max = Math.max(...opsData.hedera.seal_trend.map(d => d.count)) || 1;
                            const pct = (day.count / max) * 100;
                            return (
                              <div key={idx} className="flex-1 group relative">
                                <div
                                  className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all hover:from-cyan-500 hover:to-cyan-300"
                                  style={{ height: `${Math.max(pct, 8)}%` }}
                                  title={`${day.date}: ${day.count} seals`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* S3 Storage + Payments side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* S3 Storage */}
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-5 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-coral-600" />
                        Cloud Storage (S3)
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-coral-500/20 text-coral-600">
                          {opsData.storage.bucket}
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-s3-files">
                          <p className="text-slate-500 text-xs mb-1">Total Files</p>
                          <p className="text-2xl font-bold text-coral-600">{opsData.storage.total_files}</p>
                        </div>
                        <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-s3-size">
                          <p className="text-slate-500 text-xs mb-1">Total Size</p>
                          <p className="text-2xl font-bold text-navy-900">{opsData.storage.total_size_mb || 0} MB</p>
                        </div>
                      </div>

                      {/* Category breakdown */}
                      <p className="text-slate-500 text-sm mb-3">Storage by Category</p>
                      {Object.keys(opsData.storage.categories).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(opsData.storage.categories).map(([cat, info]) => {
                            const maxFiles = Math.max(...Object.values(opsData.storage.categories).map(c => c.count)) || 1;
                            return (
                              <div key={cat} className="flex items-center gap-3">
                                <span className="text-slate-500 text-sm w-24 truncate">{cat}</span>
                                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-coral-500 rounded-full" style={{ width: `${(info.count / maxFiles) * 100}%` }} />
                                </div>
                                <span className="text-slate-500 text-xs w-20 text-right">{info.count} files</span>
                                <span className="text-slate-500 text-xs w-16 text-right">{info.size_mb} MB</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm text-center py-4">No files stored yet</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stripe Payments */}
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-5 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        Stripe Payments
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-coral-500/20 text-coral-600">
                          live
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="bg-cream-100 rounded-lg p-4" data-testid="ops-stripe-revenue">
                          <p className="text-slate-500 text-xs mb-1">Total Revenue</p>
                          <p className="text-2xl font-bold text-green-400">${opsData.payments.total_revenue_usd}</p>
                        </div>
                        <div className="bg-cream-100 rounded-lg p-4">
                          <p className="text-slate-500 text-xs mb-1">Revenue (30d)</p>
                          <p className="text-2xl font-bold text-navy-900">${opsData.payments.revenue_30d_usd}</p>
                        </div>
                        <div className="bg-cream-100 rounded-lg p-4">
                          <p className="text-slate-500 text-xs mb-1">Total Payments</p>
                          <p className="text-2xl font-bold text-navy-900">{opsData.payments.total_payments}</p>
                          <p className="text-slate-500 text-xs mt-1">{opsData.payments.payments_30d} last 30d</p>
                        </div>
                        <div className="bg-cream-100 rounded-lg p-4">
                          <p className="text-slate-500 text-xs mb-1">Active Subs</p>
                          <p className="text-2xl font-bold text-navy-900">{opsData.payments.active_subscriptions}</p>
                        </div>
                      </div>

                      {/* Revenue trend */}
                      {opsData.payments.revenue_trend.length > 0 ? (
                        <div>
                          <p className="text-slate-500 text-sm mb-3">Revenue Trend (30d)</p>
                          <div className="h-24 flex items-end gap-1">
                            {opsData.payments.revenue_trend.map((day, idx) => {
                              const max = Math.max(...opsData.payments.revenue_trend.map(d => d.amount_usd)) || 1;
                              const pct = (day.amount_usd / max) * 100;
                              return (
                                <div key={idx} className="flex-1">
                                  <div
                                    className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all hover:from-green-500 hover:to-green-300"
                                    style={{ height: `${Math.max(pct, 4)}%` }}
                                    title={`${day.date}: $${day.amount_usd}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm text-center py-4">No payment data yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Balance Alert */}
                {opsData.hedera.balance_hbar != null && opsData.hedera.balance_hbar < 10 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3" data-testid="ops-hbar-alert">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-red-300 font-medium">Low HBAR Balance Warning</p>
                      <p className="text-red-400/70 text-sm">
                        Balance is {opsData.hedera.balance_hbar.toFixed(2)} HBAR. 
                        Fund account {opsData.hedera.account_id} to avoid service interruption.
                      </p>
                    </div>
                  </div>
                )}

                {/* HBAR Alert History */}
                {opsData.hbar_alerts && opsData.hbar_alerts.length > 0 && (
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                        Balance Alert History
                      </h3>
                      <div className="space-y-2" data-testid="ops-alert-history">
                        {opsData.hbar_alerts.map((alert, idx) => (
                          <div key={idx} className={`flex items-center justify-between rounded-lg p-3 border ${
                            alert.level === 'emergency' ? 'bg-red-500/5 border-red-500/20' :
                            alert.level === 'critical' ? 'bg-coral-500/5 border-orange-500/20' :
                            'bg-yellow-500/5 border-yellow-500/20'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                alert.level === 'emergency' ? 'bg-red-500/20 text-red-400' :
                                alert.level === 'critical' ? 'bg-coral-500/20 text-coral-600' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>{alert.level.toUpperCase()}</span>
                              <span className="text-slate-500 text-sm">{alert.balance_hbar.toFixed(2)} HBAR</span>
                              <span className="text-slate-500 text-xs">threshold: {alert.threshold_hbar}</span>
                            </div>
                            <span className="text-slate-500 text-xs">{new Date(alert.alerted_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Service Health Monitor */}
                <Card className="bg-white border-slate-200" data-testid="service-health-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-coral-600" />
                        Service Health
                      </h3>
                      <Button size="sm" variant="outline" className="border-slate-200" onClick={fetchServiceHealth} disabled={loadingHealth} data-testid="health-refresh-btn">
                        <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {serviceHealth ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {serviceHealth.services.map((svc, i) => {
                            const isHealthy = svc.status === 'healthy';
                            const isDegraded = svc.status === 'degraded';
                            return (
                              <div key={i} className={`rounded-xl p-4 border transition-all ${isHealthy ? 'bg-coral-500/5 border-coral-200' : isDegraded ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-800/30 border-slate-200'}`} data-testid={`health-${svc.service.toLowerCase().replace(' ', '-')}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-navy-900 text-sm font-medium">{svc.service}</span>
                                  <div className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-red-400 animate-pulse' : 'bg-gray-500'}`} />
                                </div>
                                <p className={`text-xs ${isHealthy ? 'text-coral-600' : isDegraded ? 'text-red-400' : 'text-slate-500'}`}>
                                  {svc.status === 'healthy' ? 'Operational' : svc.status === 'degraded' ? 'Degraded' : 'Not Configured'}
                                </p>
                                <p className="text-slate-600 text-xs mt-1 truncate">{svc.detail}</p>
                              </div>
                            );
                          })}
                        </div>

                        {serviceHealth.recent_alerts?.length > 0 && (
                          <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
                            <h4 className="text-sm font-semibold text-navy-900 mb-2">Recent Alerts (24h)</h4>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {serviceHealth.recent_alerts.map((alert, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <div className={`w-1.5 h-1.5 rounded-full ${alert.status === 'recovered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                  <span className="text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                  <span className={alert.status === 'recovered' ? 'text-coral-600' : 'text-red-400'}>{alert.service}</span>
                                  <span className="text-slate-600">{alert.detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-slate-600 text-xs">Last checked: {new Date(serviceHealth.checked_at).toLocaleString()}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-slate-500 text-sm">Click refresh to check service health</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Incident Timeline */}
                <Card className="bg-white border-slate-200" data-testid="incidents-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-coral-600" />
                        Incidents (7 Days)
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="border-slate-200" onClick={fetchIncidents} disabled={loadingIncidents}>
                          <RefreshCw className={`w-4 h-4 ${loadingIncidents ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-500" onClick={exportIncidentPdf} disabled={exportingIncidents} data-testid="export-incident-pdf-btn">
                          <FileText className="w-4 h-4 mr-1" /> {exportingIncidents ? 'Exporting...' : 'Export PDF'}
                        </Button>
                      </div>
                    </div>

                    {incidents ? (
                      <div className="space-y-4">
                        {/* Summary badges */}
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-sm">{incidents.summary?.total_incidents || 0} incidents</span>
                          {incidents.summary?.resolved > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-coral-500/15 text-coral-600">
                              {incidents.summary.resolved} resolved
                            </span>
                          )}
                          {incidents.summary?.ongoing > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 animate-pulse">
                              {incidents.summary.ongoing} ongoing
                            </span>
                          )}
                        </div>

                        {incidents.incidents?.length > 0 ? (
                          <div className="space-y-2">
                            {incidents.incidents.map((inc, i) => (
                              <div key={i} className={`rounded-xl p-4 border ${inc.status === 'resolved' ? 'bg-cream-100 border-slate-200' : 'bg-red-500/5 border-red-500/20'}`} data-testid={`incident-${i}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${inc.status === 'resolved' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                                    <span className="text-navy-900 text-sm font-medium">{inc.service}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${inc.status === 'resolved' ? 'bg-coral-500/15 text-coral-600' : 'bg-red-500/15 text-red-400'}`}>
                                      {inc.status}
                                    </span>
                                  </div>
                                  <span className="text-slate-500 text-xs">
                                    {inc.duration_minutes != null ? `${inc.duration_minutes} min` : 'ongoing'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                  <span>Started: {new Date(inc.started_at).toLocaleString()}</span>
                                  {inc.ended_at && <span>Ended: {new Date(inc.ended_at).toLocaleString()}</span>}
                                </div>
                                {inc.events?.length > 0 && (
                                  <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-1">
                                    {inc.events.slice(0, 3).map((evt, j) => (
                                      <div key={j} className="flex items-center gap-2 text-xs">
                                        <div className={`w-1.5 h-1.5 rounded-full ${evt.status === 'recovered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        <span className="text-slate-600">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                        <span className={evt.status === 'recovered' ? 'text-coral-600' : 'text-red-400'}>{evt.status}</span>
                                        <span className="text-slate-600 truncate">{evt.detail?.slice(0, 60)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 bg-cream-100 rounded-xl border border-slate-200">
                            <CheckCircle className="w-8 h-8 text-coral-600 mx-auto mb-2" />
                            <p className="text-coral-600 text-sm font-medium">All Clear</p>
                            <p className="text-slate-500 text-xs mt-1">No incidents in the last 7 days</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-slate-500 text-sm">Click refresh to load incident history</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* S3 Storage Analytics */}
                <Card className="bg-white border-slate-200" data-testid="storage-analytics-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-coral-600" />
                        Storage Analytics
                      </h3>
                      <Button size="sm" variant="outline" className="border-slate-200" onClick={fetchStorageAnalytics} disabled={loadingStorageAnalytics} data-testid="storage-refresh-btn">
                        <RefreshCw className={`w-4 h-4 ${loadingStorageAnalytics ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {storageAnalytics ? (
                      <div className="space-y-5">
                        {/* Summary row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Total Files', value: storageAnalytics.total_vault_docs, color: 'blue' },
                            { label: 'Storage Used', value: `${storageAnalytics.total_vault_size_mb} MB`, color: 'cyan' },
                            { label: 'Downloads', value: storageAnalytics.total_downloads, color: 'purple' },
                            { label: 'Uploads (30d)', value: storageAnalytics.cost_projection?.uploads_30d || 0, color: 'emerald' },
                          ].map((s, i) => (
                            <div key={i} className="bg-cream-100 rounded-xl p-4 border border-slate-200">
                              <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                              <p className={`text-xl font-bold text-${s.color}-400`}>{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Cost Projection */}
                        {storageAnalytics.cost_projection && (
                          <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
                            <h4 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-coral-600" />
                              Cost Projection (AWS S3 Standard)
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-slate-500 text-xs">Current Usage</p>
                                <p className="text-navy-900 font-medium">{storageAnalytics.cost_projection.current_gb} GB</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Monthly Cost</p>
                                <p className="text-coral-600 font-medium">${storageAnalytics.cost_projection.monthly_cost_usd}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Growth Rate (30d)</p>
                                <p className={`font-medium ${storageAnalytics.cost_projection.growth_rate_pct >= 0 ? 'text-yellow-400' : 'text-coral-600'}`}>
                                  {storageAnalytics.cost_projection.growth_rate_pct > 0 ? '+' : ''}{storageAnalytics.cost_projection.growth_rate_pct}%
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">12-Month Projected</p>
                                <p className="text-navy-900 font-medium">${storageAnalytics.cost_projection.projected_12m_cost_usd}</p>
                              </div>
                            </div>
                            <p className="text-slate-600 text-xs mt-2">Based on $0.023/GB/month S3 Standard pricing</p>
                          </div>
                        )}

                        {/* Upload Activity Trend */}
                        {storageAnalytics.activity_trend?.length > 0 && (
                          <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
                            <h4 className="text-sm font-semibold text-navy-900 mb-3">Upload Activity (Last 30 Days)</h4>
                            <div className="flex items-end gap-1 h-20">
                              {storageAnalytics.activity_trend.map((d, i) => {
                                const maxUploads = Math.max(...storageAnalytics.activity_trend.map(t => t.uploads), 1);
                                const height = Math.max((d.uploads / maxUploads) * 100, 4);
                                return (
                                  <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                                    <div className="absolute -top-6 hidden group-hover:block bg-gray-800 text-navy-900 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                      {d.date}: {d.uploads} files ({d.size_mb} MB)
                                    </div>
                                    <div
                                      className="w-full bg-cyan-500/60 rounded-t hover:bg-cyan-400/80 transition-colors cursor-pointer"
                                      style={{ height: `${height}%`, minHeight: '3px' }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Per-User Storage */}
                        {storageAnalytics.per_user?.length > 0 && (
                          <div className="bg-cream-100 rounded-xl p-4 border border-slate-200">
                            <h4 className="text-sm font-semibold text-navy-900 mb-3">Storage by User (Top 10)</h4>
                            <div className="space-y-2">
                              {storageAnalytics.per_user.slice(0, 10).map((u, i) => {
                                const maxMB = Math.max(...storageAnalytics.per_user.map(x => x.total_size_mb), 1);
                                const pct = (u.total_size_mb / maxMB) * 100;
                                return (
                                  <div key={i} className="flex items-center gap-3 text-sm">
                                    <span className="text-slate-500 w-48 truncate">{u.email}</span>
                                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                                    </div>
                                    <span className="text-slate-500 w-24 text-right">{u.total_size_mb} MB ({u.file_count})</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-slate-500 text-sm">Click refresh to load storage analytics</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Alert Settings Panel */}
                <Card className="bg-white border-slate-200" data-testid="alert-settings-panel">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        Alert Configuration
                      </h3>
                      {!editingAlerts ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => { if (!alertForm && alertSettings) setAlertForm(JSON.parse(JSON.stringify(alertSettings))); setEditingAlerts(true); }}
                          data-testid="edit-alert-settings-btn"
                        >
                          <Settings className="w-4 h-4 mr-1" /> Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-slate-200 text-slate-500" onClick={() => { setEditingAlerts(false); setAlertForm(JSON.parse(JSON.stringify(alertSettings))); }}>Cancel</Button>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={saveAlertSettings} disabled={savingAlerts} data-testid="save-alert-settings-btn">
                            <Save className="w-4 h-4 mr-1" /> {savingAlerts ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {alertForm ? (
                      <div className="space-y-5">
                        {/* Timing */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-slate-500 text-xs block mb-1.5">Check Interval (minutes)</label>
                            <input
                              type="number"
                              min={5} max={1440}
                              value={alertForm.check_interval_minutes}
                              onChange={(e) => setAlertForm(f => ({...f, check_interval_minutes: parseInt(e.target.value) || 30}))}
                              disabled={!editingAlerts}
                              className="w-full px-3 py-2 rounded-lg bg-cream-100 border border-slate-200 text-navy-900 disabled:opacity-50"
                              data-testid="alert-check-interval"
                            />
                            <p className="text-slate-600 text-xs mt-1">How often to check balance (5–1440 min)</p>
                          </div>
                          <div>
                            <label className="text-slate-500 text-xs block mb-1.5">Cooldown Period (hours)</label>
                            <input
                              type="number"
                              min={1} max={168}
                              value={alertForm.cooldown_hours}
                              onChange={(e) => setAlertForm(f => ({...f, cooldown_hours: parseInt(e.target.value) || 24}))}
                              disabled={!editingAlerts}
                              className="w-full px-3 py-2 rounded-lg bg-cream-100 border border-slate-200 text-navy-900 disabled:opacity-50"
                              data-testid="alert-cooldown"
                            />
                            <p className="text-slate-600 text-xs mt-1">Don't repeat same alert within this period (1–168h)</p>
                          </div>
                        </div>

                        {/* Notification Channels */}
                        <div>
                          <label className="text-slate-500 text-xs block mb-2">Notification Channels</label>
                          <div className="flex gap-4">
                            <button
                              onClick={() => editingAlerts && setAlertForm(f => ({...f, email_alerts_enabled: !f.email_alerts_enabled}))}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${alertForm.email_alerts_enabled ? 'bg-coral-500/10 border-emerald-500/40 text-coral-600' : 'bg-gray-800/50 border-slate-200 text-slate-500'} ${!editingAlerts ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                              data-testid="toggle-email-alerts"
                            >
                              {alertForm.email_alerts_enabled ? <Mail className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                              Email Alerts
                            </button>
                            <button
                              onClick={() => editingAlerts && setAlertForm(f => ({...f, in_app_alerts_enabled: !f.in_app_alerts_enabled}))}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${alertForm.in_app_alerts_enabled ? 'bg-coral-500/10 border-emerald-500/40 text-coral-600' : 'bg-gray-800/50 border-slate-200 text-slate-500'} ${!editingAlerts ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                              data-testid="toggle-inapp-alerts"
                            >
                              {alertForm.in_app_alerts_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                              In-App Alerts
                            </button>
                          </div>
                        </div>

                        {/* Thresholds */}
                        <div>
                          <label className="text-slate-500 text-xs block mb-2">Alert Thresholds</label>
                          <div className="space-y-2">
                            {alertForm.thresholds.map((t, idx) => (
                              <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${t.enabled ? (t.level === 'emergency' ? 'bg-red-500/5 border-red-500/20' : t.level === 'critical' ? 'bg-coral-500/5 border-orange-500/20' : 'bg-yellow-500/5 border-yellow-500/20') : 'bg-gray-800/30 border-slate-200'}`}>
                                <button
                                  onClick={() => {
                                    if (!editingAlerts) return;
                                    const updated = [...alertForm.thresholds];
                                    updated[idx] = {...updated[idx], enabled: !updated[idx].enabled};
                                    setAlertForm(f => ({...f, thresholds: updated}));
                                  }}
                                  className={!editingAlerts ? 'cursor-default' : 'cursor-pointer'}
                                  data-testid={`toggle-threshold-${t.level}`}
                                >
                                  {t.enabled ? <ToggleRight className="w-5 h-5 text-coral-600" /> : <ToggleLeft className="w-5 h-5 text-slate-600" />}
                                </button>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase w-24 text-center ${t.level === 'emergency' ? 'bg-red-500/20 text-red-400' : t.level === 'critical' ? 'bg-coral-500/20 text-coral-600' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                  {t.level}
                                </span>
                                <span className="text-slate-500 text-sm">&lt;</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={t.hbar}
                                  onChange={(e) => {
                                    const updated = [...alertForm.thresholds];
                                    updated[idx] = {...updated[idx], hbar: parseFloat(e.target.value) || 0};
                                    setAlertForm(f => ({...f, thresholds: updated}));
                                  }}
                                  disabled={!editingAlerts}
                                  className="w-20 px-2 py-1 rounded bg-cream-100 border border-slate-200 text-navy-900 text-sm disabled:opacity-50"
                                />
                                <span className="text-slate-500 text-sm">HBAR</span>
                                <span className="text-slate-500 text-xs ml-auto hidden sm:inline">{t.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-white border-slate-200">
                <CardContent className="p-12 text-center">
                  <Server className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">Click refresh to load operations data</p>
                </CardContent>
              </Card>
            )}
          </div>
);

export default OperationsTab;
