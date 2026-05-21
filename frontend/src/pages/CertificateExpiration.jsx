import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Clock, AlertTriangle, RefreshCw, Shield, FileText,
  Loader2, CheckCircle, Calendar, Bell,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CertificateExpiration() {
  const { token } = useAuth();
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [daysAhead, setDaysAhead] = useState(90);

  // Set expiration form
  const [ceremonyId, setCeremonyId] = useState('');
  const [validityDays, setValidityDays] = useState(365);
  const [setting, setSetting] = useState(false);

  const fetchExpiring = async () => {
    try {
      const res = await axios.get(`${API}/platform/certificates/expiring?days_ahead=${daysAhead}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExpiring(res.data.expiring_certificates || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  useEffect(() => { fetchExpiring(); }, [token, daysAhead]);

  const setExpiration = async () => {
    if (!ceremonyId.trim()) { toast({ title: 'Error', description: 'Enter a ceremony ID', variant: 'destructive' }); return; }
    setSetting(true);
    try {
      const res = await axios.post(`${API}/platform/certificate/${ceremonyId}/set-expiration`, {
        validity_days: validityDays,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Expiration Set', description: `Expires ${new Date(res.data.expires_at).toLocaleDateString()}` });
      setCeremonyId('');
      fetchExpiring();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
    setSetting(false);
  };

  const renewCert = async (cId) => {
    try {
      const res = await axios.post(`${API}/platform/certificate/${cId}/renew`, {
        validity_days: 365,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Certificate Renewed', description: `New expiry: ${new Date(res.data.new_expires_at).toLocaleDateString()}` });
      fetchExpiring();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Renewal failed', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-cream-100" data-testid="cert-expiration-page">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Breadcrumbs items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Certificate Expiration' }]} />

        <div className="flex items-center gap-3 mt-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-coral-500/15 border border-gold-500/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-coral-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">Certificate Expiration & Renewal</h1>
            <p className="text-xs text-slate-500">Set validity periods and manage certificate renewals</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Set Expiration */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4">Set Certificate Expiration</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Ceremony ID</label>
                <Input data-testid="cert-ceremony-id" value={ceremonyId} onChange={e => setCeremonyId(e.target.value)}
                  placeholder="Paste ceremony ID" className="bg-white border-slate-300 text-navy-900 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Validity Period</label>
                <select data-testid="cert-validity" value={validityDays} onChange={e => setValidityDays(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-navy-900 focus:outline-none">
                  <option value={90}>90 Days</option>
                  <option value={180}>6 Months</option>
                  <option value={365}>1 Year</option>
                  <option value={730}>2 Years</option>
                  <option value={1825}>5 Years</option>
                </select>
              </div>
              <Button data-testid="set-expiration-btn" onClick={setExpiration} disabled={setting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-navy-900">
                {setting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
                Set Expiration
              </Button>
            </div>
          </div>

          {/* Expiring Certificates */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Expiring Certificates
              </h3>
              <select value={daysAhead} onChange={e => setDaysAhead(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-navy-900 focus:outline-none">
                <option value={30}>Next 30 days</option>
                <option value={90}>Next 90 days</option>
                <option value={180}>Next 6 months</option>
                <option value={365}>Next year</option>
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
            ) : expiring.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-8 h-8 text-coral-600 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-slate-500">No certificates expiring in this period</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiring.map((c, i) => {
                  const urgent = c.days_remaining <= 30;
                  return (
                    <div key={i} data-testid={`expiring-cert-${i}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        urgent ? 'border-red-500/30 bg-red-500/5' : 'border-slate-200'
                      }`}>
                      <div className="flex items-center gap-3">
                        {urgent ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-coral-600" />}
                        <div>
                          <span className="text-sm text-navy-900">{c.document_name}</span>
                          <p className="text-[10px] text-slate-500">
                            Expires: {new Date(c.expires_at).toLocaleDateString()} &middot; {c.days_remaining} days left
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => renewCert(c.ceremony_id)}
                        data-testid={`renew-btn-${i}`}
                        className="bg-coral-500 hover:bg-emerald-700 text-navy-900 text-xs">
                        <RefreshCw className="w-3 h-3 mr-1" /> Renew
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
