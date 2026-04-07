import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { toast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { User, Scale } from 'lucide-react';

const SignUpPage = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const result = await signup(formData.fullName, formData.email, formData.password, formData.role);

    if (result.success) {
      toast({
        title: 'Account Created!',
        description: 'Welcome to NotaryChain. Redirecting to dashboard...',
      });
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } else {
      toast({
        title: 'Signup Failed',
        description: result.error || 'Unable to create account',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      
      <div className="pt-32 pb-24 flex items-center justify-center">
        <Card className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">{t('auth.create_account')}</h1>
              <p className="text-gray-400">Start your journey with NotaryChain</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Role Selector */}
              <div>
                <Label className="text-white mb-3 block">I am signing up as</Label>
                <div className="grid grid-cols-2 gap-3" data-testid="role-selector">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'user' })}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      formData.role === 'user'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 bg-[#0a0f1a] text-gray-400 hover:border-gray-600'
                    }`}
                    data-testid="role-user-btn"
                  >
                    <User className={`w-5 h-5 flex-shrink-0 ${formData.role === 'user' ? 'text-blue-400' : 'text-gray-500'}`} />
                    <div>
                      <p className="font-medium text-sm">Regular User</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Request notarizations</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'notary' })}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      formData.role === 'notary'
                        ? 'border-violet-500 bg-violet-500/10 text-white'
                        : 'border-gray-700 bg-[#0a0f1a] text-gray-400 hover:border-gray-600'
                    }`}
                    data-testid="role-notary-btn"
                  >
                    <Scale className={`w-5 h-5 flex-shrink-0 ${formData.role === 'notary' ? 'text-violet-400' : 'text-gray-500'}`} />
                    <div>
                      <p className="font-medium text-sm">Notary</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Provide notary services</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="fullName" className="text-white mb-2 block">
                  {t('auth.full_name')}
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="bg-[#0a0f1a] border-gray-700 text-white focus:border-blue-500"
                  placeholder="John Doe"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-white mb-2 block">
                  {t('auth.email')}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="bg-[#0a0f1a] border-gray-700 text-white focus:border-blue-500"
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-white mb-2 block">
                  {t('auth.password')}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="bg-[#0a0f1a] border-gray-700 text-white focus:border-blue-500"
                  placeholder="••••••••"
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-white mb-2 block">
                  {t('auth.confirm_password')}
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="bg-[#0a0f1a] border-gray-700 text-white focus:border-blue-500"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              <div className="flex items-start gap-2">
                <input type="checkbox" required className="mt-1" />
                <span className="text-gray-400 text-sm">
                  I agree to the{' '}
                  <a href="#" className="text-blue-500 hover:text-blue-400">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-blue-500 hover:text-blue-400">
                    Privacy Policy
                  </a>
                </span>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
              >
                {loading ? `${t('common.loading')}` : t('auth.create_account')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                {t('auth.has_account')}{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-blue-500 hover:text-blue-400 font-semibold"
                >
                  {t('auth.sign_in')}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default SignUpPage;
