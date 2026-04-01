import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ProgressProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercent?: boolean;
  showSteps?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'yellow' | 'red';
  animated?: boolean;
  striped?: boolean;
}

export function Progress({
  value,
  max = 100,
  label,
  showPercent = true,
  size = 'md',
  color = 'blue',
  animated = true,
  striped = false,
}: ProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const isComplete = percentage === 100;

  const heightClass = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }[size];

  const colorClass = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
  }[color];

  return (
    <div className="w-full space-y-2">
      {(label || showPercent) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-gray-300 font-medium">{label}</span>}
          {showPercent && (
            <span className={cn('font-semibold', isComplete ? 'text-green-400' : 'text-gray-400')}>
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div className={cn('w-full bg-gray-700 rounded-full overflow-hidden', heightClass)}>
        <div
          className={cn(
            'h-full transition-all duration-300 rounded-full',
            colorClass,
            animated && 'animate-pulse',
            striped && 'bg-gradient-to-r from-transparent via-white to-transparent opacity-20'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isComplete && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <Check size={16} />
          Complete
        </div>
      )}
    </div>
  );
}

interface MultiStepProgressProps {
  steps: {
    id: string;
    label: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
  }[];
  currentStep?: number;
}

export function MultiStepProgress({
  steps,
  currentStep = 0,
}: MultiStepProgressProps) {
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const totalSteps = steps.length;
  const percentage = (completedSteps / totalSteps) * 100;

  return (
    <div className="w-full space-y-4">
      {/* Overall Progress */}
      <Progress
        value={completedSteps}
        max={totalSteps}
        label={`Progress: ${completedSteps}/${totalSteps} steps`}
        showPercent={true}
      />

      {/* Step Indicators */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isPending = step.status === 'pending';
          const isCompleted = step.status === 'completed';
          const isError = step.status === 'error';
          const isInProgress = step.status === 'in-progress';

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isActive && 'bg-gray-800',
                isError && 'bg-red-900/20 border border-red-500/30',
                isCompleted && 'bg-green-900/10 border border-green-500/20'
              )}
            >
              {/* Step Number */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  isError
                    ? 'bg-red-900 text-red-200'
                    : isCompleted
                    ? 'bg-green-900 text-green-200'
                    : isInProgress
                    ? 'bg-blue-900 text-blue-200'
                    : 'bg-gray-700 text-gray-300'
                )}
              >
                {isCompleted ? <Check size={16} /> : index + 1}
              </div>

              {/* Label */}
              <span className={cn('font-medium', isError ? 'text-red-300' : 'text-gray-200')}>
                {step.label}
              </span>

              {/* Status Indicator */}
              <div className="ml-auto">
                {isInProgress && (
                  <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
                )}
                {isError && <span className="text-red-400 text-xs font-bold">ERROR</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Status */}
      <div className="pt-2 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          {completedSteps === totalSteps
            ? '✓ All steps completed'
            : `${completedSteps} of ${totalSteps} steps completed`}
        </p>
      </div>
    </div>
  );
}
