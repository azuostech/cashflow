'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface OnboardingState {
  companyId: string | null;
  step: OnboardingStep;
}

export function useOnboarding(initialStep: OnboardingStep = 1) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goToStep = useCallback(
    (nextStep: OnboardingStep) => {
      setStep(nextStep);
      setError('');
      router.replace(`/onboarding?step=${nextStep}`, { scroll: false });
    },
    [router]
  );

  return { step, companyId, setCompanyId, loading, setLoading, error, setError, goToStep };
}
