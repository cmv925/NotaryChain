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
import TourCompletionCard from '../TourCompletionCard';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export const AnalyticsTab = ({ analyticsData, analyticsPeriod, ceremonyAnalytics, fetchAnalyticsData, fetchCeremonyAnalytics, loadingAnalytics, loadingCeremonyAnalytics, setAnalyticsPeriod, stats, users }) => (
          <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
                <PieChart className="w-6 h-6 text-coral-500" />
                Platform Analytics
              </h2>
              <div className="flex items-center gap-3">
                <select
                  value={analyticsPeriod}
                  onChange={(e) => {
                    setAnalyticsPeriod(Number(e.target.value));
                    fetchAnalyticsData(Number(e.target.value));
                  }}
                  className="px-3 py-2 rounded-lg bg-cream-100 border border-slate-200 text-navy-900"
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                  <option value={180}>Last 6 Months</option>
                  <option value={365}>Last Year</option>
                </select>
                <Button
                  onClick={() => fetchAnalyticsData()}
                  disabled={loadingAnalytics}
                  variant="outline"
                  className="border-slate-200"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {loadingAnalytics && !analyticsData ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-12 h-12 text-coral-500 animate-spin" />
              </div>
            ) : analyticsData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="analytics-summary-cards">
                  <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30" data-testid="analytics-total-revenue">
                    <CardContent className="p-4">
                      <p className="text-slate-500 text-xs">Total Revenue</p>
                      <p className="text-2xl font-bold text-navy-900">${analyticsData.summary.total_revenue.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-1">Last {analyticsPeriod} days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-coral-500/20 to-coral-600/10 border-coral-300/30" data-testid="analytics-new-users">
                    <CardContent className="p-4">
                      <p className="text-slate-500 text-xs">New Users</p>
                      <p className="text-2xl font-bold text-navy-900">{analyticsData.summary.new_users}</p>
                      <p className="text-xs text-slate-500 mt-1">Last {analyticsPeriod} days</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-navy-700/20 to-navy-700/10 border-navy-300/30" data-testid="analytics-notarizations">
                    <CardContent className="p-4">
                      <p className="text-slate-500 text-xs">Notarizations</p>
                      <p className="text-2xl font-bold text-navy-900">{analyticsData.summary.total_notarizations}</p>
                      <p className="text-xs text-green-400 mt-1">{analyticsData.summary.completed_notarizations} completed</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-orange-600/20 to-orange-600/10 border-coral-200" data-testid="analytics-transactions">
                    <CardContent className="p-4">
                      <p className="text-slate-500 text-xs">Transactions</p>
                      <p className="text-2xl font-bold text-navy-900">{analyticsData.summary.total_transactions}</p>
                      <p className="text-xs text-slate-500 mt-1">Orchestrator</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue Trends Chart */}
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      Revenue Trends
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={analyticsData.revenue_trends}>
                        <defs>
                          <linearGradient id="stripeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#635BFF" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#635BFF" stopOpacity={0.1}/>
                          </linearGradient>
                          <linearGradient id="cryptoGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F7931A" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#F7931A" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                        <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(value) => [`$${value}`, '']}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="stripe" name="Stripe" stroke="#635BFF" fill="url(#stripeGradient)" />
                        <Area type="monotone" dataKey="crypto" name="Crypto" stroke="#F7931A" fill="url(#cryptoGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* User Growth Chart */}
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-coral-500" />
                        User Growth
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={analyticsData.user_growth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                          <YAxis stroke="#666" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Line type="monotone" dataKey="total_users" name="Total Users" stroke="#3B82F6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="new_users" name="New Users" stroke="#10B981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Payment Distribution Pie Chart */}
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-orange-500" />
                        Payment Distribution
                      </h3>
                      {analyticsData.payment_distribution.some(p => p.value > 0) ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <RechartsPie>
                            <Pie
                              data={analyticsData.payment_distribution.filter(p => p.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, value }) => `${name}: $${value}`}
                              labelLine={{ stroke: '#666' }}
                            >
                              {analyticsData.payment_distribution.filter(p => p.value > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                              formatter={(value) => [`$${value}`, 'Revenue']}
                            />
                          </RechartsPie>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-slate-500">
                          No payment data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notarization Volume Chart */}
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-navy-600" />
                        Notarization Volume
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analyticsData.notarization_volume}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                          <YAxis stroke="#666" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #333', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Legend />
                          <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Top Notaries */}
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-green-500" />
                        Top Performing Notaries
                      </h3>
                      {analyticsData.top_notaries.length > 0 ? (
                        <div className="space-y-3">
                          {analyticsData.top_notaries.slice(0, 5).map((notary, idx) => (
                            <div key={notary.notary_id} className="flex items-center justify-between p-3 bg-cream-100 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  idx === 0 ? 'bg-yellow-500 text-black' :
                                  idx === 1 ? 'bg-gray-400 text-black' :
                                  idx === 2 ? 'bg-coral-500 text-navy-900' :
                                  'bg-gray-700 text-navy-900'
                                }`}>
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="text-navy-900 font-medium">{notary.name || 'Unknown'}</p>
                                  <p className="text-slate-500 text-xs">{notary.email}</p>
                                </div>
                              </div>
                              <span className="text-green-400 font-bold">{notary.completed_notarizations}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-8">No notary activity data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Document & Transaction Types */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4">Document Types</h3>
                      {analyticsData.document_types.length > 0 ? (
                        <div className="space-y-2">
                          {analyticsData.document_types.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-slate-500">{doc.name}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-navy-600 rounded-full"
                                    style={{ width: `${(doc.count / analyticsData.document_types[0].count) * 100}%` }}
                                  />
                                </div>
                                <span className="text-navy-900 font-medium w-8 text-right">{doc.count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-8">No document data</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-navy-900 mb-4">Transaction Types</h3>
                      {analyticsData.transaction_types.length > 0 ? (
                        <div className="space-y-2">
                          {analyticsData.transaction_types.map((tx, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-slate-500">{tx.name}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-coral-500 rounded-full"
                                    style={{ width: `${(tx.count / analyticsData.transaction_types[0].count) * 100}%` }}
                                  />
                                </div>
                                <span className="text-navy-900 font-medium w-8 text-right">{tx.count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-8">No transaction data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Ceremony Analytics Widget */}
                <div className="mt-8" data-testid="ceremony-analytics-widget">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-navy-500" /> Ceremony Pipeline Analytics
                    </h3>
                    <Button variant="outline" size="sm" onClick={fetchCeremonyAnalytics} disabled={loadingCeremonyAnalytics} className="border-slate-200 text-slate-500 hover:text-navy-900 h-8">
                      {loadingCeremonyAnalytics ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      {loadingCeremonyAnalytics ? '' : 'Refresh'}
                    </Button>
                  </div>
                  {ceremonyAnalytics ? (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <Card className="bg-cream-100 border-slate-200">
                          <CardContent className="p-4 text-center">
                            <p className="text-slate-500 text-xs mb-1">Total Ceremonies</p>
                            <p className="text-2xl font-bold text-navy-900" data-testid="ceremony-total">{ceremonyAnalytics.total_ceremonies}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-cream-100 border-slate-200">
                          <CardContent className="p-4 text-center">
                            <p className="text-slate-500 text-xs mb-1">Approval Rate</p>
                            <p className="text-2xl font-bold text-coral-600" data-testid="ceremony-approval-rate">{ceremonyAnalytics.approval_rate}%</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-cream-100 border-slate-200">
                          <CardContent className="p-4 text-center">
                            <p className="text-slate-500 text-xs mb-1">Sealed</p>
                            <p className="text-2xl font-bold text-coral-500" data-testid="ceremony-sealed">{ceremonyAnalytics.sealed_count}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-cream-100 border-slate-200">
                          <CardContent className="p-4 text-center">
                            <p className="text-slate-500 text-xs mb-1">Pending</p>
                            <p className="text-2xl font-bold text-yellow-400" data-testid="ceremony-pending">{ceremonyAnalytics.pending_count}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Consensus Outcomes Pie */}
                        <Card className="bg-cream-100 border-slate-200">
                          <CardContent className="p-5">
                            <h4 className="text-navy-900 font-medium text-sm mb-4">Consensus Outcomes</h4>
                            <div className="flex items-center justify-center gap-6">
                              <div className="relative w-32 h-32">
                                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                                  {(() => {
                                    const items = ceremonyAnalytics.consensus_outcomes.filter(o => o.value > 0);
                                    const total = items.reduce((s, o) => s + o.value, 0);
                                    if (total === 0) return <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="20" />;
                                    let offset = 0;
                                    return items.map((o, i) => {
                                      const pct = o.value / total * 100;
                                      const dashArray = `${pct * 2.51327} ${251.327 - pct * 2.51327}`;
                                      const el = <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={o.color} strokeWidth="20" strokeDasharray={dashArray} strokeDashoffset={-offset * 2.51327} />;
                                      offset += pct;
                                      return el;
                                    });
                                  })()}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-navy-900 font-bold text-sm">{ceremonyAnalytics.total_ceremonies}</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {ceremonyAnalytics.consensus_outcomes.map((o) => (
                                  <div key={o.name} className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: o.color }} />
                                    <span className="text-slate-500 text-xs">{o.name}</span>
                                    <span className="text-navy-900 text-xs font-bold">{o.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Agent Pass Rates */}
                        <Card className="bg-cream-100 border-slate-200" data-testid="agent-pass-rates">
                          <CardContent className="p-5">
                            <h4 className="text-navy-900 font-medium text-sm mb-4">Agent Pass Rates</h4>
                            <div className="space-y-4">
                              {Object.entries(ceremonyAnalytics.agent_stats).map(([name, stats]) => (
                                <div key={name}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-slate-500 text-xs capitalize">{name}</span>
                                    <span className="text-navy-900 text-xs font-bold">{stats.pass_rate}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-coral-500 rounded-full transition-all" style={{ width: `${stats.pass_rate}%` }} />
                                  </div>
                                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                                    <span>{stats.passes} pass / {stats.fails} fail</span>
                                    <span>Avg conf: {stats.avg_confidence}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Volume Over Time */}
                      {ceremonyAnalytics.volume.length > 0 && (
                        <Card className="bg-cream-100 border-slate-200" data-testid="ceremony-volume-chart">
                          <CardContent className="p-5">
                            <h4 className="text-navy-900 font-medium text-sm mb-4">Ceremony Volume (Last 30 Days)</h4>
                            <div className="h-44">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ceremonyAnalytics.volume}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                                  <Tooltip contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #334155', color: '#fff', fontSize: 12 }} />
                                  <Bar dataKey="approved" fill="#10b981" stackId="a" name="Approved" />
                                  <Bar dataKey="rejected" fill="#ef4444" stackId="a" name="Rejected" />
                                  <Bar dataKey="review" fill="#f59e0b" stackId="a" name="Review" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* AI vs Simulated */}
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <Card className="bg-cream-100 border-slate-200">
                          <CardContent className="p-4 text-center">
                            <p className="text-slate-500 text-xs mb-1">AI Biometric</p>
                            <p className="text-xl font-bold text-navy-500" data-testid="ai-biometric-count">{ceremonyAnalytics.ai_vs_simulated.ai_biometric}</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-cream-100 border-slate-200">
                          <CardContent className="p-4 text-center">
                            <p className="text-slate-500 text-xs mb-1">Simulated</p>
                            <p className="text-xl font-bold text-slate-500" data-testid="simulated-count">{ceremonyAnalytics.ai_vs_simulated.simulated}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  ) : (
                    <Card className="bg-cream-100 border-slate-200">
                      <CardContent className="p-8 text-center">
                        {loadingCeremonyAnalytics ? (
                          <RefreshCw className="w-8 h-8 text-slate-600 mx-auto animate-spin" />
                        ) : (
                          <>
                            <Shield className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No ceremony data yet</p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            ) : (
              <Card className="bg-white border-slate-200">
                <CardContent className="p-12 text-center">
                  <PieChart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">Click refresh to load analytics data</p>
                </CardContent>
              </Card>
            )}

            {/* Onboarding Tour Engagement (always shown — uses own endpoint) */}
            <TourCompletionCard />
          </div>
);

export default AnalyticsTab;
