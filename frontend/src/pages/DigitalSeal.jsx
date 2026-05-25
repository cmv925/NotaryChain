import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { NotificationBell } from '../components/NotificationBell';
import {
  ArrowLeft, Upload, Trash2, CheckCircle, Image, Shield, AlertCircle
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DigitalSeal = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const fileRef = useRef(null);

  const [seals, setSeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  useEffect(() => { fetchSeals(); }, []);

  const fetchSeals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/notary/professional/seals`, { headers });
      setSeals(res.data.seals || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load seals', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
      toast({ title: 'Invalid File', description: 'Upload PNG, JPG, or SVG only', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Maximum file size is 2MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await axios.post(`${API}/notary/professional/seals/upload`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: 'Seal Uploaded', description: 'Your new seal has been set as active' });
      fetchSeals();
    } catch (err) {
      toast({ title: 'Upload Failed', description: err.response?.data?.detail || 'Could not upload seal', variant: 'destructive' });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleActivate = async (sealId) => {
    try {
      await axios.post(`${API}/notary/professional/seals/${sealId}/activate`, {}, { headers });
      toast({ title: 'Seal Activated' });
      fetchSeals();
    } catch {
      toast({ title: 'Error', description: 'Failed to activate seal', variant: 'destructive' });
    }
  };

  const handleDelete = async (sealId) => {
    setDeleting(sealId);
    try {
      await axios.delete(`${API}/notary/professional/seals/${sealId}`, { headers });
      toast({ title: 'Seal Deleted' });
      fetchSeals();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete seal', variant: 'destructive' });
    }
    setDeleting(null);
  };

  const activeSeal = seals.find(s => s.is_active);

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/notary/dashboard')} className="text-slate-500 hover:text-navy-900">
                <ArrowLeft className="w-5 h-5 sm:mr-2" /><span className="hidden sm:inline">Dashboard</span>
              </Button>
              <h1 className="text-navy-900 font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Shield className="w-5 h-5 text-coral-600" /> Digital Seal
              </h1>
            </div>
            <NotificationBell token={token} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Active Seal Display */}
        <Card className="bg-white border-slate-200" data-testid="active-seal-card">
          <CardContent className="p-6">
            <h2 className="text-navy-900 font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-coral-600" /> Active Seal
            </h2>
            {activeSeal ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-40 h-40 bg-cream-100 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                  <span className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs text-center pointer-events-none">Preview unavailable</span>
                  <img
                    src={`${process.env.REACT_APP_BACKEND_URL}/api/notary/professional/seals/${activeSeal.id}/file`}
                    alt="Active Seal"
                    className="relative max-w-full max-h-full object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    data-testid="active-seal-image"
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-500">File: <span className="text-navy-900">{activeSeal.original_name}</span></p>
                  <p className="text-slate-500">Type: <span className="text-navy-900 uppercase">{activeSeal.file_type?.replace('.', '')}</span></p>
                  <p className="text-slate-500">Uploaded: <span className="text-navy-900">{new Date(activeSeal.created_at).toLocaleDateString()}</span></p>
                  <Badge className="bg-coral-500/20 text-coral-600 border-coral-500/30">Active</Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-20 h-20 bg-cream-100 rounded-full flex items-center justify-center mb-4">
                  <Image className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-500 mb-1">No active seal</p>
                <p className="text-slate-600 text-xs">Upload a digital seal image to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <h2 className="text-navy-900 font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-coral-500" /> Upload New Seal
            </h2>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-coral-500/50 transition-colors">
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                onChange={handleUpload}
                className="hidden"
                id="seal-upload"
                data-testid="seal-file-input"
              />
              <label htmlFor="seal-upload" className="cursor-pointer">
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-500 mb-1">{uploading ? 'Uploading...' : 'Click to upload your digital seal'}</p>
                <p className="text-slate-600 text-xs">PNG, JPG, or SVG - Max 2MB</p>
              </label>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-slate-500 text-xs">Uploading a new seal will automatically set it as your active seal. You can switch between seals at any time.</p>
            </div>
          </CardContent>
        </Card>

        {/* All Seals */}
        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <h2 className="text-navy-900 font-semibold mb-4">All Seals ({seals.length})</h2>
            {loading ? (
              <p className="text-slate-500 text-center py-6">Loading seals...</p>
            ) : seals.length === 0 ? (
              <p className="text-slate-500 text-center py-6">No seals uploaded yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="seals-grid">
                {seals.map(seal => (
                  <div key={seal.id} className={`bg-cream-100 rounded-lg border p-4 ${seal.is_active ? 'border-coral-500/50' : 'border-slate-200'}`} data-testid={`seal-card-${seal.id}`}>
                    <div className="relative w-full h-28 bg-cream-100 rounded mb-3 flex items-center justify-center overflow-hidden">
                      <span className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs pointer-events-none">No preview</span>
                      <img
                        src={`${process.env.REACT_APP_BACKEND_URL}/api/notary/professional/seals/${seal.id}/file`}
                        alt={seal.original_name}
                        className="relative max-w-full max-h-full object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    <p className="text-navy-900 text-sm font-medium truncate">{seal.original_name}</p>
                    <p className="text-slate-500 text-xs mb-3">{new Date(seal.created_at).toLocaleDateString()}</p>
                    <div className="flex items-center gap-2">
                      {seal.is_active ? (
                        <Badge className="bg-coral-500/20 text-coral-600 text-xs border-coral-500/30">Active</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleActivate(seal.id)} className="border-slate-200 text-slate-500 hover:text-navy-900 text-xs h-7" data-testid={`activate-seal-${seal.id}`}>
                          Set Active
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(seal.id)} disabled={deleting === seal.id} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto h-7" data-testid={`delete-seal-${seal.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DigitalSeal;
