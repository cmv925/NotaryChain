import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  ArrowLeft, Bell, Calendar, Download, Clock,
  CheckCircle, AlertTriangle, Loader2, Settings
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RemindersPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/reminders/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPrefs(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const updatePref = async (key, value) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    try {
      await fetch(`${API}/api/reminders/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updated),
      });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const downloadIcs = (type) => {
    window.open(`${API}/api/reminders/calendar/${type}.ics?token=${token}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-amber-400" />
              Smart Reminders
            </h1>
            <p className="text-gray-400 text-sm">Automated notifications & calendar integration</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
        ) : (
          <div className="space-y-6">
            {/* Preferences */}
            <Card className="bg-[#0d1b2a] border-gray-800" data-testid="reminder-prefs">
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-400" /> Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'overdue_tasks', label: 'Overdue Task Alerts', desc: 'Get notified when transaction tasks pass their deadline', icon: AlertTriangle, color: 'text-red-400' },
                  { key: 'upcoming_bookings', label: 'Upcoming Booking Reminders', desc: 'Reminder 24h before scheduled notary bookings', icon: Clock, color: 'text-blue-400' },
                  { key: 'pending_approvals', label: 'Pending Approval Nudges', desc: 'Reminder for approval requests waiting on you', icon: CheckCircle, color: 'text-amber-400' },
                  { key: 'email_notifications', label: 'Email Notifications', desc: 'Also send critical reminders via email', icon: Bell, color: 'text-purple-400' },
                ].map(({ key, label, desc, icon: Icon, color }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 ${color}`} />
                      <div>
                        <p className="text-white text-sm font-medium">{label}</p>
                        <p className="text-gray-500 text-xs">{desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={prefs?.[key] ?? true}
                      onCheckedChange={(v) => updatePref(key, v)}
                      data-testid={`toggle-${key}`}
                    />
                  </div>
                ))}
                {saving && <p className="text-gray-500 text-xs text-right">Saving...</p>}
              </CardContent>
            </Card>

            {/* Calendar Export */}
            <Card className="bg-[#0d1b2a] border-gray-800" data-testid="calendar-export">
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" /> Calendar Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-gray-400 text-sm">Export your schedule to Google Calendar, Apple Calendar, or Outlook.</p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => downloadIcs('bookings')}
                    className="border-gray-700 text-gray-300"
                    data-testid="export-bookings"
                  >
                    <Download className="w-4 h-4 mr-2" /> Bookings (.ics)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadIcs('tasks')}
                    className="border-gray-700 text-gray-300"
                    data-testid="export-tasks"
                  >
                    <Download className="w-4 h-4 mr-2" /> Tasks (.ics)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
