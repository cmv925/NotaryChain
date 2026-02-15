import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, FileText, Clock, TrendingUp, LogOut, Upload, ExternalLink, Copy, Video, Play } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_seals: 0, recent_seals: 0 });
  const [documents, setDocuments] = useState([]);
  const [notaryRequests, setNotaryRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, docsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/documents/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/documents/seals?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/notary/requests/my`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: [] })), // Gracefully handle if no requests
      ]);

      setStats(statsRes.data);
      setDocuments(docsRes.data);
      setNotaryRequests(requestsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out',
    });
    navigate('/');
  };

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: 'Copied!',
      description: 'Hash copied to clipboard',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825]">
      {/* Header */}
      <header className="bg-[#1a2332] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                <Shield className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold text-white">
                  Notary<span className="text-blue-500">Chain</span>
                </span>
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-gray-400">Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-white font-semibold">{user?.full_name}</div>
                <div className="text-gray-400 text-sm">{user?.email}</div>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-red-500"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-600/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Seals</p>
                  <p className="text-4xl font-bold text-white">{stats.total_seals}</p>
                </div>
                <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-600/20 to-green-600/10 border-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Last 30 Days</p>
                  <p className="text-4xl font-bold text-white">{stats.recent_seals}</p>
                </div>
                <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600/20 to-purple-600/10 border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Member Since</p>
                  <p className="text-xl font-bold text-white">
                    {new Date(stats.user_since).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
                <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Clock className="w-7 h-7 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => navigate('/demo')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-6 text-lg justify-start"
            >
              <Upload className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Quick Seal</div>
                <div className="text-sm text-blue-200">Instant blockchain timestamp</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/request-notarization')}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-6 text-lg justify-start"
            >
              <FileText className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Request Notarization</div>
                <div className="text-sm text-green-200">Full notary service</div>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/notary/onboarding')}
              variant="outline"
              className="border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 px-6 py-6 text-lg justify-start"
            >
              <Shield className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Become a Notary</div>
                <div className="text-sm text-purple-300">Join our network</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Recent Documents */}
        <Card className="bg-[#1a2332] border-gray-800">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Document Seals</h2>

            {documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-4">No documents sealed yet</p>
                <Button
                  onClick={() => navigate('/demo')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Seal Your First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-[#0a0f1a] rounded-lg p-5 border border-gray-800 hover:border-blue-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold mb-1">{doc.file_name}</h3>
                          <p className="text-gray-400 text-sm mb-3">
                            {doc.file_size} • {new Date(doc.timestamp).toLocaleString()}
                          </p>
                          
                          <div className="space-y-2">
                            <div>
                              <label className="text-gray-500 text-xs block mb-1">SHA-256 Hash</label>
                              <div className="flex items-center gap-2">
                                <code className="text-blue-400 text-xs bg-[#1a2332] px-2 py-1 rounded flex-1 overflow-hidden overflow-ellipsis">
                                  {doc.sha256_hash}
                                </code>
                                <button
                                  onClick={() => copyHash(doc.sha256_hash)}
                                  className="text-gray-400 hover:text-white p-1"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-gray-500 text-xs block mb-1">Transaction ID</label>
                              <div className="flex items-center gap-2">
                                <code className="text-green-400 text-xs bg-[#1a2332] px-2 py-1 rounded">
                                  {doc.transaction_id}
                                </code>
                                <a
                                  href={`https://hashscan.io/mainnet/transaction/${doc.transaction_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-white p-1"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full border border-green-500/30">
                          {doc.status}
                        </span>
                      </div>
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

export default Dashboard;
