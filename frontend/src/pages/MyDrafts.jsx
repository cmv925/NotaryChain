import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  FileText, Clock, Trash2, ArrowRight, Edit, Share2,
  Loader2,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MyDrafts = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchDrafts();
  }, [token]);

  const fetchDrafts = async () => {
    try {
      const res = await axios.get(`${API}/drafts/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDrafts(res.data.drafts);
    } catch {
      toast({ title: 'Error', description: 'Failed to load drafts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (draftId) => {
    if (!window.confirm('Delete this draft?')) return;
    try {
      await axios.delete(`${API}/drafts/${draftId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDrafts(drafts.filter(d => d.id !== draftId));
      toast({ title: 'Deleted', description: 'Draft deleted.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const filledFieldsCount = (draft) => {
    return Object.values(draft.field_values || {}).filter(v => v?.trim()).length;
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="my-drafts-title">My Drafts</h1>
              <p className="text-gray-400 text-sm mt-1">Resume your saved template drafts</p>
            </div>
            <Button onClick={() => navigate('/templates')} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="browse-templates-btn">
              Browse Templates
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></div>
          ) : drafts.length === 0 ? (
            <Card className="bg-[#1a2332] border-gray-800">
              <CardContent className="p-10 text-center">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No drafts yet</p>
                <p className="text-gray-500 text-sm mb-4">Start from a template and save your progress as a draft.</p>
                <Button onClick={() => navigate('/templates')} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Browse Templates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="drafts-list">
              {drafts.map((draft) => (
                <Card key={draft.id} className="bg-[#1a2332] border-gray-800 hover:border-gray-700 transition-all" data-testid={`draft-${draft.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{draft.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(draft.updated_at).toLocaleDateString()}
                        </span>
                        <span>v{draft.version}</span>
                        <span>{filledFieldsCount(draft)} fields filled</span>
                        {draft.share_token && (
                          <span className="flex items-center gap-1 text-purple-400">
                            <Share2 className="w-3 h-3" /> Shared
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/templates/${draft.template_id}/fill?draft=${draft.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid={`resume-draft-${draft.id}`}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" /> Resume
                      </Button>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="text-gray-500 hover:text-red-400 p-1.5"
                        data-testid={`delete-draft-${draft.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MyDrafts;
