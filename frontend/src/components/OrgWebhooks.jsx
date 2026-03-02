import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Webhook, Plus, Pencil, Trash2, X, Loader2, Check,
  ChevronDown, ChevronUp, Send, RotateCw, Eye,
  CheckCircle, XCircle, Clock, AlertTriangle, Copy, Power,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_STYLES = {
  delivered: 'text-emerald-400 bg-emerald-500/15',
  failed: 'text-red-400 bg-red-500/15',
  pending: 'text-amber-400 bg-amber-500/15',
};

const OrgWebhooks = ({ orgId, token }) => {
  const [webhooks, setWebhooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [expandedWebhook, setExpandedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState({});
  const [loadingDeliveries, setLoadingDeliveries] = useState({});
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [whRes, evRes] = await Promise.all([
        axios.get(`${API}/organizations/${orgId}/webhooks`, { headers }),
        axios.get(`${API}/organizations/${orgId}/webhooks/events`, { headers }),
      ]);
      setWebhooks(whRes.data.webhooks);
      setEvents(evRes.data.events);
    } catch {
      toast({ title: 'Error', description: 'Failed to load webhooks', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchDeliveries = async (webhookId) => {
    setLoadingDeliveries(prev => ({ ...prev, [webhookId]: true }));
    try {
      const res = await axios.get(`${API}/organizations/${orgId}/webhooks/${webhookId}/deliveries?page_size=10`, { headers });
      setDeliveries(prev => ({ ...prev, [webhookId]: res.data.deliveries }));
    } catch {} finally {
      setLoadingDeliveries(prev => ({ ...prev, [webhookId]: false }));
    }
  };

  const handleExpand = (id) => {
    if (expandedWebhook === id) {
      setExpandedWebhook(null);
    } else {
      setExpandedWebhook(id);
      fetchDeliveries(id);
    }
  };

  const handleDelete = async (id, url) => {
    if (!window.confirm(`Delete webhook for ${url}?`)) return;
    try {
      await axios.delete(`${API}/organizations/${orgId}/webhooks/${id}`, { headers });
      toast({ title: 'Deleted', description: 'Webhook removed.' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleTest = async (id) => {
    try {
      await axios.post(`${API}/organizations/${orgId}/webhooks/${id}/test`, {}, { headers });
      toast({ title: 'Test Sent', description: 'Test payload queued for delivery.' });
      setTimeout(() => fetchDeliveries(id), 2000);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleToggle = async (wh) => {
    try {
      await axios.put(`${API}/organizations/${orgId}/webhooks/${wh.id}`, { is_active: !wh.is_active }, { headers });
      toast({ title: wh.is_active ? 'Disabled' : 'Enabled' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleRotateSecret = async (id) => {
    if (!window.confirm('Rotate signing secret? The old secret will stop working immediately.')) return;
    try {
      const res = await axios.post(`${API}/organizations/${orgId}/webhooks/${id}/rotate-secret`, {}, { headers });
      toast({ title: 'Secret Rotated', description: 'Copy the new secret now — it won\'t be shown again.' });
      navigator.clipboard?.writeText(res.data.new_secret);
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-500" /></div>;

  return (
    <div data-testid="org-webhooks">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Webhook className="w-4 h-4 text-orange-400" /> Webhooks ({webhooks.length}/10)
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">Receive real-time notifications for organization events</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-orange-600 hover:bg-orange-700 text-white" data-testid="create-webhook-btn">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <div className="text-center py-10 text-gray-600 text-sm" data-testid="no-webhooks">
          <Webhook className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No webhooks configured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-[#0a0f1a] rounded-lg border border-gray-800 overflow-hidden" data-testid={`webhook-${wh.id}`}>
              {/* Header row */}
              <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#111827] transition-colors" onClick={() => handleExpand(wh.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${wh.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-mono truncate">{wh.url}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs">{wh.events?.length || 0} events</span>
                      {wh.description && <span className="text-gray-600 text-xs">— {wh.description}</span>}
                      {wh.last_delivery_status && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[wh.last_delivery_status] || ''}`}>
                          {wh.last_delivery_status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {expandedWebhook === wh.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </div>

              {/* Expanded details */}
              {expandedWebhook === wh.id && (
                <div className="border-t border-gray-800 p-3 space-y-3">
                  {/* Event tags */}
                  <div>
                    <p className="text-gray-400 text-xs font-medium mb-1.5">SUBSCRIBED EVENTS</p>
                    <div className="flex flex-wrap gap-1">
                      {wh.events?.map(e => (
                        <span key={e} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">{e}</span>
                      ))}
                    </div>
                  </div>

                  {/* Secret & meta */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Secret: <code className="text-gray-400">{wh.secret}</code></span>
                    <span>Created: {new Date(wh.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleTest(wh.id); }} className="border-gray-700 text-gray-300 text-xs" data-testid={`test-webhook-${wh.id}`}>
                      <Send className="w-3 h-3 mr-1" /> Test
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingWebhook(wh); }} className="border-gray-700 text-gray-300 text-xs" data-testid={`edit-webhook-${wh.id}`}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleToggle(wh); }} className="border-gray-700 text-gray-300 text-xs" data-testid={`toggle-webhook-${wh.id}`}>
                      <Power className="w-3 h-3 mr-1" /> {wh.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRotateSecret(wh.id); }} className="border-gray-700 text-gray-300 text-xs" data-testid={`rotate-secret-${wh.id}`}>
                      <RotateCw className="w-3 h-3 mr-1" /> Rotate Secret
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDelete(wh.id, wh.url); }} className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs" data-testid={`delete-webhook-${wh.id}`}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>

                  {/* Delivery log */}
                  <div>
                    <p className="text-gray-400 text-xs font-medium mb-1.5">RECENT DELIVERIES</p>
                    {loadingDeliveries[wh.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    ) : (deliveries[wh.id] || []).length === 0 ? (
                      <p className="text-gray-600 text-xs">No deliveries yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {(deliveries[wh.id] || []).map(d => (
                          <div key={d.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-[#1a2332] text-xs" data-testid={`delivery-${d.id}`}>
                            {d.status === 'delivered' ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            )}
                            <span className="text-orange-400 font-mono">{d.event}</span>
                            <span className="text-gray-500">{d.response_status ? `HTTP ${d.response_status}` : d.error?.slice(0, 40)}</span>
                            <span className="text-gray-600 ml-auto flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {d.attempts} attempt{d.attempts !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || editingWebhook) && (
        <WebhookEditor
          orgId={orgId}
          token={token}
          webhook={editingWebhook}
          allEvents={events}
          onClose={() => { setShowCreate(false); setEditingWebhook(null); }}
          onSaved={() => { setShowCreate(false); setEditingWebhook(null); fetchData(); }}
        />
      )}
    </div>
  );
};


const WebhookEditor = ({ orgId, token, webhook, allEvents, onClose, onSaved }) => {
  const isEdit = !!webhook;
  const [url, setUrl] = useState(webhook?.url || '');
  const [description, setDescription] = useState(webhook?.description || '');
  const [selectedEvents, setSelectedEvents] = useState(new Set(webhook?.events || []));
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const toggleEvent = (key) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedEvents.size === allEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(allEvents.map(e => e.key)));
    }
  };

  const handleSave = async () => {
    if (!url.trim() || selectedEvents.size === 0) return;
    setSaving(true);
    try {
      const payload = { url: url.trim(), description, events: Array.from(selectedEvents) };
      if (isEdit) {
        await axios.put(`${API}/organizations/${orgId}/webhooks/${webhook.id}`, payload, { headers });
        toast({ title: 'Updated', description: 'Webhook updated.' });
      } else {
        const res = await axios.post(`${API}/organizations/${orgId}/webhooks`, payload, { headers });
        toast({ title: 'Created', description: 'Webhook created. Copy the signing secret from the details.' });
      }
      onSaved();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const categories = {};
  allEvents.forEach(e => {
    if (!categories[e.category]) categories[e.category] = [];
    categories[e.category].push(e);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="webhook-editor-modal">
      <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">{isEdit ? 'Edit Webhook' : 'Create Webhook'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-200 text-sm">Endpoint URL *</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/notarychain" className="bg-[#0a0f1a] border-gray-700 text-white mt-1 font-mono text-sm" data-testid="webhook-url-input" />
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Slack notification bot" className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="webhook-desc-input" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-200 text-sm">Events ({selectedEvents.size} selected) *</Label>
              <button onClick={selectAll} className="text-orange-400 text-xs hover:text-orange-300">{selectedEvents.size === allEvents.length ? 'Deselect all' : 'Select all'}</button>
            </div>
            <div className="space-y-2">
              {Object.entries(categories).map(([cat, evts]) => (
                <div key={cat} className="bg-[#0a0f1a] rounded-lg border border-gray-800 p-2.5">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5">{cat}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {evts.map(e => (
                      <label key={e.key} className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-200 py-0.5">
                        <input
                          type="checkbox"
                          checked={selectedEvents.has(e.key)}
                          onChange={() => toggleEvent(e.key)}
                          className="rounded border-gray-600 text-orange-500 focus:ring-orange-500 w-3 h-3"
                        />
                        {e.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !url.trim() || selectedEvents.size === 0} className="w-full bg-orange-600 hover:bg-orange-700 text-white" data-testid="save-webhook-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {isEdit ? 'Update Webhook' : 'Create Webhook'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrgWebhooks;
