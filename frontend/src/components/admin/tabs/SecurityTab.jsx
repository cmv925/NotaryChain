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

export const SecurityTab = ({ exportSecurityPdf, exportingPdf, fetchSecurityCompliance, loadingSecurity, securityData }) => (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                Security Compliance
              </h2>
              <div className="flex items-center gap-2">
              <Button
                onClick={fetchSecurityCompliance}
                disabled={loadingSecurity}
                variant="outline"
                className="border-slate-200"
                data-testid="security-refresh-btn"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSecurity ? 'animate-spin' : ''}`} />
              </Button>
              {securityData && (
                <Button
                  onClick={exportSecurityPdf}
                  disabled={exportingPdf}
                  className="bg-coral-500 hover:bg-coral-500"
                  data-testid="security-export-pdf-btn"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {exportingPdf ? 'Exporting...' : 'Export PDF'}
                </Button>
              )}
              </div>
            </div>

            {loadingSecurity && !securityData ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
              </div>
            ) : securityData ? (
              <>
                {/* Score Banner */}
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6" data-testid="security-score-banner">
                  <div className="flex items-center gap-8">
                    <div className="relative w-28 h-28 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          stroke={securityData.score_pct >= 90 ? '#10b981' : securityData.score_pct >= 70 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${securityData.score_pct * 2.64} 264`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-navy-900">{securityData.score_pct}%</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-navy-900 mb-1">
                        {securityData.score_pct >= 90 ? 'Excellent' : securityData.score_pct >= 70 ? 'Good' : 'Needs Attention'}
                      </h3>
                      <p className="text-slate-500">
                        {securityData.active_features} of {securityData.total_features} security features active
                      </p>
                      <p className="text-slate-600 text-sm mt-1">
                        Last checked: {new Date(securityData.generated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {Object.entries(securityData.categories).map(([key, cat]) => {
                    const activeCount = cat.items.filter(i => i.status === 'active').length;
                    const allActive = activeCount === cat.items.length;
                    const catIcons = {
                      authentication: Lock,
                      sso: Key,
                      data_protection: Shield,
                      network_security: Network,
                      access_control: Fingerprint,
                      monitoring: Activity,
                    };
                    const CatIcon = catIcons[key] || Shield;
                    return (
                      <Card key={key} className="bg-white border-slate-200" data-testid={`security-cat-${key}`}>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-base font-bold text-navy-900 flex items-center gap-2">
                              <CatIcon className="w-4 h-4 text-coral-500" />
                              {cat.label}
                            </h4>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allActive ? 'bg-coral-500/20 text-coral-600' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              {activeCount}/{cat.items.length}
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {cat.items.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.status === 'active' ? 'bg-emerald-400' : item.status === 'not_configured' || item.status === 'missing' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                                <div className="min-w-0">
                                  <p className="text-slate-500 text-sm font-medium">{item.name}</p>
                                  <p className="text-slate-500 text-xs mt-0.5">{item.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <Card className="bg-white border-slate-200">
                <CardContent className="p-12 text-center">
                  <ShieldCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">Click refresh to load security compliance data</p>
                </CardContent>
              </Card>
            )}
          </div>
);

export default SecurityTab;
