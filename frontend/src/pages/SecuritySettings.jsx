import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ShieldCheck, ShieldOff, Copy, ArrowLeft, RefreshCw, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { NotificationBell } from '../components/NotificationBell';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SecuritySettings = () => {
  const { user, token, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [twoFAStatus, setTwoFAStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null);
  const [step, setStep] = useState('status'); // status | setup | verify | disable
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRefs = useRef([]);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetch2FAStatus(); }, []);

  const fetch2FAStatus = async () => {
    try {
      const res = await axios.get(`${API}/auth/2fa/status`, { headers });
      setTwoFAStatus(res.data);
    } catch { toast({ title: 'Error', description: 'Failed to load 2FA status', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const startSetup = async () => {
    setActionLoading(true);
    try {
      const res = await axios.post(`${API}/auth/2fa/enable`, {}, { headers });
      setSetupData(res.data);
      setBackupCodes(res.data.backup_codes);
      setStep('setup');
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to start 2FA setup', variant: 'destructive' });
    }
    setActionLoading(false);
  };

  const verifySetup = async (e) => {
    e?.preventDefault();
    const code = verifyCode.join('');
    if (code.length < 6) return;
    setActionLoading(true);
    try {
      await axios.post(`${API}/auth/2fa/verify-setup`, { code }, { headers });
      toast({ title: '2FA Enabled', description: 'Two-factor authentication is now active' });
      setStep('status');
      fetch2FAStatus();
      refreshUser();
    } catch (err) {
      toast({ title: 'Verification Failed', description: err.response?.data?.detail || 'Invalid code', variant: 'destructive' });
      setVerifyCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    setActionLoading(false);
  };

  const disable2FA = async (e) => {
    e?.preventDefault();
    if (!disableCode || !disablePassword) return;
    setActionLoading(true);
    try {
      await axios.post(`${API}/auth/2fa/disable`, { code: disableCode, password: disablePassword }, { headers });
      toast({ title: '2FA Disabled', description: 'Two-factor authentication has been removed' });
      setStep('status');
      setDisableCode('');
      setDisablePassword('');
      fetch2FAStatus();
      refreshUser();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to disable 2FA', variant: 'destructive' });
    }
    setActionLoading(false);
  };

  const regenerateBackupCodes = async () => {
    const code = prompt('Enter your current 2FA code to regenerate backup codes:');
    if (!code) return;
    setActionLoading(true);
    try {
      const res = await axios.post(`${API}/auth/2fa/regenerate-backup-codes`, { code }, { headers });
      setBackupCodes(res.data.backup_codes);
      setShowBackupCodes(true);
      toast({ title: 'Backup Codes Regenerated', description: 'Your old backup codes are no longer valid' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to regenerate codes', variant: 'destructive' });
    }
    setActionLoading(false);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast({ title: 'Copied', description: 'Backup codes copied to clipboard' });
  };

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...verifyCode];
    newCode[index] = value.slice(-1);
    setVerifyCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (value && index === 5 && newCode.every(d => d !== '')) setTimeout(() => verifySetup(), 100);
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleCodePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...verifyCode];
      pasted.split('').forEach((char, i) => { newCode[i] = char; });
      setVerifyCode(newCode);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
      if (pasted.length === 6) setTimeout(() => verifySetup(), 100);
      e.preventDefault();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <div className="text-white text-xl">Loading security settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825]">
      {/* Header */}
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white" data-testid="back-to-dashboard">
                <ArrowLeft className="w-5 h-5 mr-2" /> Dashboard
              </Button>
              <span className="text-gray-600">|</span>
              <h1 className="text-white font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" /> Security Settings
              </h1>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{user?.full_name}</div>
              <div className="text-gray-400 text-xs">{user?.email}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 2FA Status Card */}
        {step === 'status' && (
          <Card className="bg-[#1a2332] border-gray-800" data-testid="2fa-status-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-6">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${twoFAStatus?.enabled ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                  {twoFAStatus?.enabled ? (
                    <ShieldCheck className="w-8 h-8 text-green-400" />
                  ) : (
                    <Shield className="w-8 h-8 text-yellow-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white mb-1">Two-Factor Authentication</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    {twoFAStatus?.enabled
                      ? 'Your account is protected with an authenticator app.'
                      : 'Add an extra layer of security to your account by enabling 2FA.'}
                  </p>

                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${twoFAStatus?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`} data-testid="2fa-status-badge">
                    {twoFAStatus?.enabled ? 'Enabled' : 'Not Enabled'}
                  </div>

                  {twoFAStatus?.enabled && twoFAStatus?.enabled_at && (
                    <p className="text-gray-500 text-xs mt-2">
                      Enabled on {new Date(twoFAStatus.enabled_at).toLocaleDateString()}
                    </p>
                  )}

                  <div className="mt-6 flex gap-3">
                    {twoFAStatus?.enabled ? (
                      <>
                        <Button onClick={() => setStep('disable')} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid="disable-2fa-button">
                          <ShieldOff className="w-4 h-4 mr-2" /> Disable 2FA
                        </Button>
                        <Button onClick={regenerateBackupCodes} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" disabled={actionLoading} data-testid="regenerate-backup-codes-button">
                          <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Backup Codes
                        </Button>
                      </>
                    ) : (
                      <Button onClick={startSetup} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={actionLoading} data-testid="enable-2fa-button">
                        <ShieldCheck className="w-4 h-4 mr-2" /> Enable 2FA
                      </Button>
                    )}
                  </div>

                  {twoFAStatus?.enabled && twoFAStatus?.backup_codes_remaining !== undefined && (
                    <p className="text-gray-500 text-xs mt-4">
                      <KeyRound className="w-3 h-3 inline mr-1" />
                      {twoFAStatus.backup_codes_remaining} backup codes remaining
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Step */}
        {step === 'setup' && setupData && (
          <Card className="bg-[#1a2332] border-gray-800" data-testid="2fa-setup-card">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold text-white mb-2">Set Up Two-Factor Authentication</h2>
              <p className="text-gray-400 text-sm mb-6">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>

              <div className="flex flex-col lg:flex-row gap-8">
                {/* QR Code */}
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl mb-3">
                    <img src={setupData.qr_code} alt="2FA QR Code" className="w-48 h-48" data-testid="2fa-qr-code" />
                  </div>
                  <p className="text-gray-500 text-xs text-center max-w-[250px]">
                    Can't scan? Enter this key manually:
                  </p>
                  <code className="mt-1 text-xs bg-[#0a0f1a] text-blue-400 px-3 py-1.5 rounded border border-gray-700 select-all" data-testid="2fa-secret-key">
                    {setupData.secret}
                  </code>
                </div>

                {/* Backup Codes */}
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-yellow-400" /> Backup Codes
                  </h3>
                  <p className="text-gray-400 text-xs mb-3">Save these codes in a safe place. Each can be used once if you lose access to your authenticator.</p>
                  <div className="grid grid-cols-2 gap-2 mb-3" data-testid="backup-codes-list">
                    {backupCodes.map((code, i) => (
                      <div key={i} className="bg-[#0a0f1a] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300">{code}</div>
                    ))}
                  </div>
                  <Button onClick={copyBackupCodes} variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800" data-testid="copy-backup-codes">
                    <Copy className="w-3 h-3 mr-2" /> Copy All
                  </Button>
                </div>
              </div>

              {/* Verify Step */}
              <div className="mt-8 pt-6 border-t border-gray-800">
                <h3 className="text-white font-semibold mb-2">Verify Setup</h3>
                <p className="text-gray-400 text-sm mb-4">Enter the 6-digit code from your authenticator app to confirm setup.</p>
                <form onSubmit={verifySetup} className="flex flex-col items-center gap-4" data-testid="2fa-verify-setup-form">
                  <div className="flex gap-2" onPaste={handleCodePaste}>
                    {verifyCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={el => inputRefs.current[index] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        className="w-12 h-14 text-center text-xl font-bold bg-[#0a0f1a] border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        disabled={actionLoading}
                        data-testid={`2fa-setup-code-input-${index}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="ghost" onClick={() => { setStep('status'); setSetupData(null); setVerifyCode(['','','','','','']); }} className="text-gray-400" data-testid="2fa-setup-cancel">
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading || verifyCode.join('').length < 6} data-testid="2fa-setup-verify">
                      {actionLoading ? 'Verifying...' : 'Verify & Enable'}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Disable Step */}
        {step === 'disable' && (
          <Card className="bg-[#1a2332] border-gray-800" data-testid="2fa-disable-card">
            <CardContent className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldOff className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Disable Two-Factor Authentication</h2>
                  <p className="text-gray-400 text-sm">This will remove the extra security layer from your account. Enter your password and a current 2FA code to confirm.</p>
                </div>
              </div>

              <form onSubmit={disable2FA} className="space-y-4 max-w-md" data-testid="2fa-disable-form">
                <div>
                  <label className="text-white text-sm block mb-1.5">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      className="bg-[#0a0f1a] border-gray-700 text-white pr-10"
                      placeholder="Enter your password"
                      required
                      data-testid="disable-2fa-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-white text-sm block mb-1.5">2FA Code</label>
                  <Input
                    type="text"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="bg-[#0a0f1a] border-gray-700 text-white"
                    placeholder="Enter 6-digit code"
                    required
                    inputMode="numeric"
                    data-testid="disable-2fa-code"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => { setStep('status'); setDisablePassword(''); setDisableCode(''); }} className="text-gray-400" data-testid="disable-2fa-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={actionLoading || !disablePassword || disableCode.length < 6} data-testid="disable-2fa-confirm">
                    {actionLoading ? 'Disabling...' : 'Disable 2FA'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Backup codes modal (after regeneration) */}
        {showBackupCodes && backupCodes.length > 0 && step === 'status' && (
          <Card className="bg-[#1a2332] border-gray-800 mt-6" data-testid="new-backup-codes-card">
            <CardContent className="p-8">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-yellow-400" /> New Backup Codes
              </h3>
              <p className="text-gray-400 text-sm mb-4">Save these codes. Your previous backup codes are no longer valid.</p>
              <div className="grid grid-cols-2 gap-2 mb-4" data-testid="new-backup-codes-list">
                {backupCodes.map((code, i) => (
                  <div key={i} className="bg-[#0a0f1a] border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-gray-300">{code}</div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={copyBackupCodes} variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                  <Copy className="w-3 h-3 mr-2" /> Copy All
                </Button>
                <Button onClick={() => setShowBackupCodes(false)} variant="ghost" size="sm" className="text-gray-400">
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SecuritySettings;
