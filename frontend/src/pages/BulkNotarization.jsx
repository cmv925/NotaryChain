import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Layers, Plus, Trash2, FileText, Send, Loader2, CheckCircle,
  ArrowLeft, Package,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DOC_TYPES = [
  'power_of_attorney', 'real_estate', 'affidavit', 'trust',
  'will', 'contract', 'deed', 'other',
];

const NOTAR_TYPES = ['ron', 'traditional', 'mobile'];

const BulkNotarization = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [batchName, setBatchName] = useState('');
  const [documents, setDocuments] = useState([
    { document_name: '', document_type: 'power_of_attorney', notarization_type: 'ron', notes: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [selectedBatch, setSelectedBatch] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchBatches = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/bulk/batches`, { headers });
      setBatches(res.data.batches || []);
    } catch { }
    setLoadingBatches(false);
  }, [token]);

  React.useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const addDocument = () => {
    if (documents.length >= 20) return;
    setDocuments(prev => [...prev, {
      document_name: '', document_type: 'power_of_attorney', notarization_type: 'ron', notes: '',
    }]);
  };

  const removeDocument = (idx) => {
    setDocuments(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDocument = (idx, field, value) => {
    setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const handleSubmit = async () => {
    if (!batchName.trim()) {
      toast({ title: 'Error', description: 'Batch name is required', variant: 'destructive' });
      return;
    }
    const validDocs = documents.filter(d => d.document_name.trim());
    if (validDocs.length === 0) {
      toast({ title: 'Error', description: 'At least one document name is required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/bulk/batches`, {
        batch_name: batchName,
        documents: validDocs,
      }, { headers });
      toast({ title: 'Batch Created', description: `${res.data.requests.length} documents submitted for notarization` });
      setView('list');
      setBatchName('');
      setDocuments([{ document_name: '', document_type: 'power_of_attorney', notarization_type: 'ron', notes: '' }]);
      fetchBatches();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed to create batch', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const viewBatchDetail = async (batchId) => {
    try {
      const res = await axios.get(`${API}/bulk/batches/${batchId}`, { headers });
      setSelectedBatch(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load batch', variant: 'destructive' });
    }
  };

  const deleteBatch = async (batchId) => {
    try {
      await axios.delete(`${API}/bulk/batches/${batchId}`, { headers });
      toast({ title: 'Deleted', description: 'Batch removed' });
      setSelectedBatch(null);
      fetchBatches();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Cannot delete', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Bulk Notarization' }]} />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                <Layers className="w-7 h-7 text-blue-400" />
                Bulk Notarization
              </h1>
              <p className="text-gray-400 text-sm mt-1">Submit multiple documents in a single batch</p>
            </div>
            <div className="flex gap-2">
              {view === 'list' && (
                <Button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-700" data-testid="create-batch-btn">
                  <Plus className="w-4 h-4 mr-1" /> New Batch
                </Button>
              )}
            </div>
          </div>

          {view === 'create' ? (
            <Card className="bg-[#1a2332] border-gray-800" data-testid="batch-create-form">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">Create Batch</h2>
                  <Button onClick={() => setView('list')} variant="ghost" className="text-gray-400">Cancel</Button>
                </div>

                <div className="mb-6">
                  <label className="text-sm text-gray-300 block mb-1">Batch Name</label>
                  <Input
                    value={batchName}
                    onChange={e => setBatchName(e.target.value)}
                    placeholder="e.g., Q1 Real Estate Closings"
                    className="bg-[#0a0f1a] border-gray-700 text-white"
                    data-testid="batch-name-input"
                  />
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-300">Documents ({documents.length}/20)</h3>
                    <Button onClick={addDocument} size="sm" variant="outline" className="border-blue-500/50 text-blue-400" disabled={documents.length >= 20} data-testid="add-document-btn">
                      <Plus className="w-3 h-3 mr-1" /> Add Document
                    </Button>
                  </div>

                  {documents.map((doc, idx) => (
                    <div key={idx} className="p-4 bg-[#0d1520] rounded-lg border border-gray-800 space-y-3" data-testid={`batch-doc-${idx}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Document #{idx + 1}</span>
                        {documents.length > 1 && (
                          <Button onClick={() => removeDocument(idx)} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-6 px-2">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <Input
                        value={doc.document_name}
                        onChange={e => updateDocument(idx, 'document_name', e.target.value)}
                        placeholder="Document name"
                        className="bg-[#1a2332] border-gray-700 text-white text-sm"
                        data-testid={`doc-name-${idx}`}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={doc.document_type}
                          onChange={e => updateDocument(idx, 'document_type', e.target.value)}
                          className="bg-[#1a2332] border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                          data-testid={`doc-type-${idx}`}
                        >
                          {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                        </select>
                        <select
                          value={doc.notarization_type}
                          onChange={e => updateDocument(idx, 'notarization_type', e.target.value)}
                          className="bg-[#1a2332] border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                          data-testid={`doc-notar-type-${idx}`}
                        >
                          {NOTAR_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 w-full" data-testid="submit-batch-btn">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Batch ({documents.filter(d => d.document_name.trim()).length} documents)
                </Button>
              </CardContent>
            </Card>
          ) : selectedBatch ? (
            <Card className="bg-[#1a2332] border-gray-800" data-testid="batch-detail">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedBatch.name}</h2>
                    <p className="text-gray-400 text-xs">{selectedBatch.total_documents} documents &middot; {new Date(selectedBatch.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => deleteBatch(selectedBatch.id)} size="sm" variant="outline" className="border-red-500/50 text-red-400" data-testid="delete-batch-btn">
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                    <Button onClick={() => setSelectedBatch(null)} size="sm" variant="outline" className="border-gray-600 text-gray-300">Back</Button>
                  </div>
                </div>

                {/* Status breakdown */}
                {selectedBatch.status_breakdown && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(selectedBatch.status_breakdown).map(([s, count]) => (
                      <span key={s} className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s === 'completed' ? 'bg-green-500/15 text-green-400' :
                        s === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                        'bg-blue-500/15 text-blue-400'
                      }`}>{count} {s}</span>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {(selectedBatch.requests || []).map(req => (
                    <div key={req.id} className="flex items-center gap-3 p-3 bg-[#0d1520] rounded-lg border border-gray-800">
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{req.document_name}</p>
                        <p className="text-xs text-gray-500">{req.document_type}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        req.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                        req.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                        'bg-blue-500/15 text-blue-400'
                      }`}>{req.status}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>
              {loadingBatches ? (
                <div className="text-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></div>
              ) : batches.length === 0 ? (
                <Card className="bg-[#1a2332] border-gray-800">
                  <CardContent className="p-12 text-center">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-4">No batches yet. Create your first bulk notarization.</p>
                    <Button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-700" data-testid="empty-create-batch">
                      <Plus className="w-4 h-4 mr-1" /> Create Batch
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3" data-testid="batch-list">
                  {batches.map(batch => (
                    <Card key={batch.id} className="bg-[#1a2332] border-gray-800 hover:border-blue-500/30 transition-colors cursor-pointer" onClick={() => viewBatchDetail(batch.id)} data-testid={`batch-item-${batch.id}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Layers className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-white font-medium">{batch.name}</p>
                            <p className="text-gray-500 text-xs">{batch.total_documents} docs &middot; {batch.completed_count || 0} completed &middot; {new Date(batch.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          batch.completed_count === batch.total_documents ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {batch.completed_count === batch.total_documents ? 'Complete' : 'In Progress'}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BulkNotarization;
