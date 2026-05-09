import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return jsonError('Credenciais invalidas.', 400);
  }

  const supabase = createClient();
  const { email, password } = parsed.data;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    return jsonError('Email ou senha invalidos.', 401);
  }

  await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', data.user.id);

  return jsonOk({ success: true, user: { id: data.user.id, email: data.user.email } });
}
