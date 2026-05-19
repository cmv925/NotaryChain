import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  ArrowLeft, Sparkles, Send, Clock, CheckCircle,
  AlertTriangle, Loader2, MessageSquare, ChevronRight,
  Zap, User, Bot
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const urgencyColor = {
  immediate: 'bg-red-500/15 text-red-400',
  soon: 'bg-coral-500/15 text-coral-600',
  when_ready: 'bg-blue-500/15 text-blue-400',
};

export default function AIConductorPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [role, setRole] = useState('');
  const chatEndRef = useRef(null);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [chatMessages]);

  const fetchGuidance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/conductor/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      const data = await res.json();
      setGuidance(data.guidance);
      setRole(data.role);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [transactionId, token]);

  const sendChat = async () => {
    if (!chatInput.trim() || sending) return;
    const msg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatInput('');
    setSending(true);
    try {
      const res = await fetch(`${API}/api/conductor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transaction_id: transactionId, message: msg }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-coral-600" />
              AI Conductor
            </h1>
            <p className="text-slate-500 text-sm">Intelligent step-by-step transaction guidance</p>
          </div>
          {role && <Badge className="bg-violet-500/15 text-coral-600">{role}</Badge>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Guidance Panel */}
          <div className="lg:col-span-3 space-y-4">
            <Button
              onClick={fetchGuidance}
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-navy-900"
              data-testid="get-guidance-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              {guidance ? 'Refresh Guidance' : 'Get My Guidance'}
            </Button>

            {loading && (
              <div className="flex flex-col items-center py-12 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-coral-600" />
                <p className="text-sm">AI Conductor is analyzing your position...</p>
              </div>
            )}

            {guidance && !loading && (
              <>
                {/* Greeting & Summary */}
                <Card className="bg-cream-100 border-slate-200" data-testid="guidance-summary">
                  <CardContent className="pt-5">
                    <p className="text-coral-600 font-medium text-sm mb-2">{guidance.greeting}</p>
                    <p className="text-slate-500 text-sm">{guidance.current_status_summary}</p>
                    {guidance.timeline_estimate && (
                      <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {guidance.timeline_estimate}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Next Steps */}
                {guidance.next_steps?.length > 0 && (
                  <Card className="bg-cream-100 border-slate-200" data-testid="next-steps-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-navy-900">Your Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {guidance.next_steps.map((step, i) => (
                        <div key={i} className="border border-slate-200/50 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-violet-500/20 text-coral-600 flex items-center justify-center text-xs font-bold">
                                {step.step_number}
                              </div>
                              <span className="text-navy-900 text-sm font-medium">{step.action}</span>
                            </div>
                            <Badge className={`text-[10px] ${urgencyColor[step.urgency] || urgencyColor.when_ready}`}>
                              {step.urgency}
                            </Badge>
                          </div>
                          <p className="text-slate-500 text-xs ml-8">{step.details}</p>
                          {step.estimated_time && (
                            <p className="text-slate-600 text-[10px] ml-8 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {step.estimated_time}
                            </p>
                          )}
                          {step.tips && (
                            <p className="text-blue-400 text-[10px] ml-8 mt-1">Tip: {step.tips}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Blockers */}
                {guidance.blockers?.length > 0 && (
                  <Card className="bg-red-500/5 border border-red-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Blockers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {guidance.blockers.map((b, i) => (
                        <div key={i} className="text-xs">
                          <p className="text-red-300">{b.issue}</p>
                          <p className="text-slate-500 mt-0.5">{b.resolution}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Encouragement */}
                {guidance.encouragement && (
                  <div className="text-center text-slate-500 text-xs py-2">
                    {guidance.encouragement}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Chat Panel */}
          <div className="lg:col-span-2">
            <Card className="bg-cream-100 border-slate-200 h-[600px] flex flex-col" data-testid="conductor-chat">
              <CardHeader className="pb-2 border-b border-slate-200">
                <CardTitle className="text-sm text-navy-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-coral-600" />
                  Ask the Conductor
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto py-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center text-slate-600 py-8">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Ask anything about this transaction</p>
                    <div className="mt-3 space-y-1">
                      {['What should I do next?', 'Who is waiting on me?', 'What documents do I need?'].map((q) => (
                        <button
                          key={q}
                          onClick={() => { setChatInput(q); }}
                          className="block mx-auto text-coral-600/60 text-[11px] hover:text-coral-600 transition"
                        >
                          "{q}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === 'user'
                        ? 'bg-violet-600/20 text-violet-200'
                        : 'bg-white text-slate-500'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-coral-600" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </CardContent>
              <div className="p-3 border-t border-slate-200 flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Ask the conductor..."
                  className="bg-white border-slate-200 text-navy-900 text-sm"
                  data-testid="conductor-chat-input"
                />
                <Button
                  onClick={sendChat}
                  disabled={sending || !chatInput.trim()}
                  size="icon"
                  className="bg-violet-600 hover:bg-violet-700"
                  data-testid="conductor-send-btn"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
