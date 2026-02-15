import React, { useState, useEffect } from 'react';
import { 
  Shield, ExternalLink, RefreshCw, Clock, CheckCircle, 
  FileText, User, Video, Hash, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EVENT_ICONS = {
  REQUEST_CREATED: { icon: FileText, color: 'blue' },
  NOTARY_ASSIGNED: { icon: User, color: 'purple' },
  SESSION_STARTED: { icon: Video, color: 'green' },
  NOTARIZATION_COMPLETED: { icon: CheckCircle, color: 'emerald' },
  NOTARY_SEAL: { icon: Shield, color: 'cyan' },
  default: { icon: Hash, color: 'gray' }
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const BlockchainAuditTrail = ({ topicId, token, requestId, title = "Blockchain Audit Trail" }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topicInfo, setTopicInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (topicId) {
      fetchTopicData();
    }
  }, [topicId]);

  const fetchTopicData = async () => {
    if (!topicId || !token) return;
    
    try {
      setRefreshing(true);
      const response = await axios.get(`${API}/blockchain/topics/${topicId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTopicInfo(response.data);
      
      // Parse and sort messages
      const msgs = (response.data.messages || []).map(msg => {
        const decoded = msg.decoded_message || {};
        return {
          ...msg,
          decoded: decoded,
          eventType: decoded.type || 'UNKNOWN',
          timestamp: decoded.submitted_at || msg.consensus_timestamp
        };
      }).sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
      
      setMessages(msgs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch topic data:', err);
      setError(err.response?.data?.detail || 'Failed to load audit trail');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getEventConfig = (eventType) => {
    return EVENT_ICONS[eventType] || EVENT_ICONS.default;
  };

  if (!topicId) {
    return (
      <Card className="bg-[#1a2332] border-gray-800">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No blockchain audit trail available for this request.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800" data-testid="audit-trail-card">
      <CardContent className="p-0">
        {/* Header */}
        <div 
          className="p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{title}</h3>
                <p className="text-gray-400 text-sm">
                  Topic: {topicId} • {messages.length} events
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); fetchTopicData(); }}
                className="text-gray-400 hover:text-white"
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <a
                href={`https://hashscan.io/testnet/topic/${topicId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-400 hover:text-blue-300 p-2"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {expanded && (
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-400">Loading audit trail...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-400">{error}</p>
                <Button 
                  onClick={fetchTopicData} 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 border-gray-700"
                >
                  Retry
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No events recorded yet</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-700" />
                
                {/* Events */}
                <div className="space-y-4">
                  {messages.map((msg, idx) => {
                    const config = getEventConfig(msg.eventType);
                    const Icon = config.icon;
                    const decoded = msg.decoded || {};
                    
                    return (
                      <div key={msg.sequence_number || idx} className="relative pl-12">
                        {/* Timeline dot */}
                        <div className={`absolute left-3 w-5 h-5 rounded-full bg-${config.color}-500/20 border-2 border-${config.color}-500 flex items-center justify-center`}>
                          <Icon className={`w-2.5 h-2.5 text-${config.color}-400`} />
                        </div>
                        
                        {/* Event card */}
                        <div className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium bg-${config.color}-500/20 text-${config.color}-400`}>
                                {msg.eventType.replace(/_/g, ' ')}
                              </span>
                              <span className="text-gray-500 text-xs ml-2">
                                Seq #{msg.sequence_number}
                              </span>
                            </div>
                            <span className="text-gray-500 text-xs">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          
                          {/* Event details */}
                          <div className="text-sm text-gray-400 space-y-1">
                            {decoded.document_hash && (
                              <p>
                                <span className="text-gray-500">Document Hash:</span>{' '}
                                <code className="text-blue-400 text-xs">{decoded.document_hash.substring(0, 16)}...</code>
                              </p>
                            )}
                            {decoded.document_name && (
                              <p>
                                <span className="text-gray-500">Document:</span>{' '}
                                <span className="text-white">{decoded.document_name}</span>
                              </p>
                            )}
                            {decoded.notary_id && (
                              <p>
                                <span className="text-gray-500">Notary ID:</span>{' '}
                                <span className="text-purple-400">{decoded.notary_id.substring(0, 12)}...</span>
                              </p>
                            )}
                            {decoded.session_id && (
                              <p>
                                <span className="text-gray-500">Session:</span>{' '}
                                <span className="text-green-400">{decoded.session_id.substring(0, 12)}...</span>
                              </p>
                            )}
                            {decoded.request_id && (
                              <p>
                                <span className="text-gray-500">Request:</span>{' '}
                                <span className="text-cyan-400">{decoded.request_id.substring(0, 12)}...</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer info */}
            {!loading && !error && (
              <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Network: <span className="text-blue-400">Hedera Testnet</span>
                </span>
                <a
                  href={`https://hashscan.io/testnet/topic/${topicId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  View on HashScan
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockchainAuditTrail;
