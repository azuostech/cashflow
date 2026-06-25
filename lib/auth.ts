import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export function getHomeRoute(role: string): string {
  switch (role) {
    case 'financial':
      return '/financial-center';
    case 'accountant':
      return '/reports/dre';
    case 'viewer':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
