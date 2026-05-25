import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Calendar, Clock, CheckCircle, XCircle, Loader2,
  FileText, User, Video, AlertCircle,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Breadcrumbs } from '../components/Breadcrumbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusCfg = {
  pending: { color: 'text-coral-600', bg: 'bg-coral-500/15', border: 'border-gold-500/30', label: 'Pending' },
  confirmed: { color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30', label: 'Confirmed' },
  completed: { color: 'text-coral-500', bg: 'bg-coral-500/15', border: 'border-coral-300/30', label: 'Completed' },
  cancelled: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'Cancelled' },
};

const MyBookings = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancelling, setCancelling] = useState(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fetchBookings = useCallback(async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await axios.get(`${API}/bookings/my${params}`, { headers });
      setBookings(res.data.bookings || []);
    } catch {}
    setLoading(false);
  }, [filter, headers]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const cancelBooking = async (id) => {
    setCancelling(id);
    try {
      await axios.put(`${API}/bookings/${id}/cancel`, {}, { headers });
      toast({ title: 'Cancelled', description: 'Booking cancelled successfully' });
      fetchBookings();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
    setCancelling(null);
  };

  const upcoming = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
  const past = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'My Bookings' }]} />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-3">
                <Calendar className="w-7 h-7 text-coral-500" />
                My Bookings
              </h1>
              <p className="text-slate-500 text-sm mt-1">Manage your notarization appointments</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/marketplace')} className="bg-coral-500 hover:bg-coral-600" data-testid="find-notary-btn">
                Find a Notary
              </Button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 flex-wrap" data-testid="booking-filters">
            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(f => (
              <Button
                key={f}
                onClick={() => setFilter(f)}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                className={filter === f ? 'bg-coral-500' : 'border-slate-200 text-slate-500'}
                data-testid={`filter-${f}`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 text-coral-500 animate-spin mx-auto" /></div>
          ) : bookings.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">No bookings yet. Find a notary and book a session.</p>
                <Button onClick={() => navigate('/marketplace')} className="bg-coral-500 hover:bg-coral-600" data-testid="empty-find-notary">
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-navy-900 mb-3">Upcoming</h2>
                  <div className="space-y-3" data-testid="upcoming-bookings">
                    {upcoming.map(b => {
                      const cfg = statusCfg[b.status] || statusCfg.pending;
                      return (
                        <Card key={b.id} className={`bg-white border-slate-200 ${cfg.border}`} data-testid={`booking-${b.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="w-14 text-center flex-shrink-0">
                                <div className="text-2xl font-bold text-navy-900">{b.date.split('-')[2]}</div>
                                <div className="text-xs text-slate-500">{new Date(b.date + 'T12:00:00').toLocaleString('en', { month: 'short' })}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-navy-900 font-semibold truncate">{b.document_name}</h3>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-500">
                                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {b.start_time} - {b.end_time}</span>
                                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {b.notary_name}</span>
                                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {b.document_type?.replace(/_/g, ' ')}</span>
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                {b.status === 'confirmed' && (
                                  <Button
                                    onClick={() => navigate(`/session/${b.request_id}`)}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    data-testid={`join-session-${b.id}`}
                                  >
                                    <Video className="w-3.5 h-3.5 mr-1" /> Join
                                  </Button>
                                )}
                                {(b.status === 'pending' || b.status === 'confirmed') && (
                                  <Button
                                    onClick={() => cancelBooking(b.id)}
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                    disabled={cancelling === b.id}
                                    data-testid={`cancel-booking-${b.id}`}
                                  >
                                    {cancelling === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past */}
              {past.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-500 mb-3">Past</h2>
                  <div className="space-y-2 opacity-75" data-testid="past-bookings">
                    {past.map(b => {
                      const cfg = statusCfg[b.status] || statusCfg.completed;
                      return (
                        <Card key={b.id} className="bg-white border-slate-200" data-testid={`booking-${b.id}`}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="w-10 text-center flex-shrink-0">
                              <div className="text-lg font-bold text-slate-500">{b.date.split('-')[2]}</div>
                              <div className="text-[10px] text-slate-600">{new Date(b.date + 'T12:00:00').toLocaleString('en', { month: 'short' })}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-500 text-sm truncate">{b.document_name}</p>
                              <p className="text-slate-500 text-xs">{b.start_time} - {b.end_time} &middot; {b.notary_name}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MyBookings;
