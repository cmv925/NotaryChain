import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Search, Star, MapPin, Shield, Filter, Users, Award,
  ChevronRight, Loader2, MessageSquare, Video, Calendar as CalendarIcon,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const SPECIALIZATIONS = ['Real Estate', 'Power of Attorney', 'Estate Planning', 'Business', 'Immigration', 'Healthcare', 'Family Law'];

function StarRating({ rating, size = 'sm' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${s} ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
      ))}
    </div>
  );
}

const NotaryMarketplace = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [notaries, setNotaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [ronOnly, setRonOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [selectedNotary, setSelectedNotary] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [availability, setAvailability] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchNotaries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort_by: sortBy });
      if (searchQuery) params.set('search', searchQuery);
      if (stateFilter) params.set('state', stateFilter);
      if (specFilter) params.set('specialization', specFilter);
      if (ronOnly) params.set('ron_certified', 'true');
      const res = await axios.get(`${API}/marketplace/notaries?${params}`);
      setNotaries(res.data.notaries || []);
    } catch { }
    setLoading(false);
  }, [searchQuery, stateFilter, specFilter, ronOnly, sortBy]);

  useEffect(() => { fetchNotaries(); }, [fetchNotaries]);

  const viewProfile = async (notaryId) => {
    setLoadingProfile(true);
    setShowReviewForm(false);
    setAvailability(null);
    try {
      const res = await axios.get(`${API}/marketplace/notaries/${notaryId}`);
      setSelectedNotary(res.data);
      // Fetch availability
      try {
        const availRes = await axios.get(`${API}/booking/notary/${notaryId}/availability`);
        setAvailability(availRes.data);
      } catch {}
    } catch {
      toast({ title: 'Error', description: 'Failed to load profile', variant: 'destructive' });
    }
    setLoadingProfile(false);
  };

  const submitReview = async () => {
    if (!selectedNotary || !token) return;
    setSubmittingReview(true);
    try {
      await axios.post(`${API}/marketplace/notaries/${selectedNotary.notary_id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
      }, { headers });
      toast({ title: 'Review Submitted', description: 'Thank you for your feedback!' });
      setShowReviewForm(false);
      setReviewComment('');
      setReviewRating(5);
      viewProfile(selectedNotary.notary_id);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to submit review', variant: 'destructive' });
    }
    setSubmittingReview(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {selectedNotary ? (
            /* Notary Profile Detail */
            <div data-testid="notary-profile-detail">
              <Button onClick={() => setSelectedNotary(null)} variant="ghost" className="text-gray-400 mb-4">
                &larr; Back to Marketplace
              </Button>
              <Card className="bg-[#1a2332] border-gray-800 mb-6">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                      {selectedNotary.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-white" data-testid="notary-profile-name">{selectedNotary.name}</h1>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <StarRating rating={selectedNotary.avg_rating} size="md" />
                          <span className="text-amber-400 font-semibold ml-1">{selectedNotary.avg_rating}</span>
                          <span className="text-gray-500 text-sm">({selectedNotary.review_count} reviews)</span>
                        </div>
                        <span className="text-gray-600">|</span>
                        <span className="text-gray-400 text-sm flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {selectedNotary.license_state}
                        </span>
                        {selectedNotary.ron_certified && (
                          <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full border border-green-500/30">RON Certified</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mt-3">{selectedNotary.bio || 'No bio provided.'}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(selectedNotary.specializations || []).map(s => (
                          <span key={s} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20">{s}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-6 mt-4 text-sm">
                        <div><span className="text-gray-500">Rate:</span> <span className="text-white font-semibold">${selectedNotary.hourly_rate}/hr</span></div>
                        <div><span className="text-gray-500">Experience:</span> <span className="text-white font-semibold">{selectedNotary.years_experience} yrs</span></div>
                        <div><span className="text-gray-500">Completed:</span> <span className="text-white font-semibold">{selectedNotary.completed_notarizations}</span></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Book Session Button */}
              <div className="mb-6">
                <Button
                  onClick={() => navigate(`/book/${selectedNotary.notary_id}`)}
                  className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
                  data-testid="book-session-btn"
                >
                  <CalendarIcon className="w-5 h-5 mr-2" />
                  Book a Session with {selectedNotary.name?.split(' ')[0]}
                </Button>
              </div>

              {/* Availability Preview */}
              {availability && (
                <Card className="bg-[#1a2332] border-gray-800 mb-6" data-testid="notary-availability">
                  <CardContent className="p-5">
                    <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-blue-400" />
                      Availability This Week
                    </h3>
                    {availability.availability ? (
                      <div className="grid grid-cols-7 gap-2">
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => {
                          const dayKey = day.toLowerCase();
                          const slots = availability.availability[dayKey] || availability.availability[['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][i]] || [];
                          const hasSlots = Array.isArray(slots) ? slots.length > 0 : !!slots;
                          return (
                            <div key={day} className={`rounded-lg p-2 text-center border ${hasSlots ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-gray-800/30 border-gray-700'}`}>
                              <p className={`text-xs font-medium ${hasSlots ? 'text-emerald-400' : 'text-gray-600'}`}>{day}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{hasSlots ? (Array.isArray(slots) ? `${slots.length} slots` : 'Available') : 'Closed'}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No availability data.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Reviews */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Reviews ({selectedNotary.review_count})</h2>
                {token && !showReviewForm && (
                  <Button size="sm" onClick={() => setShowReviewForm(true)} className="bg-blue-600 hover:bg-blue-500" data-testid="write-review-btn">
                    <MessageSquare className="w-4 h-4 mr-1" /> Write Review
                  </Button>
                )}
              </div>

              {/* Review Form */}
              {showReviewForm && (
                <Card className="bg-[#1a2332] border-blue-500/30 mb-4" data-testid="review-form">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-white font-medium">Rate your experience</h3>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <button key={i} onClick={() => setReviewRating(i)} className="focus:outline-none" data-testid={`review-star-${i}`}>
                          <Star className={`w-7 h-7 ${i <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'} hover:text-amber-300 transition-colors`} />
                        </button>
                      ))}
                      <span className="text-gray-400 text-sm ml-2">{reviewRating}/5</span>
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      placeholder="Share your experience..."
                      rows={3}
                      className="w-full bg-[#0a0f1a] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-blue-500 outline-none"
                      data-testid="review-comment"
                    />
                    <div className="flex gap-2">
                      <Button onClick={submitReview} disabled={submittingReview} className="bg-blue-600 hover:bg-blue-500" data-testid="submit-review-btn">
                        {submittingReview ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        Submit Review
                      </Button>
                      <Button variant="outline" onClick={() => setShowReviewForm(false)} className="border-gray-700 text-gray-400">Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {(selectedNotary.reviews || []).length === 0 ? (
                <p className="text-gray-500 text-sm">No reviews yet.</p>
              ) : (
                <div className="space-y-3" data-testid="notary-reviews">
                  {selectedNotary.reviews.map(review => (
                    <Card key={review.id} className="bg-[#1a2332] border-gray-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">{review.user_name}</span>
                            <StarRating rating={review.rating} />
                          </div>
                          <span className="text-gray-500 text-xs">{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-gray-400 text-sm">{review.comment || 'No comment.'}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Marketplace Listing */
            <div>
              <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                  <Users className="w-7 h-7 text-blue-400" />
                  Notary Marketplace
                </h1>
                <p className="text-gray-400 text-sm mt-1">Find and connect with certified notaries</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-6" data-testid="marketplace-filters">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, state, or bio..."
                    className="bg-[#1a2332] border-gray-700 text-white"
                    data-testid="marketplace-search"
                  />
                </div>
                <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="bg-[#1a2332] border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" data-testid="marketplace-state-filter">
                  <option value="">All States</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={specFilter} onChange={e => setSpecFilter(e.target.value)} className="bg-[#1a2332] border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" data-testid="marketplace-spec-filter">
                  <option value="">All Specializations</option>
                  {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[#1a2332] border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" data-testid="marketplace-sort">
                  <option value="rating">Top Rated</option>
                  <option value="experience">Most Experienced</option>
                  <option value="rate">Lowest Rate</option>
                </select>
                <Button
                  onClick={() => setRonOnly(!ronOnly)}
                  variant={ronOnly ? 'default' : 'outline'}
                  size="sm"
                  className={ronOnly ? 'bg-green-600' : 'border-gray-700 text-gray-300'}
                  data-testid="ron-filter-toggle"
                >
                  <Video className="w-3.5 h-3.5 mr-1" /> RON
                </Button>
              </div>

              {/* Results */}
              {loading ? (
                <div className="text-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></div>
              ) : notaries.length === 0 ? (
                <Card className="bg-[#1a2332] border-gray-800">
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No notaries found matching your criteria.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="notary-list">
                  {notaries.map(notary => (
                    <Card
                      key={notary.notary_id}
                      className="bg-[#1a2332] border-gray-800 hover:border-blue-500/30 transition-colors cursor-pointer"
                      onClick={() => viewProfile(notary.notary_id)}
                      data-testid={`notary-card-${notary.notary_id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                            {notary.name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-white font-semibold truncate">{notary.name}</h3>
                              <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <StarRating rating={notary.avg_rating} />
                              <span className="text-amber-400 text-xs font-semibold">{notary.avg_rating}</span>
                              <span className="text-gray-500 text-xs">({notary.review_count})</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{notary.license_state}</span>
                              <span>${notary.hourly_rate}/hr</span>
                              <span>{notary.completed_notarizations} done</span>
                              {notary.ron_certified && <span className="text-green-400">RON</span>}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(notary.specializations || []).slice(0, 3).map(s => (
                                <span key={s} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded">{s}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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

export default NotaryMarketplace;
