import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  FileText, Search, Clock, Users, Shield, ArrowRight,
  Scale, Home, Lock, Scroll, Building, Landmark, Handshake,
  FileCheck, X, ChevronRight, Star, Anchor,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ICON_MAP = {
  scale: Scale,
  home: Home,
  'file-check': FileCheck,
  scroll: Scroll,
  lock: Lock,
  building: Building,
  landmark: Landmark,
  handshake: Handshake,
};

const CATEGORY_LABELS = {
  legal: 'Legal',
  real_estate: 'Real Estate',
  business: 'Business',
  estate: 'Estate Planning',
};

const CATEGORY_COLORS = {
  legal: 'bg-coral-500/15 text-coral-500 border-coral-300/30',
  real_estate: 'bg-green-500/15 text-green-400 border-green-500/30',
  business: 'bg-navy-600/15 text-navy-500 border-navy-300/30',
  estate: 'bg-coral-500/15 text-coral-600 border-gold-500/30',
};

const TemplateCard = ({ template, onSelect, onPreview }) => {
  const IconComponent = ICON_MAP[template.icon] || FileText;
  const catColor = CATEGORY_COLORS[template.category] || 'bg-gray-500/15 text-slate-500 border-slate-300/30';

  return (
    <Card
      className="bg-white border-slate-200 hover:border-coral-300/50 transition-all group cursor-pointer"
      data-testid={`template-card-${template.id}`}
      onClick={() => onPreview(template)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${catColor.split(' ')[0]}`}>
            <IconComponent className={`w-5 h-5 ${catColor.split(' ')[1]}`} />
          </div>
          <div className="flex items-center gap-2">
            {template.popular && (
              <span className="flex items-center gap-1 text-xs bg-coral-500/15 text-coral-600 border border-gold-500/30 rounded-full px-2 py-0.5">
                <Star className="w-3 h-3" /> Popular
              </span>
            )}
            {template.notarization_required && (
              <span className="text-xs bg-coral-500/15 text-coral-500 border border-coral-300/30 rounded-full px-2 py-0.5">
                Notarization Required
              </span>
            )}
          </div>
        </div>
        <h3 className="text-navy-900 font-semibold text-base mb-1.5 group-hover:text-coral-500 transition-colors">
          {template.name}
        </h3>
        <p className="text-slate-500 text-sm mb-4 line-clamp-2">
          {template.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {template.estimated_time}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {template.signers_needed} signer{template.signers_needed !== 1 ? 's' : ''}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${catColor}`}>
            {CATEGORY_LABELS[template.category] || template.category}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const TemplatePreviewModal = ({ template, onClose, onUse }) => {
  if (!template) return null;
  const IconComponent = ICON_MAP[template.icon] || FileText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="template-preview-modal">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-coral-500/15 flex items-center justify-center">
              <IconComponent className="w-5 h-5 text-coral-500" />
            </div>
            <div>
              <h2 className="text-navy-900 font-bold text-lg">{template.name}</h2>
              <span className="text-slate-500 text-xs">{CATEGORY_LABELS[template.category]}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-navy-900 p-1" data-testid="close-preview-modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-slate-500 text-sm">{template.description}</p>

          {/* Meta info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-cream-100 rounded-lg p-3 text-center">
              <Clock className="w-4 h-4 text-coral-500 mx-auto mb-1" />
              <p className="text-navy-900 text-sm font-medium">{template.estimated_time}</p>
              <p className="text-slate-500 text-xs">Est. Time</p>
            </div>
            <div className="bg-cream-100 rounded-lg p-3 text-center">
              <Users className="w-4 h-4 text-green-400 mx-auto mb-1" />
              <p className="text-navy-900 text-sm font-medium">{template.signers_needed}</p>
              <p className="text-slate-500 text-xs">Signers</p>
            </div>
            <div className="bg-cream-100 rounded-lg p-3 text-center">
              <Shield className="w-4 h-4 text-navy-500 mx-auto mb-1" />
              <p className="text-navy-900 text-sm font-medium">{template.notarization_required ? 'Yes' : 'No'}</p>
              <p className="text-slate-500 text-xs">Notarization</p>
            </div>
          </div>

          {/* Fields Preview */}
          <div>
            <h3 className="text-navy-900 font-semibold text-sm mb-3">Required Information</h3>
            <div className="space-y-2">
              {template.fields?.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-cream-100 rounded-lg px-3 py-2.5 border border-slate-200">
                  <ChevronRight className="w-3.5 h-3.5 text-coral-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-500 text-sm">{field.label}</span>
                    {field.required && <span className="text-red-400 text-xs ml-1">*</span>}
                  </div>
                  <span className="text-slate-600 text-xs flex-shrink-0">{field.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Use button */}
          <Button
            onClick={() => onUse(template)}
            className="w-full bg-coral-500 hover:bg-coral-600 text-navy-900 py-5 text-base"
            data-testid="use-template-btn"
          >
            Use This Template
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const TemplateLibrary = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    if (token) fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect; fetchers are unstable per render
  }, [activeCategory, searchQuery, token]);

  const fetchTemplates = async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.append('category', activeCategory);
      if (searchQuery) params.append('search', searchQuery);

      const res = await axios.get(`${API}/templates/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: Object.fromEntries(params),
      });
      setTemplates(res.data.templates);
      setCategories(res.data.categories);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = (template) => {
    // Navigate to the template wizard for form-fill
    navigate(`/templates/${template.id}/fill`);
    setPreviewTemplate(null);
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="pt-24 sm:pt-32 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Templates' }]} />
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-navy-900 mb-2 sm:mb-3" data-testid="template-library-title">
              Document Template Library
            </h1>
            <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto">
              Start from a pre-built legal template instead of uploading from scratch. Choose a template, fill in your details, and submit for notarization.
            </p>
          </div>

          {/* Smart Contract Templates — anchor agreements on-chain */}
          <button
            onClick={() => navigate('/smart-contracts')}
            className="w-full mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-coral-200 bg-gradient-to-r from-coral-50 to-cream-100 px-5 py-4 text-left hover:border-coral-400 transition-colors group"
            data-testid="anchor-blockchain-cta"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center flex-shrink-0">
                <Anchor className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-navy-900 text-sm">Smart Contract Templates — anchor on the blockchain</p>
                <p className="text-slate-600 text-xs mt-0.5">Generate a standard agreement and seal an immutable, timestamped proof on Hedera.</p>
              </div>
            </div>
            <span className="text-coral-600 text-sm font-semibold whitespace-nowrap group-hover:translate-x-0.5 transition-transform">Open library →</span>
          </button>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-slate-200 text-navy-900 placeholder:text-slate-500"
                data-testid="template-search-input"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={activeCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(null)}
                className={activeCategory === null
                  ? 'bg-coral-500 text-navy-900'
                  : 'border-slate-200 text-slate-500 hover:text-navy-900'}
                data-testid="filter-all"
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={activeCategory === cat
                    ? 'bg-coral-500 text-navy-900'
                    : 'border-slate-200 text-slate-500 hover:text-navy-900'}
                  data-testid={`filter-${cat}`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Template Grid */}
          {loading ? (
            <div className="text-center py-20 text-slate-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-20" data-testid="no-templates">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No templates found. Try a different search or filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="template-grid">
              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onSelect={handleUseTemplate}
                  onPreview={setPreviewTemplate}
                />
              ))}
            </div>
          )}

          {/* CTA to upload manually */}
          <div className="mt-10 text-center">
            <p className="text-slate-500 text-sm mb-3">Don't see what you need?</p>
            <Button
              onClick={() => navigate('/request-notarization')}
              variant="outline"
              className="border-slate-200 text-slate-500 hover:text-navy-900 hover:border-coral-300"
              data-testid="upload-own-document-btn"
            >
              <FileText className="w-4 h-4 mr-2" />
              Upload Your Own Document
            </Button>
          </div>
        </div>
      </div>
      <Footer />

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={handleUseTemplate}
        />
      )}
    </div>
  );
};

export default TemplateLibrary;
