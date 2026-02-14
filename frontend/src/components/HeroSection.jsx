import React from 'react';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';

const HeroSection = () => {
  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1825] via-[#1a2332] to-[#0f1825] pt-20">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-blue-500/10 rounded-full blur-3xl top-20 left-10"></div>
        <div className="absolute w-96 h-96 bg-purple-500/10 rounded-full blur-3xl bottom-20 right-10"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-6 text-center z-10">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
          The Intelligent Notary Platform with Unbreakable Trust
        </h1>
        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
          NotaryChain™ fuses cutting-edge AI document generation, advanced biometric
          verification, and the immutable security of the blockchain into one seamless
          platform.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-md transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 group">
            Get Started Free
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            onClick={scrollToFeatures}
            variant="outline"
            className="border-2 border-gray-600 hover:border-blue-500 text-white px-8 py-6 text-lg rounded-md transition-all bg-transparent hover:bg-blue-500/10"
          >
            Explore Features
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;