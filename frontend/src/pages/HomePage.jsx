import React from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import StatsSection from '../components/StatsSection';
import ProcessStepsSection from '../components/ProcessStepsSection';
import TechnologyStackSection from '../components/TechnologyStackSection';
import AIDocumentSection from '../components/AIDocumentSection';
import WorkflowSection from '../components/WorkflowSection';
import QuickSealSection from '../components/QuickSealSection';
import BiometricSection from '../components/BiometricSection';
import UseCasesSection from '../components/UseCasesSection';
import LegalComplianceSection from '../components/LegalComplianceSection';
import OrchestratorSection from '../components/OrchestratorSection';
import Footer from '../components/Footer';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <ProcessStepsSection />
      <TechnologyStackSection />
      <AIDocumentSection />
      <WorkflowSection />
      <QuickSealSection />
      <BiometricSection />
      <UseCasesSection />
      <LegalComplianceSection />
      <OrchestratorSection />
      <Footer />
    </div>
  );
};

export default HomePage;