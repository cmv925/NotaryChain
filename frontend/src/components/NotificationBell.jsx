import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X, ExternalLink } from 'lucide-react';
import { useWS } from '../contexts/WebSocketContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function NotificationBell({ token }) {
  const navigate = useNavigate();
  const { subscribe } = useWS();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/notifications/unread-count`, { headers });
      setUnreadCount(res.data.count);
    } catch {}
  }, [headers]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/notifications/?limit=15`, { headers });
      setNotifications(res.data.notifications || []);
    } catch {}
    setLoading(false);
  }, [headers]);

  // Initial load + fallback polling at 60s (WebSocket handles real-time)
  useEffect(() => {
    if (token) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [token, fetchUnreadCount]);

  // Subscribe to real-time notifications via WebSocket
  useEffect(() => {
    const unsub = subscribe('notification', (msg) => {
      const notif = msg.notification;
      if (notif) {
        setUnreadCount(prev => prev + 1);
        // Prepend to list if dropdown is open
        setNotifications(prev => [notif, ...prev].slice(0, 15));
      }
    });
    return unsub;
  }, [subscribe]);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAsRead = async (id) => {
    try {
      await axios.post(`${API}/notifications/${id}/read`, {}, { headers });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/read-all`, {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotifClick = (notif) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) {
      setIsOpen(false);
      navigate(notif.link);
    }
  };

  const typeColors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    action: 'bg-coral-500',
    info: 'bg-coral-500',
  };

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden"
          data-testid="notification-dropdown"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-white font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-coral-500 hover:text-coral-400" data-testid="mark-all-read">
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm" data-testid="no-notifications">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`px-4 py-3 border-b border-slate-200 cursor-pointer hover:bg-white/5 transition-colors ${
                    !notif.read ? 'bg-coral-500/5' : ''
                  }`}
                  data-testid={`notification-item-${notif.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      !notif.read ? typeColors[notif.type] || 'bg-coral-500' : 'bg-transparent'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${notif.read ? 'text-slate-500' : 'text-white'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{timeAgo(notif.created_at)}</span>
                      </div>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${notif.read ? 'text-slate-500' : 'text-slate-500'}`}>
                        {notif.message}
                      </p>
                      {notif.link && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-coral-500">
                          <ExternalLink className="h-2.5 w-2.5" /> View
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
