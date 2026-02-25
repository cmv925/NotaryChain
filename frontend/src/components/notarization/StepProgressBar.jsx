import React from 'react';
import { CheckCircle } from 'lucide-react';

const steps = [
  { num: 1, label: 'Document Analysis' },
  { num: 2, label: 'Identity Verification' },
  { num: 3, label: 'Submit Request' },
];

export const StepProgressBar = ({ currentStep }) => (
  <div className="mb-6 sm:mb-8" data-testid="progress-steps">
    <div className="flex items-center justify-between max-w-xl mx-auto">
      {steps.map((step, index) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all ${
              currentStep >= step.num
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}>
              {currentStep > step.num ? (
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                step.num
              )}
            </div>
            <span className={`mt-1 sm:mt-2 text-xs sm:text-sm text-center ${
              currentStep >= step.num ? 'text-blue-400' : 'text-gray-500'
            }`}>
              {step.label}
            </span>
          </div>
          {index < 2 && (
            <div className={`flex-1 h-0.5 sm:h-1 mx-2 sm:mx-4 rounded ${
              currentStep > step.num ? 'bg-blue-600' : 'bg-gray-700'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);
