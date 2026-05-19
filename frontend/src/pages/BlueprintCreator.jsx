import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { 
  Plus, ArrowLeft, GripVertical, Trash2, Save, FileText,
  CheckCircle, Shield, DollarSign, PenTool, Clock, Users,
  ChevronDown, ChevronUp, Settings
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const transactionTypes = [
  { value: 'real_estate_closing', label: 'Real Estate Closing' },
  { value: 'business_contract', label: 'Business Contract' },
  { value: 'estate_settlement', label: 'Estate Settlement' },
  { value: 'trust_settlement', label: 'Trust Settlement' },
  { value: 'merger_acquisition', label: 'Merger & Acquisition' },
  { value: 'loan_closing', label: 'Loan Closing' },
  { value: 'custom', label: 'Custom' }
];

const availableRoles = [
  'owner', 'buyer', 'seller', 'agent', 'lender', 'title_company',
  'attorney', 'notary', 'executor', 'beneficiary', 'witness', 'signer', 'reviewer'
];

const defaultStep = {
  name: '',
  description: '',
  required_roles: [],
  dependencies: [],
  estimated_duration_hours: 24,
  is_required: true,
  requires_document: false,
  requires_signature: false,
  requires_notarization: false,
  requires_payment: false
};

export default function BlueprintCreator() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [blueprint, setBlueprint] = useState({
    name: '',
    description: '',
    transaction_type: 'custom',
    estimated_total_days: 30,
    required_roles: [],
    required_documents: [],
    steps: [],
    ai_enabled: true
  });
  
  const [saving, setSaving] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);
  const [newDocument, setNewDocument] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const addStep = () => {
    const newStep = {
      ...defaultStep,
      id: `step_${Date.now()}`,
      order: blueprint.steps.length + 1
    };
    setBlueprint({
      ...blueprint,
      steps: [...blueprint.steps, newStep]
    });
    setExpandedStep(newStep.id);
  };

  const updateStep = (stepId, field, value) => {
    setBlueprint({
      ...blueprint,
      steps: blueprint.steps.map(step => 
        step.id === stepId ? { ...step, [field]: value } : step
      )
    });
  };

  const removeStep = (stepId) => {
    setBlueprint({
      ...blueprint,
      steps: blueprint.steps
        .filter(step => step.id !== stepId)
        .map((step, idx) => ({ ...step, order: idx + 1 }))
    });
  };

  const moveStep = (stepId, direction) => {
    const currentIndex = blueprint.steps.findIndex(s => s.id === stepId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= blueprint.steps.length) return;
    
    const newSteps = [...blueprint.steps];
    [newSteps[currentIndex], newSteps[newIndex]] = [newSteps[newIndex], newSteps[currentIndex]];
    
    setBlueprint({
      ...blueprint,
      steps: newSteps.map((step, idx) => ({ ...step, order: idx + 1 }))
    });
  };

  const toggleStepRole = (stepId, role) => {
    const step = blueprint.steps.find(s => s.id === stepId);
    const roles = step.required_roles.includes(role)
      ? step.required_roles.filter(r => r !== role)
      : [...step.required_roles, role];
    updateStep(stepId, 'required_roles', roles);
  };

  const toggleStepDependency = (stepId, depId) => {
    const step = blueprint.steps.find(s => s.id === stepId);
    const deps = step.dependencies.includes(depId)
      ? step.dependencies.filter(d => d !== depId)
      : [...step.dependencies, depId];
    updateStep(stepId, 'dependencies', deps);
  };

  const addDocument = () => {
    if (!newDocument.trim()) return;
    setBlueprint({
      ...blueprint,
      required_documents: [...blueprint.required_documents, newDocument.trim()]
    });
    setNewDocument('');
  };

  const removeDocument = (doc) => {
    setBlueprint({
      ...blueprint,
      required_documents: blueprint.required_documents.filter(d => d !== doc)
    });
  };

  const toggleRole = (role) => {
    const roles = blueprint.required_roles.includes(role)
      ? blueprint.required_roles.filter(r => r !== role)
      : [...blueprint.required_roles, role];
    setBlueprint({ ...blueprint, required_roles: roles });
  };

  const saveBlueprint = async () => {
    if (!blueprint.name.trim()) {
      alert('Please enter a blueprint name');
      return;
    }
    if (blueprint.steps.length === 0) {
      alert('Please add at least one step');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/transactions/blueprints`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(blueprint)
      });

      if (response.ok) {
        alert('Blueprint created successfully!');
        navigate('/admin');
      } else {
        const error = await response.json();
        alert(`Failed to create blueprint: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 text-navy-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigate(-1)} 
              variant="ghost" 
              className="text-slate-500 hover:text-navy-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create Blueprint</h1>
              <p className="text-slate-500 text-sm">Design a custom transaction workflow template</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowPreview(true)}
              variant="outline"
              className="border-slate-200"
            >
              Preview
            </Button>
            <Button
              onClick={saveBlueprint}
              disabled={saving}
              className="bg-coral-500 text-black hover:bg-coral-600"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Blueprint
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-navy-900">Blueprint Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Blueprint Name *</label>
                  <Input
                    value={blueprint.name}
                    onChange={(e) => setBlueprint({ ...blueprint, name: e.target.value })}
                    placeholder="e.g., Commercial Lease Agreement"
                    className="bg-cream-100 border-slate-200 text-navy-900"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Description</label>
                  <Input
                    value={blueprint.description}
                    onChange={(e) => setBlueprint({ ...blueprint, description: e.target.value })}
                    placeholder="Describe this workflow..."
                    className="bg-cream-100 border-slate-200 text-navy-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500 mb-1 block">Transaction Type</label>
                    <select
                      value={blueprint.transaction_type}
                      onChange={(e) => setBlueprint({ ...blueprint, transaction_type: e.target.value })}
                      className="w-full p-2 rounded-lg bg-cream-100 border border-slate-200 text-navy-900"
                    >
                      {transactionTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500 mb-1 block">Est. Duration (Days)</label>
                    <Input
                      type="number"
                      value={blueprint.estimated_total_days}
                      onChange={(e) => setBlueprint({ ...blueprint, estimated_total_days: parseInt(e.target.value) || 30 })}
                      className="bg-cream-100 border-slate-200 text-navy-900"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Steps */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-navy-900">Workflow Steps ({blueprint.steps.length})</CardTitle>
                <Button onClick={addStep} size="sm" className="bg-coral-500 text-black hover:bg-coral-600">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </Button>
              </CardHeader>
              <CardContent>
                {blueprint.steps.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No steps added yet. Click "Add Step" to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blueprint.steps.map((step, index) => (
                      <div 
                        key={step.id} 
                        className="bg-cream-100 rounded-lg border border-slate-200 overflow-hidden"
                      >
                        {/* Step Header */}
                        <div 
                          className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white"
                          onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                        >
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'up'); }}
                              disabled={index === 0}
                              className="text-slate-500 hover:text-navy-900 disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'down'); }}
                              disabled={index === blueprint.steps.length - 1}
                              className="text-slate-500 hover:text-navy-900 disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="h-8 w-8 rounded-full bg-coral-500/20 flex items-center justify-center text-coral-600 font-bold">
                            {step.order}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-navy-900 font-medium truncate">
                              {step.name || `Step ${step.order}`}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {step.requires_document && <Badge className="bg-purple-500/20 text-purple-400 text-xs">Doc</Badge>}
                              {step.requires_signature && <Badge className="bg-blue-500/20 text-blue-400 text-xs">Sign</Badge>}
                              {step.requires_notarization && <Badge className="bg-green-500/20 text-green-400 text-xs">Notary</Badge>}
                              {step.requires_payment && <Badge className="bg-coral-500/20 text-coral-600 text-xs">Pay</Badge>}
                            </div>
                          </div>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                            className="text-red-400 hover:text-red-300 p-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Step Details (Expanded) */}
                        {expandedStep === step.id && (
                          <div className="p-4 border-t border-slate-200 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Step Name *</label>
                                <Input
                                  value={step.name}
                                  onChange={(e) => updateStep(step.id, 'name', e.target.value)}
                                  placeholder="e.g., Document Review"
                                  className="bg-white border-slate-200 text-navy-900 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Est. Duration (Hours)</label>
                                <Input
                                  type="number"
                                  value={step.estimated_duration_hours}
                                  onChange={(e) => updateStep(step.id, 'estimated_duration_hours', parseInt(e.target.value) || 24)}
                                  className="bg-white border-slate-200 text-navy-900 text-sm"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Description</label>
                              <Input
                                value={step.description}
                                onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                                placeholder="Describe what needs to happen in this step..."
                                className="bg-white border-slate-200 text-navy-900 text-sm"
                              />
                            </div>
                            
                            {/* Requirements */}
                            <div>
                              <label className="text-xs text-slate-500 mb-2 block">Requirements</label>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { key: 'requires_document', label: 'Document', icon: FileText, color: 'purple' },
                                  { key: 'requires_signature', label: 'Signature', icon: PenTool, color: 'blue' },
                                  { key: 'requires_notarization', label: 'Notarization', icon: Shield, color: 'green' },
                                  { key: 'requires_payment', label: 'Payment', icon: DollarSign, color: 'orange' }
                                ].map(req => (
                                  <button
                                    key={req.key}
                                    onClick={() => updateStep(step.id, req.key, !step[req.key])}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors text-sm ${
                                      step[req.key]
                                        ? `bg-${req.color}-500/20 border-${req.color}-500/50 text-${req.color}-400`
                                        : 'bg-transparent border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                  >
                                    <req.icon className="h-3 w-3" />
                                    {req.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Assigned Roles */}
                            <div>
                              <label className="text-xs text-slate-500 mb-2 block">Responsible Roles</label>
                              <div className="flex flex-wrap gap-1">
                                {availableRoles.map(role => (
                                  <button
                                    key={role}
                                    onClick={() => toggleStepRole(step.id, role)}
                                    className={`px-2 py-1 rounded text-xs transition-colors ${
                                      step.required_roles.includes(role)
                                        ? 'bg-coral-500/20 text-coral-600 border border-coral-500/50'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {role}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Dependencies */}
                            {index > 0 && (
                              <div>
                                <label className="text-xs text-slate-500 mb-2 block">Depends On (Steps that must complete first)</label>
                                <div className="flex flex-wrap gap-1">
                                  {blueprint.steps.slice(0, index).map(depStep => (
                                    <button
                                      key={depStep.id}
                                      onClick={() => toggleStepDependency(step.id, depStep.id)}
                                      className={`px-2 py-1 rounded text-xs transition-colors ${
                                        step.dependencies.includes(depStep.id)
                                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                          : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                                      }`}
                                    >
                                      Step {depStep.order}: {depStep.name || 'Unnamed'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Required Roles */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-navy-900 text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Required Roles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {availableRoles.map(role => (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        blueprint.required_roles.includes(role)
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                          : 'bg-cream-100 text-slate-500 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Required Documents */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-navy-900 text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  Required Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newDocument}
                    onChange={(e) => setNewDocument(e.target.value)}
                    placeholder="Document name..."
                    className="bg-cream-100 border-slate-200 text-navy-900 text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && addDocument()}
                  />
                  <Button onClick={addDocument} size="sm" variant="outline" className="border-slate-200">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {blueprint.required_documents.length > 0 && (
                  <div className="space-y-1">
                    {blueprint.required_documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-cream-100 rounded text-sm">
                        <span className="text-slate-500">{doc}</span>
                        <button 
                          onClick={() => removeDocument(doc)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Settings */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-navy-900 text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-coral-600" />
                  AI Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">Enable AI Orchestration</span>
                  <button
                    onClick={() => setBlueprint({ ...blueprint, ai_enabled: !blueprint.ai_enabled })}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      blueprint.ai_enabled ? 'bg-coral-500' : 'bg-slate-200'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      blueprint.ai_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-navy-900 text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Steps</span>
                  <span className="text-navy-900 font-medium">{blueprint.steps.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Required Roles</span>
                  <span className="text-navy-900 font-medium">{blueprint.required_roles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Documents</span>
                  <span className="text-navy-900 font-medium">{blueprint.required_documents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Est. Duration</span>
                  <span className="text-navy-900 font-medium">{blueprint.estimated_total_days} days</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="bg-white border-slate-200 text-navy-900 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Blueprint Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <h3 className="font-bold text-lg">{blueprint.name || 'Unnamed Blueprint'}</h3>
              <p className="text-slate-500 text-sm">{blueprint.description || 'No description'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Type:</span>
                <span className="ml-2 text-navy-900">{blueprint.transaction_type}</span>
              </div>
              <div>
                <span className="text-slate-500">Duration:</span>
                <span className="ml-2 text-navy-900">{blueprint.estimated_total_days} days</span>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Workflow Steps ({blueprint.steps.length})</h4>
              <div className="space-y-2">
                {blueprint.steps.map((step, idx) => (
                  <div key={step.id} className="p-3 bg-cream-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-coral-600 font-bold">{idx + 1}.</span>
                      <span className="text-navy-900">{step.name || 'Unnamed Step'}</span>
                    </div>
                    {step.description && (
                      <p className="text-slate-500 text-xs mt-1">{step.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {step.requires_document && <Badge className="bg-purple-500/20 text-purple-400 text-xs">Document</Badge>}
                      {step.requires_signature && <Badge className="bg-blue-500/20 text-blue-400 text-xs">Signature</Badge>}
                      {step.requires_notarization && <Badge className="bg-green-500/20 text-green-400 text-xs">Notarization</Badge>}
                      {step.requires_payment && <Badge className="bg-coral-500/20 text-coral-600 text-xs">Payment</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
