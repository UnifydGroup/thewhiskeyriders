import React, { ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

interface FormWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
  children: ReactNode;
  isLoading?: boolean;
  canNextStep?: boolean;
}

export function FormWizard({
  steps,
  currentStep,
  onNext,
  onPrev,
  onComplete,
  children,
  isLoading = false,
  canNextStep = true,
}: FormWizardProps) {
  const isLastStep = currentStep === steps.length - 1;
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {steps[currentStep].label}
          </h2>
          <span className="text-sm text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        {steps[currentStep].description && (
          <p className="text-gray-400 text-sm">
            {steps[currentStep].description}
          </p>
        )}
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-2 flex-wrap">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              index === currentStep
                ? 'bg-blue-900/30 text-blue-400 border border-blue-500'
                : index < currentStep
                ? 'bg-green-900/30 text-green-400'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            <span className="font-medium">{index + 1}</span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <Card className="p-6">
        {children}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-3">
        <Button
          variant="secondary"
          onClick={onPrev}
          disabled={currentStep === 0 || isLoading}
        >
          <ChevronLeft size={18} className="mr-2" />
          Previous
        </Button>

        <div className="flex gap-3">
          {isLastStep ? (
            <Button
              variant="primary"
              onClick={onComplete}
              disabled={isLoading || !canNextStep}
            >
              {isLoading ? 'Completing...' : 'Complete'}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={onNext}
              disabled={isLoading || !canNextStep}
            >
              Next
              <ChevronRight size={18} className="ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
