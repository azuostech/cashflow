import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="mb-4 text-7xl font-bold text-gray-200">404</div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Pagina nao encontrada</h1>
        <p className="mb-8 text-sm text-gray-500">A pagina que voce esta procurando nao existe ou foi movida.</p>
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Ir para o Dashboard
          </Link>
          <Link
            href="/transactions"
            className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Ver Lancamentos
          </Link>
        </div>
      </div>
    </div>
  );
}
