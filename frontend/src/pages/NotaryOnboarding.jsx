import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, ArrowRight, ArrowLeft, Upload, FileText, CheckCircle, 
  AlertCircle, Clock, User, MapPin, Award, Briefcase
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const SPECIALIZATIONS = [
  'Real Estate', 'Legal Documents', 'Power of Attorney', 
  'Healthcare', 'Financial', 'Immigration', 'Estate Planning',
  'Business Documents', 'Loan Signing'
];

const CREDENTIAL_TYPES = [
  { id: 'commission_certificate', label: 'Commission Certificate', required: true, description: 'Your official notary commission certificate' },
  { id: 'government_id', label: 'Government ID', required: true, description: 'Valid government-issued photo ID' },
  { id: 'e_signature', label: 'E-Signature Sample', required: false, description: 'Your electronic signature for digital documents' },
  { id: 'background_check', label: 'Background Check', required: false, description: 'Recent background check results (if available)' },
  { id: 'ron_certificate', label: 'RON Certification', required: false, description: 'Remote Online Notarization certification' },
];

const NotaryOnboarding = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [existingProfile, setExistingProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [uploadedCredentials, setUploadedCredentials] = useState([]);
  
  const [formData, setFormData] = useState({
    // Personal Info
    full_legal_name: '',
    phone_number: '',
    address: '',
    city: '',
    zip_code: '',
    // License Info
    license_number: '',
    license_state: '',
    commission_expiry: '',
    years_experience: 0,
    // Preferences
    ron_certified: false,
    specializations: [],
    hourly_rate: '',
    bio: '',
  });

  useEffect(() => {
    checkExistingApplication();
  }, []);

  const checkExistingApplication = async () => {
    try {
      const response = await axios.get(`${API}/notary/profile/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.has_profile) {
        setExistingProfile(response.data);
        setUploadedCredentials(response.data.credentials_uploaded || []);
        
        // Pre-fill form if profile exists
        if (response.data.profile) {
          const p = response.data.profile;
          setFormData(prev => ({
            ...prev,
            full_legal_name: p.full_legal_name || '',
            phone_number: p.phone_number || '',
            address: p.address || '',
            city: p.city || '',
            zip_code: p.zip_code || '',
            license_number: p.license_number || '',
            license_state: p.license_state || '',
            commission_expiry: p.commission_expiry || '',
            years_experience: p.years_experience || 0,
            ron_certified: p.ron_certified || false,
            specializations: p.specializations || [],
            hourly_rate: p.hourly_rate?.toString() || '',
            bio: p.bio || '',
          }));
        }
      }
    } catch (error) {
      // No existing profile - that's fine
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API}/notary/profile`,
        {
          ...formData,
          hourly_rate: parseFloat(formData.hourly_rate) || 0,
          years_experience: parseInt(formData.years_experience) || 0,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast({
        title: 'Profile Created',
        description: 'Now upload your credentials to complete the application.',
      });

      setStep(3); // Move to document upload step
      await checkExistingApplication(); // Refresh status
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail === 'Notary profile already exists') {
        setStep(3); // Skip to document upload
      } else {
        toast({
          title: 'Error',
          description: detail || 'Failed to create profile',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (credentialType, file) => {
    if (!file) return;
    
    setLoading(true);
    const formPayload = new FormData();
    formPayload.append('credential_type', credentialType);
    formPayload.append('file', file);

    try {
      await axios.post(`${API}/notary/profile/credentials`, formPayload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      toast({
        title: 'Document Uploaded',
        description: `${credentialType.replace('_', ' ')} uploaded successfully.`,
      });

      setUploadedCredentials(prev => [...prev, credentialType]);
      await checkExistingApplication(); // Refresh status
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error.response?.data?.detail || 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleSpecialization = (spec) => {
    const specs = formData.specializations.includes(spec)
      ? formData.specializations.filter((s) => s !== spec)
      : [...formData.specializations, spec];
    setFormData(prev => ({ ...prev, specializations: specs }));
  };

  const renderStatusBanner = () => {
    if (!existingProfile) return null;
    
    const status = existingProfile.status;
    const statusConfig = {
      pending: { color: 'yellow', icon: Clock, text: 'Application Pending' },
      under_review: { color: 'blue', icon: FileText, text: 'Under Review' },
      approved: { color: 'green', icon: CheckCircle, text: 'Approved' },
      rejected: { color: 'red', icon: AlertCircle, text: 'Application Rejected' },
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <div className={`mb-6 p-4 rounded-lg border bg-${config.color}-500/10 border-${config.color}-500/30`}>
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 text-${config.color}-400`} />
          <div>
            <h3 className={`font-semibold text-${config.color}-400`}>{config.text}</h3>
            <p className="text-gray-400 text-sm">{existingProfile.message}</p>
            {existingProfile.rejection_reason && (
              <p className="text-red-400 text-sm mt-1">Reason: {existingProfile.rejection_reason}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // If approved, redirect to dashboard
  if (existingProfile?.status === 'approved') {
    return (
      <div className="min-h-screen bg-[#0f1825] py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-white mb-4">You're Approved!</h1>
          <p className="text-gray-400 text-lg mb-8">
            Congratulations! Your notary application has been approved.
          </p>
          <Button
            onClick={() => navigate('/notary/dashboard')}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg"
          >
            Go to Notary Dashboard
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1825] py-12">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield className="w-10 h-10 text-blue-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Become a NotaryChain Notary</h1>
          <p className="text-gray-400 text-lg">
            Join our network of certified notaries and start earning
          </p>
        </div>

        {renderStatusBanner()}

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8 gap-4">
          {[
            { num: 1, label: 'Personal Info', icon: User },
            { num: 2, label: 'License Details', icon: Award },
            { num: 3, label: 'Upload Documents', icon: Upload },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <button
                onClick={() => existingProfile?.has_profile && setStep(s.num)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  step === s.num 
                    ? 'bg-blue-600 text-white' 
                    : step > s.num || (existingProfile?.has_profile && s.num <= 2)
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-800 text-gray-400'
                }`}
                disabled={!existingProfile?.has_profile && step < s.num}
              >
                <s.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.num}</span>
              </button>
              {idx < 2 && <div className="w-8 h-0.5 bg-gray-700" />}
            </React.Fragment>
          ))}
        </div>

        <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
          <CardContent className="p-8">
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-6">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                  <User className="w-6 h-6 text-blue-500" />
                  Personal Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="full_legal_name" className="text-white mb-2 block">
                      Full Legal Name *
                    </Label>
                    <Input
                      id="full_legal_name"
                      name="full_legal_name"
                      required
                      value={formData.full_legal_name}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone_number" className="text-white mb-2 block">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone_number"
                      name="phone_number"
                      type="tel"
                      required
                      value={formData.phone_number}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="text-white mb-2 block">
                    Street Address *
                  </Label>
                  <Input
                    id="address"
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleChange}
                    className="bg-[#0a0f1a] border-gray-700 text-white"
                    placeholder="123 Main St, Suite 100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="city" className="text-white mb-2 block">
                      City *
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                      placeholder="Los Angeles"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip_code" className="text-white mb-2 block">
                      ZIP Code *
                    </Label>
                    <Input
                      id="zip_code"
                      name="zip_code"
                      required
                      value={formData.zip_code}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                      placeholder="90001"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                    Next: License Details
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 2: License Information */}
            {step === 2 && (
              <form onSubmit={handleSubmitProfile} className="space-y-6">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                  <Award className="w-6 h-6 text-blue-500" />
                  License & Credentials
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="license_number" className="text-white mb-2 block">
                      License Number *
                    </Label>
                    <Input
                      id="license_number"
                      name="license_number"
                      required
                      value={formData.license_number}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="license_state" className="text-white mb-2 block">
                      License State *
                    </Label>
                    <select
                      id="license_state"
                      name="license_state"
                      required
                      value={formData.license_state}
                      onChange={handleChange}
                      className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white"
                    >
                      <option value="">Select State</option>
                      {US_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="commission_expiry" className="text-white mb-2 block">
                      Commission Expiry *
                    </Label>
                    <Input
                      id="commission_expiry"
                      name="commission_expiry"
                      type="date"
                      required
                      value={formData.commission_expiry}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="years_experience" className="text-white mb-2 block">
                      Years of Experience
                    </Label>
                    <Input
                      id="years_experience"
                      name="years_experience"
                      type="number"
                      min="0"
                      value={formData.years_experience}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="hourly_rate" className="text-white mb-2 block">
                      Hourly Rate ($)
                    </Label>
                    <Input
                      id="hourly_rate"
                      name="hourly_rate"
                      type="number"
                      step="0.01"
                      value={formData.hourly_rate}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                      placeholder="50.00"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 p-3 bg-[#0a0f1a] rounded-lg border border-gray-700 w-full">
                      <input
                        type="checkbox"
                        name="ron_certified"
                        checked={formData.ron_certified}
                        onChange={handleChange}
                        className="rounded"
                      />
                      <span className="text-white">RON Certified</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-white mb-3 block">Specializations</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {SPECIALIZATIONS.map((spec) => (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => toggleSpecialization(spec)}
                        className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                          formData.specializations.includes(spec)
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-[#0a0f1a] border-gray-700 text-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="bio" className="text-white mb-2 block">
                    Professional Bio
                  </Label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Tell us about your experience and why you'd be a great addition to our network..."
                  />
                </div>

                <div className="flex justify-between">
                  <Button 
                    type="button" 
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="border-gray-700 text-gray-300"
                  >
                    <ArrowLeft className="mr-2 w-5 h-5" />
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    {loading ? 'Saving...' : existingProfile?.has_profile ? 'Next: Upload Documents' : 'Save & Continue'}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 3: Document Upload */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
                  <Upload className="w-6 h-6 text-blue-500" />
                  Upload Credentials
                </h2>
                
                <p className="text-gray-400">
                  Please upload the required documents to complete your application. 
                  Documents marked with * are required.
                </p>

                <div className="space-y-4">
                  {CREDENTIAL_TYPES.map((cred) => {
                    const isUploaded = uploadedCredentials.includes(cred.id);
                    
                    return (
                      <div 
                        key={cred.id}
                        className={`p-4 rounded-lg border ${
                          isUploaded 
                            ? 'bg-green-500/10 border-green-500/30' 
                            : 'bg-[#0a0f1a] border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isUploaded ? (
                              <CheckCircle className="w-6 h-6 text-green-500" />
                            ) : (
                              <FileText className="w-6 h-6 text-gray-400" />
                            )}
                            <div>
                              <h4 className="text-white font-medium">
                                {cred.label} {cred.required && <span className="text-red-400">*</span>}
                              </h4>
                              <p className="text-gray-400 text-sm">{cred.description}</p>
                            </div>
                          </div>
                          <div>
                            {isUploaded ? (
                              <span className="text-green-400 text-sm">Uploaded</span>
                            ) : (
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => handleFileUpload(cred.id, e.target.files[0])}
                                  disabled={loading}
                                />
                                <span className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload
                                </span>
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="text-blue-400 font-medium mb-2">What happens next?</h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Your application will be reviewed by our team (1-3 business days)</li>
                    <li>• We may contact you if additional information is needed</li>
                    <li>• You'll receive an email notification once approved</li>
                    <li>• After approval, you can start accepting notarization requests</li>
                  </ul>
                </div>

                <div className="flex justify-between">
                  <Button 
                    type="button" 
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="border-gray-700 text-gray-300"
                  >
                    <ArrowLeft className="mr-2 w-5 h-5" />
                    Back to Profile
                  </Button>
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    className="bg-green-600 hover:bg-green-700 text-white px-8"
                  >
                    Done - Go to Dashboard
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotaryOnboarding;
