import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, Clock, Loader2, Filter,
  Rocket, UserCheck, Mail, Play, CheckCircle,
  FileText, Brain, Sparkles, ShieldAlert, Fingerprint,
  ScanFace, Wand2, Package, Shield, Video, MessageSquare,
  ChevronDown, Radio, Wifi, WifiOff
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ICON_MAP = {
  rocket: Rocket, 'user-check': UserCheck, mail: Mail,
  play: Play, 'check-circle': CheckCircle, 'file-text': FileText,
  brain: Brain, sparkles: Sparkles, 'shield-alert': ShieldAlert,
  fingerprint: Fingerprint, 'scan-face': ScanFace, wand: Wand2,
  package: Package, shield: Shield, video: Video, message: MessageSquare,
};

const CATEGORY_CONFIG = {
  lifecycle: { label: 'Lifecycle', color: 'bg-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/30' },
  people: { label: 'People', color: 'bg-violet-500', text: 'text-violet-400', ring: 'ring-violet-500/30' },
  tasks: { label: 'Tasks', color: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  documents: { label: 'Documents', color: 'bg-cyan-500', text: 'text-cyan-400', ring: 'ring-cyan-500/30' },
  ai: { label: 'AI', color: 'bg-pink-500', text: 'text-pink-400', ring: 'ring-pink-500/30' },
  verification: { label: 'Verification', color: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  blockchain: { label: 'Blockchain', color: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/30' },
};

const SEVERITY_DOT = {
  success: 'bg-green-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
};

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFullDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function groupByDate(events) {
  const groups = {};
  events.forEach((ev) => {
    const d = new Date(ev.timestamp);
    const key = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  });
  return Object.entries(groups);
}

export default function TransactionTimeline() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [newEventFlash, setNewEventFlash] = useState(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/timeline/${transactionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [transactionId, token]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  // WebSocket connection for live events
  useEffect(() => {
    if (!token || !transactionId) return;

    const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
    let ws;
    let retries = 0;

    const connect = () => {
      ws = new WebSocket(`${wsUrl}/api/ws/timeline/${transactionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'connected') {
            setWsConnected(true);
            retries = 0;
          } else if (msg.type === 'timeline_event' && msg.event) {
            const ev = msg.event;
            // Assign a sequence number
            ev.sequence = Date.now();
            ev._live = true;
            setLiveEvents((prev) => [ev, ...prev]);
            setNewEventFlash(ev.sequence);
            setTimeout(() => setNewEventFlash(null), 2000);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        if (retries < 5) {
          retries++;
          reconnectRef.current = setTimeout(connect, 2000 * retries);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, transactionId]);

  // Keep WS alive with pings
  useEffect(() => {
    if (!wsConnected) return;
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
    return () => clearInterval(interval);
  }, [wsConnected]);

  const toggleFilter = (cat) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const allEvents = [...liveEvents, ...(data?.events || [])];
  const filteredEvents = allEvents.filter(
    (e) => activeFilters.size === 0 || activeFilters.has(e.category)
  );

  const dateGroups = groupByDate(filteredEvents);

  // Stats
  const catCounts = {};
  allEvents.forEach((e) => {
    catCounts[e.category] = (catCounts[e.category] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-400" />
              Transaction Timeline
            </h1>
            {data && (
              <p className="text-gray-400 text-sm">{data.transaction_name} — {data.total_events} events</p>
            )}
          </div>
          <Badge className={
            data?.transaction_status === 'completed' ? 'bg-green-500/15 text-green-400' :
            data?.transaction_status === 'in_progress' ? 'bg-blue-500/15 text-blue-400' :
            'bg-gray-500/15 text-gray-400'
          }>
            {data?.transaction_status || '...'}
          </Badge>
        </div>

        {/* Live Status Bar */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              wsConnected
                ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                : 'bg-gray-800/50 text-gray-500'
            }`} data-testid="ws-status">
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {wsConnected ? 'Live' : 'Connecting...'}
            </div>
            {liveEvents.length > 0 && (
              <Badge className="bg-pink-500/15 text-pink-400 animate-pulse" data-testid="live-count">
                <Radio className="w-3 h-3 mr-1" />
                {liveEvents.length} new
              </Badge>
            )}
          </div>
          <span className="text-gray-600 text-xs">{allEvents.length} total events</span>
        </div>

        {loading && (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
            <p className="text-gray-500 text-sm">Loading timeline...</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Filter Bar */}
            <div className="mb-6">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-2 transition"
                data-testid="filter-toggle"
              >
                <Filter className="w-4 h-4" />
                Filter by category
                <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              {showFilters && (
                <div className="flex flex-wrap gap-2" data-testid="filter-bar">
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => toggleFilter(key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        activeFilters.size === 0 || activeFilters.has(key)
                          ? `${cfg.color}/20 ${cfg.text} ring-1 ${cfg.ring}`
                          : 'bg-gray-800/50 text-gray-600'
                      }`}
                      data-testid={`filter-${key}`}
                    >
                      {cfg.label} {catCounts[key] ? `(${catCounts[key]})` : ''}
                    </button>
                  ))}
                  {activeFilters.size > 0 && (
                    <button
                      onClick={() => setActiveFilters(new Set())}
                      className="px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-white bg-gray-800/30"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats Strip */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
              {Object.entries(catCounts).map(([cat, count]) => {
                const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.lifecycle;
                return (
                  <div key={cat} className="bg-[#0d1b2a] rounded-lg px-3 py-2 text-center">
                    <p className={`text-lg font-bold ${cfg.text}`}>{count}</p>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide">{cfg.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Timeline */}
            {filteredEvents.length === 0 ? (
              <Card className="bg-[#0d1b2a] border-gray-800">
                <CardContent className="py-12 text-center">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-gray-600 opacity-30" />
                  <p className="text-gray-500 text-sm">No events match your filters</p>
                </CardContent>
              </Card>
            ) : (
              <div className="relative" data-testid="timeline-container">
                {/* Vertical line */}
                <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/40 via-gray-700/40 to-transparent" />

                {dateGroups.map(([dateLabel, events], gi) => (
                  <div key={dateLabel} className="mb-8">
                    {/* Date Header */}
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <div className="w-[47px] h-px bg-gray-700" />
                      <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider bg-[#030712] px-2">
                        {dateLabel}
                      </span>
                    </div>

                    {events.map((ev, ei) => {
                      const IconComp = ICON_MAP[ev.icon] || Clock;
                      const catCfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.lifecycle;
                      const isExpanded = expandedEvent === `${gi}-${ei}`;

                      return (
                        <div
                          key={`${gi}-${ei}`}
                          className="relative flex gap-4 mb-1 group"
                          data-testid={`timeline-event-${ev.sequence}`}
                        >
                          {/* Node */}
                          <div className="flex-shrink-0 relative z-10">
                            <div className={`w-[47px] h-[47px] rounded-full flex items-center justify-center ${catCfg.color}/15 ring-2 ${catCfg.ring} transition-all group-hover:scale-110`}>
                              <IconComp className={`w-5 h-5 ${catCfg.text}`} />
                            </div>
                          </div>

                          {/* Content */}
                          <div
                            className={`flex-1 bg-[#0d1b2a] rounded-lg p-3 border transition-all cursor-pointer mb-3 ${
                              isExpanded ? 'border-gray-600' : 'border-gray-800/50 hover:border-gray-700'
                            }`}
                            onClick={() => setExpandedEvent(isExpanded ? null : `${gi}-${ei}`)}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[ev.severity] || SEVERITY_DOT.info}`} />
                                <h4 className="text-white text-sm font-medium truncate">{ev.title}</h4>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <Badge variant="outline" className={`text-[9px] border-0 ${catCfg.color}/10 ${catCfg.text}`}>
                                  {catCfg.label}
                                </Badge>
                                <span className="text-gray-600 text-[10px] whitespace-nowrap">
                                  {formatTimestamp(ev.timestamp)}
                                </span>
                              </div>
                            </div>
                            <p className="text-gray-500 text-xs ml-3.5">{ev.description}</p>

                            {isExpanded && (
                              <div className="mt-3 ml-3.5 pt-2 border-t border-gray-800/50">
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div>
                                    <span className="text-gray-600">Event #</span>
                                    <span className="text-white ml-1">{ev.sequence}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Type</span>
                                    <span className="text-white ml-1">{ev.type}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-gray-600">Timestamp</span>
                                    <span className="text-white ml-1">{formatFullDate(ev.timestamp)}</span>
                                  </div>
                                  {ev.metadata && Object.entries(ev.metadata).filter(([_, v]) => v).map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-gray-600 capitalize">{k.replace(/_/g, ' ')}</span>
                                      <span className="text-gray-300 ml-1 break-all">{typeof v === 'string' && v.length > 30 ? v.substring(0, 30) + '...' : String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
