import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, 'ok' | 'error' | 'skip'> = {
    db: 'error',
    storage: 'skip',
    auth: 'skip'
  };
  const details: Record<string, string> = {};
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (error) {
    details.db = error instanceof Error ? error.message.slice(0, 120) : 'Database check failed';
  }

  if (isSupabaseConfigured()) {
    checks.auth = 'ok';
  } else {
    details.auth = 'Supabase public config missing';
  }

  const supabaseAdmin = createSupabaseAdminClient();
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.storage.listBuckets();
      if (error) throw error;

      const bucketNames = (data ?? []).map((bucket) => bucket.name);
      const missingBuckets = ['cashflowai-statements', 'cashflowai-attachments'].filter((bucket) => !bucketNames.includes(bucket));
      checks.storage = missingBuckets.length === 0 ? 'ok' : 'error';

      if (missingBuckets.length > 0) {
        details.storage = `Missing buckets: ${missingBuckets.join(', ')}`;
      }
    } catch (error) {
      checks.storage = 'error';
      details.storage = error instanceof Error ? error.message.slice(0, 120) : 'Storage check failed';
    }
  } else {
    details.storage = 'Supabase service key not configured';
  }

  const ok = Object.values(checks).every((value) => value === 'ok' || value === 'skip');

  return NextResponse.json(
    {
      ok,
      checks,
      details,
      elapsed: `${Date.now() - start}ms`,
      ts: new Date().toISOString()
    },
    { status: ok ? 200 : 503 }
  );
}
