import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { FileText, Calendar, Users, ArrowRight } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RequestNotarization = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    document_name: '',
    document_type: 'general',
    notarization_type: 'ron',
    scheduled_time: '',
    signers: [{ name: '', email: '' }],
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const documentTypes = [
    { value: 'general', label: 'General Document' },
    { value: 'power_of_attorney', label: 'Power of Attorney' },
    { value: 'real_estate', label: 'Real Estate Document' },
    { value: 'affidavit', label: 'Affidavit' },
    { value: 'will', label: 'Last Will & Testament' },
    { value: 'trust', label: 'Trust Document' },
    { value: 'contract', label: 'Contract' },
  ];

  const notarizationTypes = [
    { value: 'ron', label: 'Remote Online Notarization (RON)' },
    { value: 'traditional', label: 'In-Person Notarization' },
    { value: 'mobile', label: 'Mobile Notary' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/notary/requests`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast({
        title: 'Request Submitted!',
        description: 'A notary will be assigned to your request soon.',
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to submit request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSignerChange = (index, field, value) => {
    const newSigners = [...formData.signers];
    newSigners[index][field] = value;
    setFormData({ ...formData, signers: newSigners });
  };

  const addSigner = () => {
    setFormData({
      ...formData,
      signers: [...formData.signers, { name: '', email: '' }],
    });
  };

  const removeSigner = (index) => {
    const newSigners = formData.signers.filter((_, i) => i !== index);
    setFormData({ ...formData, signers: newSigners });
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />

      <div className="pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Request Notarization
            </h1>
            <p className="text-gray-400 text-lg">
              Connect with a certified notary for your document
            </p>
          </div>

          <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Document Details */}
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    Document Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="document_name" className="text-white mb-2 block">
                        Document Name *
                      </Label>
                      <Input
                        id="document_name"
                        name="document_name"
                        required
                        value={formData.document_name}
                        onChange={handleChange}
                        className="bg-[#0a0f1a] border-gray-700 text-white"
                        placeholder="e.g., Property Purchase Agreement"
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <Label htmlFor="document_type" className="text-white mb-2 block">
                        Document Type *
                      </Label>
                      <select
                        id="document_type"
                        name="document_type"
                        required
                        value={formData.document_type}
                        onChange={handleChange}
                        className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                        disabled={loading}
                      >
                        {documentTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="notarization_type" className="text-white mb-2 block">
                        Notarization Type *
                      </Label>
                      <select
                        id="notarization_type"
                        name="notarization_type"
                        required
                        value={formData.notarization_type}
                        onChange={handleChange}
                        className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                        disabled={loading}
                      >
                        {notarizationTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Scheduling */}
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Scheduling
                  </h3>
                  <div>
                    <Label htmlFor="scheduled_time" className="text-white mb-2 block">
                      Preferred Date & Time (optional)
                    </Label>
                    <Input
                      id="scheduled_time"
                      name="scheduled_time"
                      type="datetime-local"
                      value={formData.scheduled_time}
                      onChange={handleChange}
                      className="bg-[#0a0f1a] border-gray-700 text-white"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Signers */}
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Signers
                  </h3>
                  <div className="space-y-4">
                    {formData.signers.map((signer, index) => (
                      <div key={index} className="bg-[#0a0f1a] rounded-lg p-4 border border-gray-800">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white font-semibold">Signer {index + 1}</span>
                          {formData.signers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSigner(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                              disabled={loading}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            placeholder="Full Name"
                            value={signer.name}
                            onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                            className="bg-[#1a2332] border-gray-700 text-white"
                            disabled={loading}
                          />
                          <Input
                            type="email"
                            placeholder="Email Address"
                            value={signer.email}
                            onChange={(e) => handleSignerChange(index, 'email', e.target.value)}
                            className="bg-[#1a2332] border-gray-700 text-white"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      onClick={addSigner}
                      variant="outline"
                      className="w-full border-gray-700 text-gray-300 hover:text-white"
                      disabled={loading}
                    >
                      + Add Another Signer
                    </Button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes" className="text-white mb-2 block">
                    Additional Notes
                  </Label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Any special instructions or requirements..."
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default RequestNotarization;
