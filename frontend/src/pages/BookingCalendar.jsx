import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Calendar as CalendarIcon, Clock, ArrowLeft, ChevronLeft, ChevronRight,
  Loader2, CheckCircle, Star, MapPin, Video, FileText, Send,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DOC_TYPES = ['power_of_attorney', 'real_estate', 'affidavit', 'trust', 'will', 'contract', 'deed', 'other'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

const BookingCalendar = () => {
  const { notaryId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [notary, setNotary] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Booking form
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('power_of_attorney');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const fetchNotary = useCallback(async () => {
    try {
      const [profileRes, availRes] = await Promise.all([
        axios.get(`${API}/marketplace/notaries/${notaryId}`),
        axios.get(`${API}/bookings/availability/${notaryId}`),
      ]);
      setNotary(profileRes.data);
      setAvailability(availRes.data.schedule);
      setBlockedDates(availRes.data.blocked_dates || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load notary', variant: 'destructive' });
    }
    setLoading(false);
  }, [notaryId]);

  useEffect(() => { fetchNotary(); }, [fetchNotary]);

  const fetchSlots = async (dateStr) => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const res = await axios.get(`${API}/bookings/slots/${notaryId}?date=${dateStr}`);
      setSlots(res.data.slots || []);
    } catch {
      setSlots([]);
    }
    setLoadingSlots(false);
  };

  const handleDateClick = (day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(viewYear, viewMonth, day);
    if (dateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return;
    if (blockedDates.includes(dateStr)) return;

    setSelectedDate(dateStr);
    fetchSlots(dateStr);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const isDateAvailable = (day) => {
    const dateObj = new Date(viewYear, viewMonth, day);
    if (dateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return false;
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (blockedDates.includes(dateStr)) return false;
    if (!availability?.weekly_slots) return false;
    const dow = dateObj.getDay();
    const dowMon = dow === 0 ? 6 : dow - 1; // Convert to 0=Monday
    return availability.weekly_slots.some(s => s.day_of_week === dowMon);
  };

  const handleBook = async () => {
    if (!selectedSlot || !docName.trim()) {
      toast({ title: 'Error', description: 'Select a slot and enter document name', variant: 'destructive' });
      return;
    }
    setBooking(true);
    try {
      const res = await axios.post(`${API}/bookings`, {
        notary_id: notaryId,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        document_name: docName,
        document_type: docType,
        notes,
      }, { headers });
      setBookingSuccess(res.data.booking);
      toast({ title: 'Booked', description: 'Your booking has been submitted!' });
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Booking failed', variant: 'destructive' });
    }
    setBooking(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
    </div>
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth).toLocaleString('en', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Button onClick={() => navigate('/marketplace')} variant="ghost" className="text-gray-400 mb-4" data-testid="back-to-marketplace">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Marketplace
          </Button>

          {/* Notary Header */}
          {notary && (
            <Card className="bg-[#1a2332] border-gray-800 mb-6" data-testid="booking-notary-header">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-navy-900 text-xl font-bold flex-shrink-0">
                  {notary.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-navy-900">{notary.name}</h1>
                  <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {notary.license_state}</span>
                    <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-coral-600" /> {notary.avg_rating}</span>
                    <span>${notary.hourly_rate}/hr</span>
                    {notary.ron_certified && <span className="text-green-400">RON Certified</span>}
                  </div>
                </div>
                <CalendarIcon className="w-8 h-8 text-blue-400" />
              </CardContent>
            </Card>
          )}

          {bookingSuccess ? (
            /* Booking Confirmation */
            <Card className="bg-[#1a2332] border-green-500/30" data-testid="booking-success">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-navy-900 mb-2">Booking Submitted!</h2>
                <p className="text-gray-400 mb-6">Your notarization session has been booked. The notary will confirm shortly.</p>
                <div className="bg-[#0d1520] rounded-lg p-4 border border-gray-800 max-w-sm mx-auto mb-6 text-left">
                  <div className="flex justify-between py-1"><span className="text-gray-500 text-sm">Date</span><span className="text-navy-900 text-sm font-medium">{bookingSuccess.date}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500 text-sm">Time</span><span className="text-navy-900 text-sm font-medium">{bookingSuccess.start_time} - {bookingSuccess.end_time}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500 text-sm">Document</span><span className="text-navy-900 text-sm font-medium">{bookingSuccess.document_name}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500 text-sm">Status</span><span className="text-coral-600 text-sm font-medium">Pending Confirmation</span></div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => navigate('/my-bookings')} className="bg-blue-600 hover:bg-blue-700" data-testid="go-to-bookings">
                    View My Bookings
                  </Button>
                  <Button onClick={() => navigate('/dashboard')} variant="outline" className="border-gray-700 text-gray-300">
                    Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="booking-layout">
              {/* Weekly Availability Overview */}
              {availability?.weekly_slots && (
                <Card className="bg-[#1a2332] border-gray-800 mb-0 lg:col-span-2" data-testid="weekly-availability-overview">
                  <CardContent className="p-5">
                    <h3 className="text-navy-900 font-semibold mb-3 text-sm">Weekly Availability Pattern</h3>
                    <div className="grid grid-cols-7 gap-2">
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => {
                        const daySlots = availability.weekly_slots.filter(s => s.day_of_week === i);
                        const hasSlots = daySlots.length > 0;
                        const totalHours = daySlots.reduce((acc, s) => {
                          const [sh, sm] = (s.start_time || '09:00').split(':').map(Number);
                          const [eh, em] = (s.end_time || '17:00').split(':').map(Number);
                          return acc + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                        }, 0);
                        return (
                          <div key={day} className={`rounded-xl p-3 text-center border transition-all ${hasSlots ? 'bg-coral-500/5 border-coral-200 hover:bg-coral-500/10' : 'bg-gray-800/20 border-gray-800'}`}>
                            <p className={`text-xs font-bold mb-1 ${hasSlots ? 'text-coral-600' : 'text-gray-600'}`}>{day}</p>
                            {hasSlots ? (
                              <>
                                <p className="text-navy-900 text-lg font-bold">{daySlots.length}</p>
                                <p className="text-gray-500 text-[10px]">{totalHours.toFixed(0)}h available</p>
                              </>
                            ) : (
                              <p className="text-gray-700 text-xs mt-2">Closed</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Calendar */}
              <Card className="bg-[#1a2332] border-gray-800" data-testid="booking-calendar">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <Button onClick={prevMonth} variant="ghost" className="text-gray-400 h-8 w-8 p-0" data-testid="cal-prev">
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <h2 className="text-navy-900 font-semibold" data-testid="cal-month">{monthName}</h2>
                    <Button onClick={nextMonth} variant="ghost" className="text-gray-400 h-8 w-8 p-0" data-testid="cal-next">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS.map(d => (
                      <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }, (_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const available = isDateAvailable(day);
                      const isSelected = dateStr === selectedDate;
                      const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();

                      return (
                        <button
                          key={day}
                          onClick={() => available && handleDateClick(day)}
                          disabled={!available}
                          className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all
                            ${isSelected ? 'bg-blue-600 text-navy-900 ring-2 ring-blue-400' :
                              available ? 'bg-[#0d1520] text-navy-900 hover:bg-blue-600/30 cursor-pointer border border-gray-800 hover:border-blue-500/50' :
                              'text-gray-700 cursor-not-allowed'}
                            ${isToday && !isSelected ? 'ring-1 ring-amber-500/50' : ''}
                          `}
                          data-testid={`cal-day-${day}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#0d1520] border border-gray-800" /> Available</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600" /> Selected</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-transparent border border-dashed border-gray-700" /> Unavailable</span>
                  </div>
                </CardContent>
              </Card>

              {/* Slot selection & Booking form */}
              <div className="space-y-4">
                {selectedDate && (
                  <Card className="bg-[#1a2332] border-gray-800" data-testid="time-slots">
                    <CardContent className="p-5">
                      <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        Available Times — {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h3>
                      {loadingSlots ? (
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto my-4" />
                      ) : slots.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No available slots on this date.</p>
                      ) : (
                        <div data-testid="slot-grid">
                          {/* Period-based slot grouping */}
                          {(() => {
                            const morning = slots.filter(s => parseInt(s.start_time) < 12);
                            const afternoon = slots.filter(s => parseInt(s.start_time) >= 12 && parseInt(s.start_time) < 17);
                            const evening = slots.filter(s => parseInt(s.start_time) >= 17);
                            const periods = [
                              { label: 'Morning', slots: morning, icon: '☀', color: 'amber' },
                              { label: 'Afternoon', slots: afternoon, icon: '🌤', color: 'blue' },
                              { label: 'Evening', slots: evening, icon: '🌙', color: 'purple' },
                            ].filter(p => p.slots.length > 0);
                            return periods.map(period => (
                              <div key={period.label} className="mb-3">
                                <p className={`text-${period.color}-400 text-xs font-medium mb-1.5 uppercase tracking-wider`}>
                                  {period.label} ({period.slots.length})
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  {period.slots.map(slot => (
                                    <button
                                      key={slot.start_time}
                                      onClick={() => setSelectedSlot(slot)}
                                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all border
                                        ${selectedSlot?.start_time === slot.start_time
                                          ? 'bg-blue-600 text-navy-900 border-blue-400'
                                          : slot.booked
                                            ? 'bg-red-500/10 text-red-400/50 border-red-500/20 cursor-not-allowed line-through'
                                            : 'bg-[#0d1520] text-gray-300 border-gray-800 hover:border-blue-500/50 hover:text-navy-900'}
                                      `}
                                      disabled={slot.booked}
                                      data-testid={`slot-${slot.start_time}`}
                                    >
                                      {slot.start_time}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedSlot && (
                  <Card className="bg-[#1a2332] border-gray-800" data-testid="booking-form">
                    <CardContent className="p-5">
                      <h3 className="text-navy-900 font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-400" />
                        Booking Details
                      </h3>
                      <div className="bg-[#0d1520] rounded-lg p-3 border border-blue-500/20 mb-4">
                        <p className="text-blue-400 text-sm font-medium">
                          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })} &middot; {selectedSlot.start_time} - {selectedSlot.end_time}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-300 block mb-1">Document Name *</label>
                          <Input
                            value={docName}
                            onChange={e => setDocName(e.target.value)}
                            placeholder="e.g., Power of Attorney for John Smith"
                            className="bg-[#0a0f1a] border-gray-700 text-navy-900"
                            data-testid="booking-doc-name"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-300 block mb-1">Document Type</label>
                          <select
                            value={docType}
                            onChange={e => setDocType(e.target.value)}
                            className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-navy-900 text-sm focus:border-blue-500 outline-none"
                            data-testid="booking-doc-type"
                          >
                            {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-gray-300 block mb-1">Notes (optional)</label>
                          <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Any additional details..."
                            rows={2}
                            className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-navy-900 text-sm focus:border-blue-500 outline-none resize-none"
                            data-testid="booking-notes"
                          />
                        </div>
                        <Button
                          onClick={handleBook}
                          disabled={booking || !docName.trim()}
                          className="w-full bg-green-600 hover:bg-green-700"
                          data-testid="confirm-booking-btn"
                        >
                          {booking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                          Confirm Booking
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!selectedDate && (
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-8 text-center">
                      <CalendarIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">Select a date on the calendar to see available time slots</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BookingCalendar;
