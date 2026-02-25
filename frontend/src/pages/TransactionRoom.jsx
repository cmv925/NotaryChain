import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, Send, 
  FileText, MessageSquare, Sparkles, Shield, ChevronRight,
  Play, PauseCircle, ArrowLeft, RefreshCw, Lock, Unlock,
  Wifi, WifiOff, Circle
} from 'lucide-react';
import { useTransactionWebSocket } from '../hooks/useTransactionWebSocket';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  draft: 'bg-gray-500',
  pending_participants: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  pending_review: 'bg-purple-500',
  pending_settlement: 'bg-orange-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
  on_hold: 'bg-gray-400'
};

const taskStatusColors = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  awaiting_review: 'bg-purple-500',
  completed: 'bg-green-500',
  blocked: 'bg-red-500',
  skipped: 'bg-gray-400',
  overdue: 'bg-orange-500'
};

const roleIcons = {
  owner: '👑',
  buyer: '🏠',
  seller: '💰',
  agent: '🤝',
  lender: '🏦',
  title_company: '📋',
  attorney: '⚖️',
  notary: '✍️',
  executor: '📜',
  beneficiary: '🎁',
  witness: '👁️',
  signer: '✒️',
  reviewer: '🔍'
};

export default function TransactionRoom() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const messagesEndRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [roomData, setRoomData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [settling, setSettling] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef({});

  // WebSocket handler
  const handleWsEvent = useCallback((event) => {
    if (event.type === 'new_message') {
      setRoomData(prev => {
        if (!prev) return prev;
        const msgs = [...(prev.messages || [])];
        // Avoid duplicates
        if (!msgs.find(m => m.id === event.message?.id)) {
          msgs.push(event.message);
        }
        return { ...prev, messages: msgs };
      });
    } else if (event.type === 'task_updated') {
      // Refresh room data to get updated tasks and progress
      fetchRoomData();
    } else if (event.type === 'typing') {
      setTypingUsers(prev => {
        if (!prev.includes(event.user_name)) return [...prev, event.user_name];
        return prev;
      });
      // Clear typing after 3s
      clearTimeout(typingTimeoutRef.current[event.user_id]);
      typingTimeoutRef.current[event.user_id] = setTimeout(() => {
        setTypingUsers(prev => prev.filter(n => n !== event.user_name));
      }, 3000);
    } else if (event.type === 'presence') {
      setRoomData(prev => prev ? { ...prev, online_users: event.online_users || [] } : prev);
    }
  }, []);

  const { connected, onlineUsers, sendTyping } = useTransactionWebSocket(transactionId, token, handleWsEvent);

  useEffect(() => {
    fetchRoomData();
    // Fallback polling at 60s (WebSocket handles real-time)
    const interval = setInterval(fetchRoomData, 60000);
    return () => clearInterval(interval);
  }, [transactionId]);

  useEffect(() => {
    scrollToBottom();
  }, [roomData?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchRoomData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/transactions/${transactionId}/room`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRoomData(data);
      }
    } catch (error) {
      console.error('Failed to fetch room data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiRecommendations = async () => {
    setLoadingAi(true);
    try {
      const response = await fetch(`${API_URL}/api/transactions/${transactionId}/ai/recommendations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAiRecommendations(data);
      }
    } catch (error) {
      console.error('Failed to fetch AI recommendations:', error);
    } finally {
      setLoadingAi(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setSendingMessage(true);
    try {
      const response = await fetch(`${API_URL}/api/transactions/${transactionId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newMessage })
      });
      
      if (response.ok) {
        setNewMessage('');
        fetchRoomData();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const completeTask = async (taskId) => {
    try {
      const response = await fetch(`${API_URL}/api/transactions/${transactionId}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchRoomData();
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const startTransaction = async () => {
    try {
      const response = await fetch(`${API_URL}/api/transactions/${transactionId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchRoomData();
      }
    } catch (error) {
      console.error('Failed to start transaction:', error);
    }
  };

  const settleTransaction = async () => {
    if (!window.confirm('Are you sure you want to settle this transaction? This action is irreversible and will seal all data on the blockchain.')) {
      return;
    }
    
    setSettling(true);
    try {
      const response = await fetch(`${API_URL}/api/transactions/${transactionId}/settle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Transaction settled successfully!\nSettlement Hash: ${data.settlement_hash}`);
        fetchRoomData();
      }
    } catch (error) {
      console.error('Failed to settle transaction:', error);
    } finally {
      setSettling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4aa] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Transaction Room...</p>
        </div>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Card className="bg-[#1a1a2e] border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl text-white mb-2">Transaction Not Found</h2>
            <p className="text-gray-400 mb-4">You may not have access to this transaction.</p>
            <Button onClick={() => navigate('/transactions')} variant="outline">
              Back to Transactions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { transaction, participants, tasks, messages, documents, current_participant } = roomData;
  const isOwner = current_participant?.role === 'owner';
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-b border-[#333] px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/transactions')}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{transaction.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge className={`${statusColors[transaction.status]} text-white`}>
                    {transaction.status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                  <span className="text-gray-400 text-sm">
                    {transaction.transaction_type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRoomData}
                className="border-[#333]"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>

              {/* Connection Status */}
              <div className="flex items-center gap-1.5" data-testid="ws-status">
                {connected ? (
                  <Wifi className="h-4 w-4 text-green-400" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-400" />
                )}
                <span className={`text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* Online Users Dots */}
              {(roomData?.online_users?.length > 0 || onlineUsers.length > 0) && (
                <div className="flex items-center gap-1" data-testid="online-users-indicator">
                  {(roomData?.online_users || onlineUsers).slice(0, 5).map((_, i) => (
                    <Circle key={i} className="h-2.5 w-2.5 text-green-400 fill-green-400" />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">
                    {(roomData?.online_users || onlineUsers).length} online
                  </span>
                </div>
              )}
              
              {isOwner && transaction.status === 'draft' && (
                <Button onClick={startTransaction} className="bg-[#00d4aa] text-black hover:bg-[#00b894]">
                  <Play className="h-4 w-4 mr-2" />
                  Start Transaction
                </Button>
              )}
              
              {isOwner && transaction.status === 'in_progress' && completedTasks === tasks.length && tasks.length > 0 && (
                <Button 
                  onClick={settleTransaction}
                  disabled={settling}
                  className="bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-black"
                >
                  {settling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                      Settling...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Settle on Blockchain
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Progress</span>
              <span className="text-[#00d4aa] font-semibold">{transaction.progress_percentage}%</span>
            </div>
            <Progress value={transaction.progress_percentage} className="h-2 bg-[#333]" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[#1a1a2e] border-b border-[#333] px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {['overview', 'tasks', 'participants', 'messages', 'documents', 'ai'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab 
                  ? 'text-[#00d4aa]' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d4aa]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats Cards */}
            <Card className="bg-[#1a1a2e] border-[#333]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Tasks</p>
                    <p className="text-3xl font-bold text-white">{tasks.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Badge className="bg-green-500/20 text-green-400">{completedTasks} Done</Badge>
                  <Badge className="bg-yellow-500/20 text-yellow-400">{pendingTasks} Pending</Badge>
                  {blockedTasks > 0 && (
                    <Badge className="bg-red-500/20 text-red-400">{blockedTasks} Blocked</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a2e] border-[#333]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Participants</p>
                    <p className="text-3xl font-bold text-white">{participants.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  {participants.filter(p => p.status === 'joined').length > 0 && (
                    <Badge className="bg-green-500/20 text-green-400">
                      {participants.filter(p => p.status === 'joined').length} Joined
                    </Badge>
                  )}
                  {participants.filter(p => p.status === 'invited').length > 0 && (
                    <Badge className="bg-yellow-500/20 text-yellow-400">
                      {participants.filter(p => p.status === 'invited').length} Pending
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a2e] border-[#333]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Messages</p>
                    <p className="text-3xl font-bold text-white">{messages.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[#00d4aa]/20 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-[#00d4aa]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Details */}
            <Card className="bg-[#1a1a2e] border-[#333] lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white">Transaction Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Type</p>
                    <p className="text-white">{transaction.transaction_type.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Blueprint</p>
                    <p className="text-white">{transaction.blueprint_name || 'Custom'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Target Date</p>
                    <p className="text-white">
                      {transaction.target_completion_date 
                        ? new Date(transaction.target_completion_date).toLocaleDateString()
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Created</p>
                    <p className="text-white">{new Date(transaction.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {transaction.hcs_topic_id && (
                  <div className="mt-4 p-4 bg-[#0d1b2a] rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-[#00d4aa]" />
                      <p className="text-[#00d4aa] font-medium">Blockchain Audit Trail</p>
                    </div>
                    <p className="text-gray-400 text-sm">HCS Topic: {transaction.hcs_topic_id}</p>
                    {transaction.hcs_explorer_url && (
                      <a 
                        href={transaction.hcs_explorer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-sm hover:underline"
                      >
                        View on HashScan →
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-[#1a1a2e] border-[#333]">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-[#333]"
                  onClick={() => setActiveTab('tasks')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  View Tasks
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-[#333]"
                  onClick={() => setActiveTab('messages')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Open Chat
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-[#333]"
                  onClick={() => { setActiveTab('ai'); fetchAiRecommendations(); }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Analysis
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Tasks ({tasks.length})</h2>
            {tasks.length === 0 ? (
              <Card className="bg-[#1a1a2e] border-[#333]">
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No tasks yet. Tasks will appear when the transaction starts.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <Card 
                    key={task.id} 
                    className={`bg-[#1a1a2e] border-[#333] ${task.status === 'blocked' ? 'opacity-60' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            task.status === 'completed' ? 'bg-green-500 text-white' : 'bg-[#333] text-gray-400'
                          }`}>
                            {task.status === 'completed' ? '✓' : index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white">{task.name}</h3>
                              <Badge className={`${taskStatusColors[task.status]} text-white text-xs`}>
                                {task.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-gray-400 text-sm mt-1">{task.description}</p>
                            
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              {task.assigned_roles?.length > 0 && (
                                <span>Roles: {task.assigned_roles.join(', ')}</span>
                              )}
                              {task.requires_document && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> Document required
                                </span>
                              )}
                              {task.requires_notarization && (
                                <span className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" /> Notarization required
                                </span>
                              )}
                            </div>
                            
                            {task.blocked_reason && (
                              <p className="text-red-400 text-sm mt-2">
                                <Lock className="h-3 w-3 inline mr-1" />
                                {task.blocked_reason}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {task.status === 'pending' && current_participant?.can_complete_tasks && (
                          <Button
                            size="sm"
                            onClick={() => completeTask(task.id)}
                            className="bg-[#00d4aa] text-black hover:bg-[#00b894]"
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Participants ({participants.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((participant) => (
                <Card key={participant.id} className="bg-[#1a1a2e] border-[#333]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-[#333] flex items-center justify-center text-2xl">
                        {roleIcons[participant.role] || '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{participant.name}</h3>
                        <p className="text-gray-400 text-sm truncate">{participant.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-[#333] text-gray-300 text-xs">
                            {participant.role}
                          </Badge>
                          <Badge className={`${
                            participant.status === 'joined' ? 'bg-green-500/20 text-green-400' :
                            participant.status === 'invited' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          } text-xs`}>
                            {participant.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="flex flex-col h-[600px]">
            <h2 className="text-xl font-bold mb-4">Transaction Room Chat</h2>
            
            {/* Messages Area */}
            <Card className="bg-[#1a1a2e] border-[#333] flex-1 flex flex-col">
              <CardContent className="p-4 flex-1 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.sender_id === current_participant?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${
                        msg.sender_id === current_participant?.id 
                          ? 'bg-[#00d4aa] text-black' 
                          : 'bg-[#333] text-white'
                      } rounded-lg px-4 py-2`}>
                        <p className={`text-xs mb-1 ${
                          msg.sender_id === current_participant?.id ? 'text-black/60' : 'text-gray-400'
                        }`}>
                          {msg.sender_name}
                        </p>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender_id === current_participant?.id ? 'text-black/40' : 'text-gray-500'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </CardContent>
              
              {/* Message Input */}
              <div className="p-4 border-t border-[#333]">
                {typingUsers.length > 0 && (
                  <div className="text-xs text-gray-500 mb-2 italic" data-testid="typing-indicator">
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </div>
                )}
                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => { setNewMessage(e.target.value); sendTyping(); }}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#0d1b2a] border-[#333] text-white"
                    disabled={!current_participant?.can_send_messages}
                  />
                  <Button 
                    type="submit" 
                    disabled={sendingMessage || !newMessage.trim()}
                    className="bg-[#00d4aa] text-black hover:bg-[#00b894]"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Documents ({documents.length})</h2>
            {documents.length === 0 ? (
              <Card className="bg-[#1a1a2e] border-[#333]">
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No documents uploaded yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((doc) => (
                  <Card key={doc.id} className="bg-[#1a1a2e] border-[#333]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-[#333] flex items-center justify-center">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white truncate">{doc.name}</h3>
                          <p className="text-gray-400 text-sm">
                            {doc.file_type} • {(doc.file_size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        {doc.blockchain_seal_id && (
                          <Badge className="bg-green-500/20 text-green-400">Sealed</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-[#00d4aa]" />
                AI Transaction Analysis
              </h2>
              <Button
                onClick={fetchAiRecommendations}
                disabled={loadingAi}
                className="bg-[#00d4aa] text-black hover:bg-[#00b894]"
              >
                {loadingAi ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>

            {aiRecommendations ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risk Score */}
                <Card className="bg-[#1a1a2e] border-[#333]">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-400 text-sm mb-2">Risk Score</p>
                    <div className={`text-5xl font-bold ${
                      aiRecommendations.risk_score < 30 ? 'text-green-500' :
                      aiRecommendations.risk_score < 60 ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                      {aiRecommendations.risk_score}
                    </div>
                    <Badge className={`mt-2 ${
                      aiRecommendations.risk_level === 'low' ? 'bg-green-500/20 text-green-400' :
                      aiRecommendations.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {aiRecommendations.risk_level.toUpperCase()} RISK
                    </Badge>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card className="bg-[#1a1a2e] border-[#333] lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-white">AI Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {aiRecommendations.recommendations.length === 0 ? (
                      <p className="text-gray-400">No immediate recommendations. Transaction is on track!</p>
                    ) : (
                      aiRecommendations.recommendations.map((rec, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-lg border-l-4 ${
                            rec.priority === 'high' ? 'bg-red-500/10 border-red-500' :
                            rec.priority === 'medium' ? 'bg-yellow-500/10 border-yellow-500' :
                            'bg-blue-500/10 border-blue-500'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {rec.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                            {rec.type === 'action' && <ChevronRight className="h-4 w-4 text-blue-500" />}
                            {rec.type === 'suggestion' && <Sparkles className="h-4 w-4 text-purple-500" />}
                            <span className={`text-xs font-medium uppercase ${
                              rec.priority === 'high' ? 'text-red-400' :
                              rec.priority === 'medium' ? 'text-yellow-400' :
                              'text-blue-400'
                            }`}>
                              {rec.priority} priority
                            </span>
                          </div>
                          <p className="text-white">{rec.message}</p>
                          {rec.action && (
                            <p className="text-gray-400 text-sm mt-1">Action: {rec.action}</p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-[#1a1a2e] border-[#333]">
                <CardContent className="p-8 text-center">
                  <Sparkles className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">Click "Run Analysis" to get AI-powered insights</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
