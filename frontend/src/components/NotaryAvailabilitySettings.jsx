import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Calendar, Clock, Plus, Trash2, Save, Loader2, CheckCircle,
  Ban, AlertCircle,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

const NotaryAvailabilitySettings = ({ token }) => {
  const [schedule, setSchedule] = useState(null);
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState([]);
  const [duration, setDuration] = useState(60);
  const [breakTime, setBreakTime] = useState(15);
  const [blockDate, setBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fetchAvailability = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/bookings/availability`, { headers });
      if (res.data.schedule) {
        setSlots(res.data.schedule.weekly_slots || []);
        setDuration(res.data.schedule.slot_duration_minutes || 60);
        setBreakTime(res.data.schedule.break_between_minutes || 15);
      }
      setBlockedDates(res.data.blocked_dates || []);
    } catch {}
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  const addSlot = () => {
    setSlots(prev => [...prev, { day_of_week: 0, start_time: '09:00', end_time: '17:00' }]);
  };

  const removeSlot = (idx) => {
    setSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx, field, value) => {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'day_of_week' ? parseInt(value) : value } : s));
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/bookings/availability`, {
        weekly_slots: slots,
        slot_duration_minutes: duration,
        break_between_minutes: breakTime,
      }, { headers });
      toast({ title: 'Saved', description: 'Availability schedule updated' });
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed to save', variant: 'destructive' });
    }
    setSaving(false);
  };

  const addBlockedDate = async () => {
    if (!blockDate) return;
    try {
      await axios.post(`${API}/bookings/blocked-dates`, {
        date: blockDate,
        reason: blockReason,
      }, { headers });
      setBlockDate('');
      setBlockReason('');
      fetchAvailability();
      toast({ title: 'Date Blocked' });
    } catch {}
  };

  const removeBlockedDate = async (id) => {
    try {
      await axios.delete(`${API}/bookings/blocked-dates/${id}`, { headers });
      fetchAvailability();
    } catch {}
  };

  if (loading) return <div className="text-center py-4"><Loader2 className="w-6 h-6 text-coral-500 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4" data-testid="notary-availability-settings">
      {/* Weekly Schedule */}
      <Card className="bg-cream-100 border-slate-200">
        <CardContent className="p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-coral-500" />
            Weekly Schedule
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Session Duration (min)</label>
              <select
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-white text-sm"
                data-testid="duration-select"
              >
                {[30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Break Between (min)</label>
              <select
                value={breakTime}
                onChange={e => setBreakTime(parseInt(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-white text-sm"
                data-testid="break-select"
              >
                {[0, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {slots.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-2">No availability set. Add time slots below.</p>
            )}
            {slots.map((slot, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200" data-testid={`schedule-slot-${idx}`}>
                <select
                  value={slot.day_of_week}
                  onChange={e => updateSlot(idx, 'day_of_week', e.target.value)}
                  className="bg-cream-100 border border-slate-200 rounded px-2 py-1.5 text-white text-sm flex-1"
                >
                  {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <input
                  type="time"
                  value={slot.start_time}
                  onChange={e => updateSlot(idx, 'start_time', e.target.value)}
                  className="bg-cream-100 border border-slate-200 rounded px-2 py-1.5 text-white text-sm"
                  data-testid={`slot-start-${idx}`}
                />
                <span className="text-slate-500 text-sm">to</span>
                <input
                  type="time"
                  value={slot.end_time}
                  onChange={e => updateSlot(idx, 'end_time', e.target.value)}
                  className="bg-cream-100 border border-slate-200 rounded px-2 py-1.5 text-white text-sm"
                  data-testid={`slot-end-${idx}`}
                />
                <Button onClick={() => removeSlot(idx)} size="sm" variant="ghost" className="text-red-400 h-8 w-8 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={addSlot} size="sm" variant="outline" className="border-coral-300/50 text-coral-500" data-testid="add-time-slot-btn">
              <Plus className="w-3 h-3 mr-1" /> Add Time Slot
            </Button>
            <Button onClick={saveSchedule} size="sm" className="bg-green-600 hover:bg-green-700 ml-auto" disabled={saving} data-testid="save-schedule-btn">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Save Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blocked Dates */}
      <Card className="bg-cream-100 border-slate-200">
        <CardContent className="p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            Blocked Dates
          </h3>

          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={blockDate}
              onChange={e => setBlockDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="bg-white border border-slate-200 rounded-md px-3 py-2 text-white text-sm flex-1"
              data-testid="block-date-input"
            />
            <input
              type="text"
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Reason (optional)"
              className="bg-white border border-slate-200 rounded-md px-3 py-2 text-white text-sm flex-1"
              data-testid="block-reason-input"
            />
            <Button onClick={addBlockedDate} size="sm" className="bg-red-600 hover:bg-red-700" disabled={!blockDate} data-testid="add-block-btn">
              <Ban className="w-3.5 h-3.5 mr-1" /> Block
            </Button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-2">No blocked dates.</p>
          ) : (
            <div className="space-y-1" data-testid="blocked-dates-list">
              {blockedDates.map(b => (
                <div key={b.id} className="flex items-center justify-between py-1.5 px-2 bg-red-500/5 rounded border border-red-500/20">
                  <span className="text-sm text-slate-500">{b.date} {b.reason && <span className="text-slate-500">— {b.reason}</span>}</span>
                  <Button onClick={() => removeBlockedDate(b.id)} size="sm" variant="ghost" className="text-slate-500 hover:text-red-400 h-6 px-1">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotaryAvailabilitySettings;
