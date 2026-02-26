import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import {
  FileText, Upload, Search, Download, Trash2, Eye,
  Clock, User, Tag, FolderOpen, X, Loader2, Filter,
  ChevronRight, BarChart3,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORY_LABELS = {
  contracts: 'Contracts',
  agreements: 'Agreements',
  notarized: 'Notarized',
  identity: 'Identity',
  financial: 'Financial',
  legal: 'Legal',
  other: 'Other',
};

const CATEGORY_COLORS = {
  contracts: 'bg-blue-500/15 text-blue-400',
  agreements: 'bg-green-500/15 text-green-400',
  notarized: 'bg-purple-500/15 text-purple-400',
  identity: 'bg-amber-500/15 text-amber-400',
  financial: 'bg-teal-500/15 text-teal-400',
  legal: 'bg-red-500/15 text-red-400',
  other: 'bg-gray-500/15 text-gray-400',
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const ACTION_ICONS = {
  uploaded: Upload,
  viewed: Eye,
  downloaded: Download,
  updated: FileText,
};

// --- Upload Modal ---
const UploadModal = ({ orgId, token, onClose, onUploaded }) => {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name || file.name);
    fd.append('category', category);
    fd.append('tags', tags);
    fd.append('description', description);

    try {
      await axios.post(`${API}/vault/${orgId}/documents`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: 'Uploaded', description: 'Document added to the vault.' });
      onUploaded();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="upload-modal">
      <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleUpload} className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <div>
                <FileText className="w-8 h-8 mx-auto text-blue-400 mb-2" />
                <p className="text-white text-sm">{file.name}</p>
                <p className="text-gray-500 text-xs">{formatSize(file.size)}</p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                <p className="text-gray-400 text-sm">Click to select a file</p>
                <p className="text-gray-600 text-xs">Max 25MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} data-testid="vault-file-input" />
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Document Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={file?.name || 'Document name'} className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="vault-doc-name" />
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Category</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white mt-1" data-testid="vault-category-select">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g., urgent, Q1-2026" className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="vault-tags-input" />
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Description</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description..." className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white text-sm mt-1 resize-none" data-testid="vault-description" />
          </div>
          <Button type="submit" disabled={uploading || !file} className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="vault-upload-btn">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload to Vault
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- Document Detail Modal ---
const DocDetailModal = ({ doc, orgId, token, isAdmin, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await axios.get(`${API}/vault/${orgId}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Download failed', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this document permanently?')) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/vault/${orgId}/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Deleted', description: 'Document removed from vault.' });
      onDeleted();
    } catch {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const ActionIcon = ACTION_ICONS[doc.audit_trail?.[0]?.action] || Eye;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="doc-detail-modal">
      <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#1a2332] border-b border-gray-800 p-5 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg truncate pr-4">{doc.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a0f1a] rounded-lg p-3">
              <p className="text-gray-500 text-xs">Size</p>
              <p className="text-white text-sm font-medium">{formatSize(doc.file_size)}</p>
            </div>
            <div className="bg-[#0a0f1a] rounded-lg p-3">
              <p className="text-gray-500 text-xs">Category</p>
              <p className="text-white text-sm font-medium">{CATEGORY_LABELS[doc.category] || doc.category}</p>
            </div>
            <div className="bg-[#0a0f1a] rounded-lg p-3">
              <p className="text-gray-500 text-xs">Uploaded By</p>
              <p className="text-white text-sm font-medium">{doc.uploaded_by_name || doc.uploaded_by_email}</p>
            </div>
            <div className="bg-[#0a0f1a] rounded-lg p-3">
              <p className="text-gray-500 text-xs">Uploaded</p>
              <p className="text-white text-sm font-medium">{new Date(doc.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {doc.description && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Description</p>
              <p className="text-gray-300 text-sm">{doc.description}</p>
            </div>
          )}

          {doc.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {doc.tags.map((t, i) => (
                <span key={i} className="text-xs bg-blue-500/15 text-blue-400 rounded px-2 py-0.5">{t}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {doc.view_count} views</span>
            <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {doc.download_count} downloads</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" data-testid="download-vault-doc">
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
            {isAdmin && (
              <Button onClick={handleDelete} disabled={deleting} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid="delete-vault-doc">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            )}
          </div>

          {/* Audit Trail */}
          {doc.audit_trail?.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" /> Audit Trail
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto" data-testid="audit-trail">
                {doc.audit_trail.map((entry) => {
                  const Icon = ACTION_ICONS[entry.action] || Eye;
                  return (
                    <div key={entry.id} className="flex items-start gap-2 text-xs">
                      <Icon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-gray-300">{entry.user_email}</span>
                        <span className="text-gray-500 mx-1">{entry.action}</span>
                        {entry.details && <span className="text-gray-600">- {entry.details}</span>}
                        <p className="text-gray-600">{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Vault Component ---
export const OrgVault = ({ orgId, myRole, token }) => {
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const isAdmin = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    fetchDocs();
    fetchStats();
  }, [orgId, activeCategory, searchQuery]);

  const fetchDocs = async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.append('category', activeCategory);
      if (searchQuery) params.append('search', searchQuery);
      const res = await axios.get(`${API}/vault/${orgId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
        params: Object.fromEntries(params),
      });
      setDocs(res.data.documents);
      setCategories(res.data.categories);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/vault/${orgId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch { /* ignore */ }
  };

  const openDoc = async (doc) => {
    try {
      const res = await axios.get(`${API}/vault/${orgId}/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedDoc(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load document', variant: 'destructive' });
    }
  };

  return (
    <div data-testid="vault-tab">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#0a0f1a] rounded-lg p-3 text-center">
            <p className="text-white text-lg font-bold">{stats.total_documents}</p>
            <p className="text-gray-500 text-xs">Documents</p>
          </div>
          <div className="bg-[#0a0f1a] rounded-lg p-3 text-center">
            <p className="text-white text-lg font-bold">{formatSize(stats.total_size_bytes)}</p>
            <p className="text-gray-500 text-xs">Total Size</p>
          </div>
          <div className="bg-[#0a0f1a] rounded-lg p-3 text-center">
            <p className="text-white text-lg font-bold">{Object.keys(stats.categories).length}</p>
            <p className="text-gray-500 text-xs">Categories</p>
          </div>
        </div>
      )}

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0a0f1a] border-gray-700 text-white"
            data-testid="vault-search"
          />
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUpload(true)} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="vault-upload-trigger">
            <Upload className="w-4 h-4 mr-2" /> Upload
          </Button>
        )}
      </div>

      {/* Category Filters */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            variant={activeCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(null)}
            className={activeCategory === null ? 'bg-blue-600 text-white' : 'border-gray-700 text-gray-400'}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={activeCategory === cat ? 'bg-blue-600 text-white' : 'border-gray-700 text-gray-400'}
              data-testid={`vault-filter-${cat}`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </Button>
          ))}
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12" data-testid="vault-empty">
          <FolderOpen className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No documents in the vault yet.</p>
          {isAdmin && <p className="text-gray-500 text-xs mt-1">Upload your first document to get started.</p>}
        </div>
      ) : (
        <div className="space-y-2" data-testid="vault-docs-list">
          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => openDoc(doc)}
              className="flex items-center gap-3 p-3 bg-[#0a0f1a] rounded-lg border border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
              data-testid={`vault-doc-${doc.id}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other}`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{formatSize(doc.file_size)}</span>
                  <span>&bull;</span>
                  <span>{CATEGORY_LABELS[doc.category]}</span>
                  <span>&bull;</span>
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                {doc.tags?.length > 0 && (
                  <span className="flex items-center gap-0.5"><Tag className="w-3 h-3" /> {doc.tags.length}</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          orgId={orgId}
          token={token}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); fetchDocs(); fetchStats(); }}
        />
      )}

      {/* Document Detail Modal */}
      {selectedDoc && (
        <DocDetailModal
          doc={selectedDoc}
          orgId={orgId}
          token={token}
          isAdmin={isAdmin}
          onClose={() => setSelectedDoc(null)}
          onDeleted={() => { setSelectedDoc(null); fetchDocs(); fetchStats(); }}
        />
      )}
    </div>
  );
};

export default OrgVault;
