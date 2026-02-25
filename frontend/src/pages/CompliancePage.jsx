import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { NotificationBell } from '../components/NotificationBell';
import {
  ArrowLeft, Shield, Download, Trash2, Eye, EyeOff,
  AlertTriangle, CheckCircle, Clock, Lock
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompliancePage = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [privacy, setPrivacy] = useState(null);
  const [deletionStatus, setDeletionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    Promise.all([fetchPrivacy(), fetchDeletionStatus()]).finally(() => setLoading(false));
  }, []);

  const fetchPrivacy = async () => {
    try {
      const res = await axios.get(`${API}/gdpr/privacy`, { headers });
      setPrivacy(res.data.privacy_settings);
    } catch {}
  };

  const fetchDeletionStatus = async () => {
    try {
      const res = await axios.get(`${API}/gdpr/deletion-request/status`, { headers });
      setDeletionStatus(res.data);
    } catch {}
  };

  const handlePrivacyToggle = async (key) => {
    const updated = { ...privacy, [key]: !privacy[key] };
    setPrivacy(updated);
    setSavingPrivacy(true);
    try {
      await axios.put(`${API}/gdpr/privacy`, updated, { headers });
      toast({ title: 'Updated', description: 'Privacy settings saved' });
    } catch {
      setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    }
    setSavingPrivacy(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await axios.post(`${API}/gdpr/export`, {}, {
        headers,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `notarychain_export_${user?.email}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export Complete', description: 'Your data has been downloaded' });
    } catch {
      toast({ title: 'Export Failed', description: 'Could not export your data', variant: 'destructive' });
    }
    setExporting(false);
  };

  const handleDeleteRequest = async () => {
    if (!deletePassword) {
      toast({ title: 'Password Required', description: 'Enter your password to confirm', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      const res = await axios.post(`${API}/gdpr/deletion-request`, {
        password: deletePassword,
        reason: deleteReason || undefined,
      }, { headers });
      toast({ title: 'Deletion Scheduled', description: `Your account will be deleted on ${new Date(res.data.scheduled_deletion_at).toLocaleDateString()}` });
      setShowDeleteConfirm(false);
      setDeletePassword('');
      setDeleteReason('');
      fetchDeletionStatus();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to request deletion', variant: 'destructive' });
    }
    setDeleting(false);
  };

  const handleCancelDeletion = async () => {
    setCancelling(true);
    try {
      await axios.post(`${API}/gdpr/deletion-request/cancel`, {}, { headers });
      toast({ title: 'Cancellation Complete', description: 'Your account deletion has been cancelled' });
      fetchDeletionStatus();
    } catch {
      toast({ title: 'Error', description: 'Failed to cancel deletion', variant: 'destructive' });
    }
    setCancelling(false);
  };

  const privacyOptions = [
    { key: 'analytics_tracking', label: 'Analytics Tracking', desc: 'Allow usage analytics to improve our services', icon: Eye },
    { key: 'marketing_emails', label: 'Marketing Emails', desc: 'Receive product updates and promotional emails', icon: Eye },
    { key: 'data_sharing', label: 'Data Sharing', desc: 'Share anonymized data with trusted partners', icon: Eye },
    { key: 'activity_visible', label: 'Activity Visibility', desc: 'Show your activity status to other platform users', icon: Eye },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5 sm:mr-2" /><span className="hidden sm:inline">Dashboard</span>
              </Button>
              <h1 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Shield className="w-5 h-5 text-[#00d4aa]" /> Privacy & Compliance
              </h1>
            </div>
            <NotificationBell token={token} />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Pending Deletion Banner */}
        {deletionStatus?.has_pending_request && (
          <Card className="bg-red-500/10 border-red-500/30" data-testid="deletion-banner">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-300 font-medium">Account Deletion Scheduled</p>
                <p className="text-red-400/70 text-sm">
                  Your account will be permanently deleted on{' '}
                  {new Date(deletionStatus.request.scheduled_deletion_at).toLocaleDateString()}.
                  You can cancel this before the scheduled date.
                </p>
              </div>
              <Button
                onClick={handleCancelDeletion}
                disabled={cancelling}
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white"
                data-testid="cancel-deletion-btn"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Deletion'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Privacy Settings */}
        <Card className="bg-[#1a2332] border-gray-800" data-testid="privacy-settings-card">
          <CardContent className="p-6">
            <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-400" /> Privacy Settings
            </h2>
            <p className="text-gray-500 text-sm mb-5">Control how your data is used on the platform</p>
            <div className="space-y-4">
              {privacyOptions.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{label}</p>
                    <p className="text-gray-500 text-xs">{desc}</p>
                  </div>
                  <button
                    onClick={() => handlePrivacyToggle(key)}
                    disabled={savingPrivacy}
                    className={`w-11 h-6 rounded-full relative transition-colors ${privacy?.[key] ? 'bg-[#00d4aa]' : 'bg-gray-700'}`}
                    data-testid={`privacy-toggle-${key}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${privacy?.[key] ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card className="bg-[#1a2332] border-gray-800" data-testid="data-export-card">
          <CardContent className="p-6">
            <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
              <Download className="w-5 h-5 text-[#00d4aa]" /> Data Export
            </h2>
            <p className="text-gray-500 text-sm mb-4">Download a copy of all your data (GDPR Article 20 - Right to Data Portability)</p>
            <div className="bg-[#0d1b2a] rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-2">Your export will include:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {['Profile Information', 'Notarization Requests', 'Document Seals', 'Notifications', 'Subscriptions', 'Transactions', 'Journal Entries', 'Audit Activity'].map(item => (
                  <div key={item} className="flex items-center gap-1.5 text-gray-300">
                    <CheckCircle className="w-3 h-3 text-[#00d4aa]" />{item}
                  </div>
                ))}
              </div>
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-[#00d4aa] hover:bg-[#00b894] text-black"
              data-testid="export-data-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Preparing Export...' : 'Download My Data'}
            </Button>
          </CardContent>
        </Card>

        {/* Account Deletion */}
        {!deletionStatus?.has_pending_request && (
          <Card className="bg-[#1a2332] border-red-500/20" data-testid="delete-account-card">
            <CardContent className="p-6">
              <h2 className="text-red-400 font-semibold mb-1 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Delete Account
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Request permanent deletion of your account and all associated data (GDPR Article 17 - Right to Erasure).
                A 30-day grace period applies during which you can cancel.
              </p>

              {!showDeleteConfirm ? (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  data-testid="request-deletion-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Request Account Deletion
                </Button>
              ) : (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-3" data-testid="deletion-confirm-form">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">This action cannot be undone after the 30-day grace period. All your data will be permanently removed.</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Password *</label>
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      placeholder="Enter your password to confirm"
                      className="bg-[#0d1b2a] border-gray-700 text-white"
                      data-testid="deletion-password-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Reason (optional)</label>
                    <textarea
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      placeholder="Why are you leaving?"
                      className="w-full bg-[#0d1b2a] border border-gray-700 text-white text-sm rounded-md px-3 py-2 h-16 resize-none"
                      data-testid="deletion-reason-input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteReason(''); }}
                      variant="ghost"
                      className="text-gray-400"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteRequest}
                      disabled={deleting || !deletePassword}
                      className="bg-red-500 hover:bg-red-600 text-white"
                      data-testid="confirm-deletion-btn"
                    >
                      {deleting ? 'Processing...' : 'Confirm Deletion'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CompliancePage;
