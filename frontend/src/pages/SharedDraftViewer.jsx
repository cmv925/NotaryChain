import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import {
  FileText, Share2, Lock, Edit, Save, Loader2, CheckCircle,
  ArrowRight, Send, AlertTriangle,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { toast } from '../hooks/use-toast';
import { useDraftCollaboration } from '../hooks/useDraftCollaboration';
import { PresenceBar, FieldCollabIndicator } from '../components/CollaborationPresence';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SharedDraftViewer = () => {
  const { shareToken } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fieldValues, setFieldValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);
  const typingTimeouts = useRef({});

  // Real-time collaboration - connect using draft ID once loaded
  const collab = useDraftCollaboration(draft?.id, token);

  useEffect(() => {
    if (token && shareToken) fetchSharedDraft();
  }, [token, shareToken]);

  // Handle remote edits from collaborators
  useEffect(() => {
    if (!collab.remoteEdits) return;
    const { field, value, user_name } = collab.remoteEdits;
    setFieldValues(prev => {
      if (prev[field] !== value) {
        setConflictWarning(`${user_name} updated "${field.replace(/_/g, ' ')}"`);
        setTimeout(() => setConflictWarning(null), 4000);
        return { ...prev, [field]: value };
      }
      return prev;
    });
  }, [collab.remoteEdits]);

  const fetchSharedDraft = async () => {
    try {
      const res = await axios.get(`${API}/drafts/shared/${shareToken}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDraft(res.data);
      setFieldValues(res.data.field_values || {});
    } catch {
      toast({ title: 'Error', description: 'Shared draft not found or link expired.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (name, value) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
    setSaved(false);

    // Send live collaboration updates
    if (collab.connected && draft?.allow_edit) {
      collab.sendFieldUpdate(name, value);
      collab.sendTyping(name, true);

      // Clear previous timeout for this field
      if (typingTimeouts.current[name]) {
        clearTimeout(typingTimeouts.current[name]);
      }
      typingTimeouts.current[name] = setTimeout(() => {
        collab.sendTyping(name, false);
      }, 2000);
    }
  };

  const handleFieldFocus = (name) => {
    if (collab.connected) {
      collab.sendCursor(name);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/drafts/shared/${shareToken}`, {
        field_values: fieldValues,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSaved(true);
      toast({ title: 'Saved', description: 'Changes saved to the shared draft.' });
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Cannot save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#0f1825]">
        <Navbar />
        <div className="pt-32 text-center">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Shared Draft' }]} />
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">This shared draft was not found or the link has expired.</p>
          <Button onClick={() => navigate('/templates')} className="mt-4 bg-blue-600 text-white">
            Browse Templates
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Shared Draft' }]} />
          {/* Shared Banner */}
          <div className="mb-6 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center gap-2" data-testid="shared-draft-banner">
            <Share2 className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 text-sm">
              Shared by <strong className="text-white">{draft.owner_email}</strong>
              {draft.allow_edit ? (
                <span className="ml-1 text-green-400">&bull; You can edit</span>
              ) : (
                <span className="ml-1 text-gray-500">&bull; View only</span>
              )}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1" data-testid="shared-draft-title">{draft.name}</h1>
          <p className="text-gray-400 text-sm mb-4">Template: {draft.template_name} &bull; Version {draft.version}</p>

          {/* Collaboration Presence Bar */}
          <div className="mb-4">
            <PresenceBar
              users={collab.users}
              connected={collab.connected}
              currentUserId={user?.id}
            />
          </div>

          {/* Conflict Warning */}
          {conflictWarning && (
            <div className="mb-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 animate-in fade-in" data-testid="conflict-warning">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-amber-300 text-sm">{conflictWarning}</span>
            </div>
          )}

          <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
            <CardContent className="p-6">
              <div className="space-y-4" data-testid="shared-draft-fields">
                {Object.entries(fieldValues).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-gray-300 text-sm capitalize">{key.replace(/_/g, ' ')}</Label>
                    <FieldCollabIndicator
                      fieldName={key}
                      cursors={collab.cursors}
                      typingUsers={collab.typingUsers}
                      currentUserId={user?.id}
                    />
                    {draft.allow_edit ? (
                      value && value.length > 100 ? (
                        <textarea
                          value={value}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          onFocus={() => handleFieldFocus(key)}
                          rows={3}
                          className="w-full mt-1 bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
                          data-testid={`shared-field-${key}`}
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          onFocus={() => handleFieldFocus(key)}
                          className="bg-[#0a0f1a] border-gray-700 text-white mt-1"
                          data-testid={`shared-field-${key}`}
                        />
                      )
                    ) : (
                      <p className="text-white text-sm mt-1 bg-[#0a0f1a] rounded-md px-3 py-2 border border-gray-800" data-testid={`shared-field-${key}`}>
                        {value || <span className="text-gray-600 italic">Empty</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {draft.allow_edit && (
                <div className="mt-6 flex items-center gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="save-shared-changes"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {saved ? 'Saved' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SharedDraftViewer;
