import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import {
  FileText, ArrowRight, ArrowLeft, Sparkles, Download,
  Loader2, CheckCircle, AlertCircle, Send, Save, Share2,
  History, Link, Copy, Clock, X,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AI_ELIGIBLE_TYPES = ['textarea'];

const FieldInput = ({ field, value, onChange, onAiSuggest, aiLoading }) => {
  const isAiEligible = AI_ELIGIBLE_TYPES.includes(field.type);

  if (field.type === 'textarea') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-gray-200 text-sm">
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </Label>
          {isAiEligible && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAiSuggest(field)}
              disabled={aiLoading}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs h-7 px-2"
              data-testid={`ai-suggest-${field.name}`}
            >
              {aiLoading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3 mr-1" />
              )}
              AI Suggest
            </Button>
          )}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
          rows={4}
          className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-navy-900 text-sm focus:border-blue-500 focus:outline-none resize-none"
          data-testid={`field-${field.name}`}
        />
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="space-y-2">
        <Label className="text-gray-200 text-sm">
          {field.label} {field.required && <span className="text-red-400">*</span>}
        </Label>
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className="bg-[#0a0f1a] border-gray-700 text-navy-900 text-sm"
          data-testid={`field-${field.name}`}
        />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="space-y-2">
        <Label className="text-gray-200 text-sm">
          {field.label} {field.required && <span className="text-red-400">*</span>}
        </Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder || '0'}
          className="bg-[#0a0f1a] border-gray-700 text-navy-900 text-sm"
          data-testid={`field-${field.name}`}
        />
      </div>
    );
  }

  // Default: text
  return (
    <div className="space-y-2">
      <Label className="text-gray-200 text-sm">
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
        className="bg-[#0a0f1a] border-gray-700 text-navy-900 text-sm"
        data-testid={`field-${field.name}`}
      />
    </div>
  );
};

const LivePreview = ({ template, fieldValues }) => {
  const filledCount = template?.fields?.filter(f => fieldValues[f.name]?.trim()).length || 0;
  const totalCount = template?.fields?.length || 0;
  const progress = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  return (
    <Card className="bg-[#1a2332] border-gray-800 sticky top-24">
      <CardContent className="p-5">
        <h3 className="text-navy-900 font-semibold text-sm mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          Document Preview
        </h3>

        <div className="flex items-center gap-2 mb-4">
          <Progress value={progress} className="flex-1 h-1.5" />
          <span className="text-gray-400 text-xs">{filledCount}/{totalCount}</span>
        </div>

        {/* Mini document preview */}
        <div className="bg-white rounded-lg p-4 text-[10px] leading-relaxed max-h-[400px] overflow-y-auto" data-testid="live-preview">
          <div className="text-center mb-3">
            <p className="font-bold text-gray-900 text-xs uppercase tracking-wide">
              {template?.name || 'Document'}
            </p>
            <p className="text-gray-400 text-[8px]">NotaryChain Generated Document</p>
            <hr className="my-2 border-gray-300" />
          </div>

          {template?.fields?.map((field) => {
            const val = fieldValues[field.name];
            if (!val) return null;
            return (
              <div key={field.name} className="mb-2">
                <p className="text-gray-400 uppercase text-[7px] tracking-wider">{field.label}</p>
                <p className="text-gray-900 text-[9px]">{val}</p>
              </div>
            );
          })}

          {filledCount === 0 && (
            <p className="text-gray-300 text-center py-4 italic text-[9px]">
              Start filling fields to see the preview...
            </p>
          )}

          {filledCount > 0 && (
            <>
              <hr className="my-3 border-gray-200" />
              <div className="space-y-3">
                {Array.from({ length: template?.signers_needed || 1 }).map((_, i) => (
                  <div key={i}>
                    <div className="border-b border-gray-400 w-1/2 mb-0.5" />
                    <p className="text-gray-500 text-[7px]">Signature (Party {i + 1})</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const TemplateWizard = () => {
  const { templateId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  // Read draft query param
  const searchParams = new URLSearchParams(window.location.search);
  const draftParam = searchParams.get('draft');

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fieldValues, setFieldValues] = useState({});
  const [generating, setGenerating] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState(null);

  // Draft state
  const [draftId, setDraftId] = useState(draftParam || null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (token && templateId) fetchTemplate();
  }, [token, templateId]);

  const fetchTemplate = async () => {
    try {
      const res = await axios.get(`${API}/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplate(res.data);

      // If loading from a draft, get draft data
      if (draftParam) {
        try {
          const draftRes = await axios.get(`${API}/drafts/${draftParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setFieldValues(draftRes.data.field_values || {});
          setDraftVersion(draftRes.data.version);
          setShareToken(draftRes.data.share_token);
        } catch {
          // Draft not found, initialize fresh
          const init = {};
          (res.data.fields || []).forEach((f) => { init[f.name] = ''; });
          setFieldValues(init);
        }
      } else {
        const init = {};
        (res.data.fields || []).forEach((f) => { init[f.name] = ''; });
        setFieldValues(init);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Template not found', variant: 'destructive' });
      navigate('/templates');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (name, value) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleAiSuggest = async (field) => {
    setAiLoadingField(field.name);
    try {
      const res = await axios.post(
        `${API}/templates/${templateId}/ai-suggest`,
        {
          field_label: field.label,
          field_name: field.name,
          existing_values: fieldValues,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFieldValues((prev) => ({ ...prev, [field.name]: res.data.suggestion }));
      toast({ title: 'AI Suggestion Applied', description: `Generated text for "${field.label}"` });
    } catch (error) {
      toast({ title: 'AI Suggestion Failed', description: 'Could not generate suggestion', variant: 'destructive' });
    } finally {
      setAiLoadingField(null);
    }
  };

  // --- Draft Handlers ---
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      if (draftId) {
        // Update existing draft
        const res = await axios.put(`${API}/drafts/${draftId}`, {
          field_values: fieldValues,
          name: `${template.name} - Draft`,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setDraftVersion(res.data.version);
        toast({ title: 'Draft Saved', description: `Version ${res.data.version}` });
      } else {
        // Create new draft
        const res = await axios.post(`${API}/drafts/`, {
          template_id: templateId,
          template_name: template.name,
          field_values: fieldValues,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setDraftId(res.data.id);
        setDraftVersion(res.data.version);
        setShareToken(res.data.share_token);
        toast({ title: 'Draft Saved', description: 'You can resume this draft anytime.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save draft', variant: 'destructive' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleShareDraft = async (allowEdit) => {
    if (!draftId) {
      toast({ title: 'Save First', description: 'Please save as draft before sharing.', variant: 'destructive' });
      return;
    }
    try {
      const res = await axios.post(`${API}/drafts/${draftId}/share`, {
        allow_edit: allowEdit,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShareToken(res.data.share_token);
      setShowShareModal(true);
      toast({ title: 'Share Link Created', description: allowEdit ? 'Recipients can edit this draft.' : 'View-only link created.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create share link', variant: 'destructive' });
    }
  };

  const handleRevokeShare = async () => {
    try {
      await axios.delete(`${API}/drafts/${draftId}/share`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShareToken(null);
      setShowShareModal(false);
      toast({ title: 'Revoked', description: 'Share link has been revoked.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to revoke', variant: 'destructive' });
    }
  };

  const handleShowRevisions = async () => {
    if (!draftId) return;
    try {
      const res = await axios.get(`${API}/drafts/${draftId}/revisions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRevisions(res.data.revisions);
      setShowRevisions(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load revisions', variant: 'destructive' });
    }
  };

  const handleRestoreRevision = async (version) => {
    try {
      await axios.post(`${API}/drafts/${draftId}/revisions/${version}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Reload draft
      const res = await axios.get(`${API}/drafts/${draftId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFieldValues(res.data.field_values);
      setDraftVersion(res.data.version);
      setShowRevisions(false);
      toast({ title: 'Restored', description: `Restored to version ${version}` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to restore', variant: 'destructive' });
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/drafts/shared/${shareToken}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Copied!', description: 'Share link copied to clipboard.' });
  };


  const handleGeneratePdf = async () => {
    // Validate required fields
    const missing = (template?.fields || []).filter(
      (f) => f.required && !fieldValues[f.name]?.trim()
    );
    if (missing.length > 0) {
      toast({
        title: 'Missing Required Fields',
        description: `Please fill: ${missing.map((f) => f.label).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const res = await axios.post(
        `${API}/templates/${templateId}/generate`,
        { field_values: fieldValues },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setGeneratedPdfUrl(url);
      toast({ title: 'PDF Generated!', description: 'Your document is ready for download or notarization.' });
    } catch (error) {
      toast({ title: 'Generation Failed', description: 'Could not generate PDF', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPdfUrl) return;
    const a = document.createElement('a');
    a.href = generatedPdfUrl;
    a.download = `${(template?.name || 'document').replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  const handleProceedToNotarization = async () => {
    // Generate PDF first if not already
    if (!generatedPdfUrl) {
      await handleGeneratePdf();
    }

    // Fetch the PDF blob and create a File object for the notarization flow
    if (generatedPdfUrl) {
      const res = await fetch(generatedPdfUrl);
      const blob = await res.blob();
      const file = new File([blob], `${(template?.name || 'document').replace(/\s+/g, '_')}.pdf`, {
        type: 'application/pdf',
      });

      navigate('/request-notarization', {
        state: {
          fromTemplate: true,
          templateId: template.id,
          templateName: template.name,
          documentType: template.document_type,
          signersNeeded: template.signers_needed,
          generatedFile: true,
        },
      });
    }
  };

  const filledCount = template?.fields?.filter((f) => fieldValues[f.name]?.trim()).length || 0;
  const totalCount = template?.fields?.length || 0;
  const requiredFilled = template?.fields?.filter(
    (f) => !f.required || fieldValues[f.name]?.trim()
  ).length || 0;
  const allRequiredFilled = requiredFilled === totalCount;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/templates')}
              className="text-gray-400 hover:text-navy-900 mb-3"
              data-testid="back-to-templates"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Templates
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-1" data-testid="wizard-title">
              {template.name}
            </h1>
            <p className="text-gray-400 text-sm">{template.description}</p>
          </div>

          {/* Draft Action Bar */}
          <div className="mb-4 flex items-center gap-2 flex-wrap" data-testid="draft-action-bar">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={savingDraft || filledCount === 0}
              className="border-gray-700 text-gray-300 hover:text-navy-900 hover:border-blue-500"
              data-testid="save-draft-btn"
            >
              {savingDraft ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              {draftId ? 'Update Draft' : 'Save as Draft'}
            </Button>
            {draftId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShareDraft(false)}
                  className="border-gray-700 text-gray-300 hover:text-navy-900 hover:border-purple-500"
                  data-testid="share-draft-btn"
                >
                  <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShowRevisions}
                  className="border-gray-700 text-gray-300 hover:text-navy-900 hover:border-amber-500"
                  data-testid="revisions-btn"
                >
                  <History className="w-3.5 h-3.5 mr-1.5" /> History ({draftVersion} rev{draftVersion !== 1 ? 's' : ''})
                </Button>
              </>
            )}
            {draftId && (
              <span className="text-gray-600 text-xs ml-auto">Draft v{draftVersion}</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-6 flex items-center gap-3">
            <Progress value={(filledCount / totalCount) * 100} className="flex-1 h-2" />
            <span className="text-gray-400 text-sm whitespace-nowrap">
              {filledCount} of {totalCount} fields filled
            </span>
          </div>

          {/* Main content: form + preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-2">
              <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <h2 className="text-navy-900 font-semibold">Fill in Document Details</h2>
                    <span className="ml-auto flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 rounded-full px-2 py-0.5">
                      <Sparkles className="w-3 h-3" /> AI-Assisted
                    </span>
                  </div>

                  <div className="space-y-5" data-testid="wizard-form">
                    {template.fields.map((field) => (
                      <FieldInput
                        key={field.name}
                        field={field}
                        value={fieldValues[field.name] || ''}
                        onChange={handleFieldChange}
                        onAiSuggest={handleAiSuggest}
                        aiLoading={aiLoadingField === field.name}
                      />
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-8 space-y-3">
                    {!generatedPdfUrl ? (
                      <Button
                        onClick={handleGeneratePdf}
                        disabled={generating || !allRequiredFilled}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-navy-900 py-5 text-base"
                        data-testid="generate-pdf-btn"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Generating PDF...
                          </>
                        ) : (
                          <>
                            <FileText className="w-5 h-5 mr-2" />
                            Generate PDF Document
                          </>
                        )}
                      </Button>
                    ) : (
                      <>
                        {/* Success banner */}
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3" data-testid="pdf-generated-banner">
                          <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                          <div>
                            <p className="text-green-400 font-medium">PDF Generated Successfully</p>
                            <p className="text-gray-400 text-sm">Your document is ready for download or notarization.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button
                            onClick={handleDownload}
                            variant="outline"
                            className="border-gray-600 text-gray-200 hover:text-navy-900 hover:border-blue-500 py-5"
                            data-testid="download-pdf-btn"
                          >
                            <Download className="w-5 h-5 mr-2" />
                            Download PDF
                          </Button>
                          <Button
                            onClick={handleProceedToNotarization}
                            className="bg-green-600 hover:bg-green-700 text-navy-900 py-5"
                            data-testid="proceed-notarization-btn"
                          >
                            <Send className="w-5 h-5 mr-2" />
                            Proceed to Notarization
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>

                        {/* Regenerate */}
                        <Button
                          onClick={() => { setGeneratedPdfUrl(null); }}
                          variant="ghost"
                          size="sm"
                          className="w-full text-gray-500 hover:text-gray-300"
                          data-testid="regenerate-btn"
                        >
                          Edit fields and regenerate
                        </Button>
                      </>
                    )}

                    {!allRequiredFilled && !generatedPdfUrl && (
                      <div className="flex items-center gap-2 text-xs text-coral-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Fill all required fields to generate the PDF
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview Column */}
            <div className="hidden lg:block">
              <LivePreview template={template} fieldValues={fieldValues} />
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {/* Share Modal */}
      {showShareModal && shareToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="share-modal">
          <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-navy-900 font-bold text-lg flex items-center gap-2">
                <Share2 className="w-5 h-5 text-purple-400" /> Share Draft
              </h2>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-navy-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#0a0f1a] rounded-lg p-3 flex items-center gap-2 mb-4">
              <Link className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-gray-300 text-sm truncate flex-1">{`${window.location.origin}/drafts/shared/${shareToken}`}</span>
              <Button size="sm" variant="ghost" onClick={copyShareLink} className="text-blue-400 hover:text-blue-300" data-testid="copy-share-link">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex gap-2 mb-4">
              <Button size="sm" onClick={() => handleShareDraft(false)} className={`flex-1 ${!shareToken ? 'bg-blue-600' : 'bg-gray-700'} text-navy-900`} data-testid="share-view-only">
                View Only
              </Button>
              <Button size="sm" onClick={() => handleShareDraft(true)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-navy-900" data-testid="share-allow-edit">
                Allow Editing
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRevokeShare} className="w-full text-red-400 hover:text-red-300" data-testid="revoke-share-btn">
              Revoke Share Link
            </Button>
          </div>
        </div>
      )}

      {/* Revisions Modal */}
      {showRevisions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="revisions-modal">
          <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-navy-900 font-bold text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-coral-600" /> Version History
              </h2>
              <button onClick={() => setShowRevisions(false)} className="text-gray-400 hover:text-navy-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {[...revisions].reverse().map((rev) => (
                <div key={rev.version} className={`p-3 rounded-lg border ${
                  rev.version === draftVersion
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-[#0a0f1a] border-gray-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-navy-900 font-medium text-sm">Version {rev.version}</span>
                      {rev.version === draftVersion && (
                        <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5">Current</span>
                      )}
                    </div>
                    {rev.version !== draftVersion && (
                      <Button size="sm" variant="ghost" onClick={() => handleRestoreRevision(rev.version)} className="text-blue-400 hover:text-blue-300 text-xs h-7" data-testid={`restore-v${rev.version}`}>
                        Restore
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(rev.saved_at).toLocaleString()}</span>
                    <span>&bull;</span>
                    <span>{rev.saved_by}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {Object.keys(rev.field_values).filter(k => rev.field_values[k]).length} fields filled
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateWizard;
