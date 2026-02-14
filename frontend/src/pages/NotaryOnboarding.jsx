import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotaryOnboarding = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    license_number: '',
    license_state: '',
    commission_expiry: '',
    ron_certified: false,
    specializations: [],
    hourly_rate: '',
    bio: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API}/notary/profile`,
        {
          ...formData,
          hourly_rate: parseFloat(formData.hourly_rate) || 0,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast({
        title: 'Success!',
        description: 'Notary profile created. Awaiting approval.',
      });

      setTimeout(() => {
        navigate('/notary/dashboard');
      }, 1500);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const toggleSpecialization = (spec) => {
    const specs = formData.specializations.includes(spec)
      ? formData.specializations.filter((s) => s !== spec)
      : [...formData.specializations, spec];
    setFormData({ ...formData, specializations: specs });
  };

  const specializations = [
    'Real Estate',
    'Legal Documents',
    'Power of Attorney',
    'Healthcare',
    'Financial',
    'Immigration',
  ];

  return (
    <div className="min-h-screen bg-[#0f1825] py-12">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield className="w-10 h-10 text-blue-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Become a NotaryChain Notary</h1>
          <p className="text-gray-400 text-lg">
            Join our network of certified notaries and start earning
          </p>
        </div>

        <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="license_state" className="text-white mb-2 block">
                    License State *
                  </Label>
                  <Input
                    id="license_state"
                    name="license_state"
                    required
                    value={formData.license_state}
                    onChange={handleChange}
                    className="bg-[#0a0f1a] border-gray-700 text-white"
                    placeholder="CA"
                    disabled={loading}
                  />
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
                    disabled={loading}
                  />
                </div>

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
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label className="text-white mb-3 block">Specializations</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {specializations.map((spec) => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleSpecialization(spec)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                        formData.specializations.includes(spec)
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#0a0f1a] border-gray-700 text-gray-300 hover:border-blue-500'
                      }`}
                      disabled={loading}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="ron_certified"
                    checked={formData.ron_certified}
                    onChange={handleChange}
                    className="rounded"
                    disabled={loading}
                  />
                  <span className="text-white">I am RON (Remote Online Notarization) certified</span>
                </label>
              </div>

              <div>
                <Label htmlFor="bio" className="text-white mb-2 block">
                  Bio
                </Label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Tell us about your experience..."
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotaryOnboarding;