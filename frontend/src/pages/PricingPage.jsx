import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Check, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';

const pricingPlans = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'Perfect for individuals and small teams getting started',
    features: [
      '10 notarizations per month',
      'AI Document Generation',
      'Basic biometric verification',
      'Blockchain certificate',
      'Email support',
      '30-day document retention',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/month',
    description: 'For growing businesses with regular notarization needs',
    features: [
      '50 notarizations per month',
      'Full AI Document Suite™',
      'Advanced biometric verification',
      'Blockchain certificate',
      'Priority support',
      '1-year document retention',
      'API access',
      'Custom branding',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For organizations requiring advanced workflows and compliance',
    features: [
      'Unlimited notarizations',
      'AI Transaction Orchestrator™',
      'Forensic-grade verification',
      'Private blockchain option',
      'Dedicated support team',
      'Unlimited retention',
      'Full API access',
      'Custom integrations',
      'SLA guarantee',
      'On-premise deployment',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const PricingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      
      <div className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Choose Your Plan
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Select the perfect plan for your notarization needs. All plans include blockchain security and AI-powered features.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`relative bg-gradient-to-br from-[#1a2332] to-[#0f1825] border ${
                  plan.popular
                    ? 'border-blue-500 shadow-2xl shadow-blue-500/20 scale-105'
                    : 'border-gray-800'
                } transition-all duration-300 hover:border-blue-500/50`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-5xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-gray-400 ml-2">{plan.period}</span>}
                  </div>
                  <p className="text-gray-400 mb-6">{plan.description}</p>
                  
                  <Button
                    onClick={() => navigate('/signup')}
                    className={`w-full mb-8 py-6 text-lg transition-all ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>

                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-24 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Have Questions?</h2>
            <p className="text-gray-400 mb-6">
              Our team is here to help you find the right solution for your needs.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
              Contact Sales Team
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PricingPage;