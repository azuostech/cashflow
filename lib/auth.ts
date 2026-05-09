import { createClient } from '@/lib/supabase/server';

export interface SessionContext {
  userId: string;
  companyId: string;
  email: string;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('company_id, email')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;

  return {
    userId: user.id,
    companyId: profile.company_id,
    email: profile.email
  };
}
