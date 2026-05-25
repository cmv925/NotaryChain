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
import AuditExportPanel from '../AuditExportPanel';
import ScheduledExportsPanel from '../ScheduledExportsPanel';
import { Link } from 'react-router-dom';

export const AuditTab = ({ auditLogs }) => (
        <div className="space-y-6">
          {/* Quick-link to companion admin report tools */}
          <Link
            to="/admin/batch-certificates"
            className="block bg-gradient-to-r from-coral-500/10 to-coral-500/5 hover:from-coral-500/15 hover:to-coral-500/10 border border-coral-200 rounded-lg p-4 transition-colors group"
            data-testid="batch-cert-link-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-coral-500/15 flex items-center justify-center">
                <FileText className="w-5 h-5 text-coral-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-navy-900">Batch Certificate Generator</p>
                <p className="text-xs text-slate-600">Bundle multiple ceremony certificates into a single ZIP — perfect for legal handovers.</p>
              </div>
              <ChevronDown className="w-4 h-4 text-coral-600 -rotate-90 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <ScheduledExportsPanel />
          <AuditExportPanel />
          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-navy-900 mb-6">Audit Logs</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="bg-cream-100 rounded-lg p-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      log.severity === 'critical' ? 'bg-red-500' :
                      log.severity === 'warning' ? 'bg-yellow-500' :
                      'bg-coral-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-navy-900 font-medium text-sm">{log.action}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500 text-xs">{log.resource_type}</span>
                      </div>
                      <p className="text-slate-500 text-sm">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-500 text-xs">{log.user_email || 'System'}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500 text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
);

export default AuditTab;
