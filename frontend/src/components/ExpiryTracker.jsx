import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Clock, CalendarClock, CheckCircle2, XCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  expired: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', icon: XCircle, label: 'Expired' },
  critical: { color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', icon: AlertTriangle, label: 'Expiring Soon' },
  warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', icon: Clock, label: 'Expiring' },
  approaching: { color: 'text-coral-500', bg: 'bg-coral-500/15', border: 'border-coral-300/30', icon: CalendarClock, label: 'Approaching' },
  active: { color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30', icon: CheckCircle2, label: 'Active' },
};

export function ExpiryWidget({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renewingId, setRenewingId] = useState(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fetchExpiry = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/expiry/dashboard`, { headers });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchExpiry(); }, [fetchExpiry]);

  const handleRenew = async (docId, docName) => {
    setRenewingId(docId);
    try {
      await axios.post(`${API}/expiry/requests/${docId}/renew`, {}, { headers });
      toast({ title: 'Renewed', description: `"${docName}" has been renewed as a new request` });
      fetchExpiry();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed to renew', variant: 'destructive' });
    }
    setRenewingId(null);
  };

  if (loading) return null;
  if (!data || data.documents.length === 0) return null;

  const { documents, summary } = data;
  const urgentCount = summary.expired + summary.critical;

  return (
    <Card className="bg-white border-slate-200 mb-6 sm:mb-8" data-testid="expiry-widget">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-400" />
            Document Expiry Tracker
          </h3>
          {urgentCount > 0 && (
            <span className="px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded-full" data-testid="expiry-urgent-count">
              {urgentCount} urgent
            </span>
          )}
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {summary.expired > 0 && (
            <span className="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full border border-red-500/30" data-testid="expiry-summary-expired">
              {summary.expired} expired
            </span>
          )}
          {summary.critical > 0 && (
            <span className="px-2 py-0.5 bg-orange-500/15 text-orange-400 text-xs rounded-full border border-orange-500/30" data-testid="expiry-summary-critical">
              {summary.critical} critical
            </span>
          )}
          {summary.warning > 0 && (
            <span className="px-2 py-0.5 bg-yellow-500/15 text-yellow-400 text-xs rounded-full border border-yellow-500/30" data-testid="expiry-summary-warning">
              {summary.warning} warning
            </span>
          )}
          {summary.approaching > 0 && (
            <span className="px-2 py-0.5 bg-coral-500/15 text-coral-500 text-xs rounded-full border border-coral-300/30" data-testid="expiry-summary-approaching">
              {summary.approaching} approaching
            </span>
          )}
        </div>

        {/* Document list */}
        <div className="space-y-2">
          {documents.slice(0, 5).map((doc) => {
            const cfg = statusConfig[doc.expiry_status] || statusConfig.active;
            const Icon = cfg.icon;
            return (
              <div
                key={doc.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border} transition-colors`}
                data-testid={`expiry-doc-${doc.id}`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{doc.document_name}</p>
                  <p className="text-xs text-slate-500">
                    {doc.document_type} &middot; {doc.status}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-2">
                  {(doc.expiry_status === 'expired' || doc.expiry_status === 'critical') && (
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleRenew(doc.id, doc.document_name); }}
                      size="sm"
                      className="bg-green-600/80 hover:bg-green-600 text-white text-[10px] h-6 px-2"
                      disabled={renewingId === doc.id}
                      data-testid={`renew-btn-${doc.id}`}
                    >
                      <RefreshCw className={`w-3 h-3 mr-0.5 ${renewingId === doc.id ? 'animate-spin' : ''}`} />
                      Renew
                    </Button>
                  )}
                  <span className={`text-xs font-semibold ${cfg.color}`}>
                    {doc.days_remaining !== null && doc.days_remaining !== undefined
                      ? doc.days_remaining < 0
                        ? `${Math.abs(doc.days_remaining)}d overdue`
                        : doc.days_remaining === 0
                          ? 'Today'
                          : `${doc.days_remaining}d left`
                      : cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {documents.length > 5 && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            +{documents.length - 5} more documents with expiry dates
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline expiry badge for a single notarization request
 */
export function ExpiryBadge({ request }) {
  if (!request.expires_at) return null;

  let daysLeft = null;
  let status = 'active';
  try {
    const exp = new Date(request.expires_at);
    const now = new Date();
    daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 1) status = 'critical';
    else if (daysLeft <= 7) status = 'warning';
    else if (daysLeft <= 30) status = 'approaching';
  } catch { return null; }

  const cfg = statusConfig[status] || statusConfig.active;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}
      data-testid={`expiry-badge-${request.id}`}
      title={`Expires: ${new Date(request.expires_at).toLocaleDateString()}`}
    >
      <CalendarClock className="w-3 h-3" />
      {daysLeft !== null
        ? daysLeft < 0
          ? `${Math.abs(daysLeft)}d overdue`
          : daysLeft === 0
            ? 'Expires today'
            : `${daysLeft}d left`
        : 'Expiry set'}
    </span>
  );
}

/**
 * Set expiry date popover for a request
 */
export function SetExpiryButton({ requestId, currentExpiry, token, onUpdate }) {
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(currentExpiry ? currentExpiry.split('T')[0] : '');
  const [saving, setSaving] = useState(false);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try {
      const isoDate = new Date(date + 'T23:59:59Z').toISOString();
      await axios.put(`${API}/expiry/requests/${requestId}`, { expires_at: isoDate }, { headers });
      onUpdate?.();
      setShow(false);
    } catch (e) {
      console.error('Failed to set expiry', e);
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API}/expiry/requests/${requestId}`, { headers });
      setDate('');
      onUpdate?.();
      setShow(false);
    } catch (e) {
      console.error('Failed to remove expiry', e);
    }
    setSaving(false);
  };

  if (!show) {
    return (
      <Button
        onClick={() => setShow(true)}
        size="sm"
        variant="outline"
        className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs"
        data-testid={`set-expiry-btn-${requestId}`}
      >
        <CalendarClock className="w-3.5 h-3.5 mr-1" />
        {currentExpiry ? 'Edit Expiry' : 'Set Expiry'}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-cream-100 p-2 rounded-lg border border-slate-200" data-testid={`expiry-form-${requestId}`}>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        min={new Date().toISOString().split('T')[0]}
        className="bg-white text-white text-xs px-2 py-1.5 rounded border border-slate-200 focus:border-amber-500 outline-none"
        data-testid={`expiry-date-input-${requestId}`}
      />
      <Button
        onClick={handleSave}
        size="sm"
        className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3"
        disabled={!date || saving}
        data-testid={`expiry-save-btn-${requestId}`}
      >
        {saving ? '...' : 'Save'}
      </Button>
      {currentExpiry && (
        <Button
          onClick={handleRemove}
          size="sm"
          variant="outline"
          className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-2"
          disabled={saving}
          data-testid={`expiry-remove-btn-${requestId}`}
        >
          Remove
        </Button>
      )}
      <Button
        onClick={() => setShow(false)}
        size="sm"
        variant="ghost"
        className="text-slate-500 hover:text-white text-xs px-2"
      >
        Cancel
      </Button>
    </div>
  );
}
