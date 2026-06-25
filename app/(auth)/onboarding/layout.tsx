export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white">
          CF
        </div>
        <span className="text-sm font-semibold text-gray-900">CashFlowAI</span>
      </header>
      <div className="flex flex-1 items-start justify-center p-6 pt-12">
        <div className="w-full max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
