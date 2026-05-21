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

export const AuditTab = ({ auditLogs }) => (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-navy-900 mb-6">Audit Logs</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="bg-cream-100 rounded-lg p-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      log.severity === 'critical' ? 'bg-red-500' :
                      log.severity === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
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
);

export default AuditTab;
