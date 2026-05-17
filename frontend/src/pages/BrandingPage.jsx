import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Palette, Upload, Loader2, Eye } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BrandingPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/branding/`, { headers: { Authorization: `Bearer ${token}` } });
      setBranding(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchBranding(); }, [fetchBranding]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/branding/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(branding),
      });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const uploadLogo = async (file) => {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API}/api/branding/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      setBranding((p) => ({ ...p, logo_url: data.logo_url }));
    } catch { /* ignore */ }
    setUploading(false);
  };

  const update = (key, value) => setBranding((p) => ({ ...p, [key]: value }));

  if (loading) return <div className="min-h-screen bg-[#030712] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>;

  return (
    <div className="min-h-screen bg-[#030712] text-navy-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Palette className="w-6 h-6 text-pink-400" />
              Custom Branding
            </h1>
            <p className="text-gray-400 text-sm">Personalize your organization's appearance</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Logo */}
          <Card className="bg-[#0d1b2a] border-gray-800" data-testid="logo-section">
            <CardHeader><CardTitle className="text-base text-navy-900">Logo</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-xl bg-[#1a2332] border border-gray-700 flex items-center justify-center overflow-hidden">
                {branding?.logo_url
                  ? <img src={`${API}${branding.logo_url}`} alt="Logo" className="w-full h-full object-contain" />
                  : <Palette className="w-8 h-8 text-gray-600" />}
              </div>
              <div>
                <label className="cursor-pointer">
                  <Button variant="outline" className="border-gray-700 text-gray-300" asChild>
                    <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}Upload Logo</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} data-testid="logo-upload" />
                </label>
                <p className="text-gray-600 text-xs mt-1">PNG, JPG, or SVG. Max 2MB.</p>
              </div>
            </CardContent>
          </Card>

          {/* Display Name & Tagline */}
          <Card className="bg-[#0d1b2a] border-gray-800" data-testid="identity-section">
            <CardHeader><CardTitle className="text-base text-navy-900">Identity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Display Name</label>
                <Input value={branding?.display_name || ''} onChange={(e) => update('display_name', e.target.value)} placeholder="Your Company Name" className="bg-[#1a2332] border-gray-700 text-navy-900" data-testid="display-name" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Tagline</label>
                <Input value={branding?.tagline || ''} onChange={(e) => update('tagline', e.target.value)} placeholder="Trusted Digital Notarization" className="bg-[#1a2332] border-gray-700 text-navy-900" data-testid="tagline" />
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card className="bg-[#0d1b2a] border-gray-800" data-testid="colors-section">
            <CardHeader><CardTitle className="text-base text-navy-900">Brand Colors</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'primary_color', label: 'Primary Color' },
                { key: 'accent_color', label: 'Accent Color' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={branding?.[key] || '#00d4aa'}
                    onChange={(e) => update(key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer bg-transparent"
                    data-testid={key}
                  />
                  <div className="flex-1">
                    <p className="text-navy-900 text-sm">{label}</p>
                    <p className="text-gray-500 text-xs">{branding?.[key] || '#00d4aa'}</p>
                  </div>
                  <div className="w-24 h-8 rounded-md" style={{ backgroundColor: branding?.[key] || '#00d4aa' }} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="border-2" style={{ borderColor: branding?.primary_color || '#00d4aa' }} data-testid="preview-section">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3 mb-4">
                {branding?.logo_url && <img src={`${API}${branding.logo_url}`} alt="" className="w-8 h-8 rounded" />}
                <div>
                  <p className="font-bold" style={{ color: branding?.primary_color || '#00d4aa' }}>{branding?.display_name || 'Your Brand'}</p>
                  <p className="text-gray-500 text-xs">{branding?.tagline || 'Your tagline here'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="px-4 py-2 rounded-md text-sm text-navy-900" style={{ backgroundColor: branding?.primary_color || '#00d4aa' }}>Primary Button</div>
                <div className="px-4 py-2 rounded-md text-sm text-navy-900" style={{ backgroundColor: branding?.accent_color || '#0ea5e9' }}>Accent Button</div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={save} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="save-branding">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {saving ? 'Saving...' : 'Save Branding'}
          </Button>
        </div>
      </div>
    </div>
  );
}
