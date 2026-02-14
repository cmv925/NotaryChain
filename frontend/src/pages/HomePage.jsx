import React from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import AIDocumentSection from '../components/AIDocumentSection';
import WorkflowSection from '../components/WorkflowSection';
import BiometricSection from '../components/BiometricSection';
import OrchestratorSection from '../components/OrchestratorSection';
import Footer from '../components/Footer';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <AIDocumentSection />
      <WorkflowSection />
      <BiometricSection />
      <OrchestratorSection />
      <Footer />
    </div>
  );
};

export default HomePage;