interface OnboardingProgressProps {
  currentStep: number;
  steps: { label: string }[];
}

export function OnboardingProgress({ currentStep, steps }: OnboardingProgressProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div key={step.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  isComplete || isCurrent ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400',
                  isCurrent ? 'ring-4 ring-emerald-100' : ''
                ].join(' ')}
              >
                {isComplete ? 'OK' : stepNumber}
              </div>
              <span className={['mt-1 whitespace-nowrap text-xs', isCurrent ? 'font-medium text-emerald-700' : 'text-gray-400'].join(' ')}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <div className={['mx-2 mb-4 h-0.5 flex-1', stepNumber < currentStep ? 'bg-emerald-600' : 'bg-gray-200'].join(' ')} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
