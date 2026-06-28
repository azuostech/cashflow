'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { OnboardingStep1Company } from '@/components/onboarding/step1-company';
import { OnboardingStep2BankAccounts } from '@/components/onboarding/step2-bank-accounts';
import { OnboardingStep3CostCenters } from '@/components/onboarding/step3-cost-centers';
import { OnboardingStep4Categories } from '@/components/onboarding/step4-categories';

const STEPS = [
  { label: 'Empresa' },
  { label: 'Contas e saldos' },
  { label: 'Centros de custo' },
  { label: 'Categorias' }
];

interface OnboardingStatus {
  step: number | 'complete';
  hasCompany: boolean;
  companyId?: string;
}

function toStep(value: string | null): number {
  const parsed = Number(value ?? '1');
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 4 ? parsed : 1;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<number>(toStep(searchParams.get('step')));
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      const response = await fetch('/api/onboarding/status');

      if (response.status === 401) {
        router.push('/login?redirect=/onboarding');
        return;
      }

      if (!response.ok) {
        setLoadingStatus(false);
        return;
      }

      const status: OnboardingStatus = await response.json();

      if (status.step === 'complete') {
        router.replace('/dashboard');
        return;
      }

      if (status.companyId) {
        setCompanyId(status.companyId);
      }

      const requestedParam = searchParams.get('step');
      const requestedStep = toStep(requestedParam);
      const statusStep = typeof status.step === 'number' ? status.step : 1;
      const nextStep = status.hasCompany
        ? requestedParam
          ? Math.min(Math.max(2, requestedStep), statusStep)
          : statusStep
        : 1;

      setStep(nextStep);
      setLoadingStatus(false);
    }

    void loadStatus();
  }, [router, searchParams]);

  function goNext() {
    const next = step + 1;

    if (next > 4) {
      router.push('/dashboard');
      return;
    }

    setStep(next);
    router.replace(`/onboarding?step=${next}`, { scroll: false });
  }

  function goBack() {
    const previous = step - 1;

    if (previous < 1) return;

    setStep(previous);
    router.replace(`/onboarding?step=${previous}`, { scroll: false });
  }

  if (loadingStatus) {
    return <div className="h-96 animate-pulse rounded-lg bg-white" />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Configurar empresa</h1>
        <p className="mt-1 text-sm text-gray-500">Configure sua empresa em quatro passos rapidos.</p>
      </div>

      <OnboardingProgress currentStep={step} steps={STEPS} />

      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        {step === 1 ? (
          <OnboardingStep1Company
            onComplete={(id) => {
              setCompanyId(id);
              goNext();
            }}
          />
        ) : null}
        {step === 2 ? <OnboardingStep2BankAccounts companyId={companyId} onComplete={goNext} onBack={goBack} /> : null}
        {step === 3 ? <OnboardingStep3CostCenters companyId={companyId} onComplete={goNext} onBack={goBack} /> : null}
        {step === 4 ? <OnboardingStep4Categories companyId={companyId} onComplete={goNext} onBack={goBack} /> : null}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white" />}>
      <OnboardingContent />
    </Suspense>
  );
}
