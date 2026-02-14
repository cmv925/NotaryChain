import React from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import ProcessStepsSection from '../components/ProcessStepsSection';
import TechnologyStackSection from '../components/TechnologyStackSection';
import AIDocumentSection from '../components/AIDocumentSection';
import WorkflowSection from '../components/WorkflowSection';
import QuickSealSection from '../components/QuickSealSection';
import BiometricSection from '../components/BiometricSection';
import UseCasesSection from '../components/UseCasesSection';
import OrchestratorSection from '../components/OrchestratorSection';
import Footer from '../components/Footer';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <ProcessStepsSection />
      <TechnologyStackSection />
      <AIDocumentSection />
      <WorkflowSection />
      <QuickSealSection />
      <BiometricSection />
      <UseCasesSection />
      <OrchestratorSection />
      <Footer />
    </div>
  );
};

export default HomePage;