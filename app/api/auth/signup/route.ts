import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk } from '@/lib/utils/http';
import { validateCNPJ } from '@/lib/utils/validators';

const schema = z.object({
  companyName: z.string().min(2),
  cnpj: z.string().min(14),
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6)
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Dados de cadastro invalidos.', 400);
    }

    const { companyName, cnpj, email, password, confirmPassword } = parsed.data;

    if (password !== confirmPassword) {
      return jsonError('As senhas nao coincidem.', 400);
    }

    if (!validateCNPJ(cnpj)) {
      return jsonError('CNPJ invalido.', 400);
    }

    const supabase = createAdminClient();

    const { data: existingCompany } = await supabase.from('companies').select('id').eq('cnpj', cnpj).maybeSingle();
    if (existingCompany) {
      return jsonError('Ja existe uma empresa com este CNPJ.', 400);
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ name: companyName, cnpj })
      .select('id, name, cnpj')
      .single();

    if (companyError || !company) {
      return jsonError(companyError?.message ?? 'Falha ao criar empresa.', 500);
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        company_id: company.id,
        role: 'admin'
      }
    });

    if (authError || !authUser.user) {
      await supabase.from('companies').delete().eq('id', company.id);
      return jsonError(authError?.message ?? 'Falha ao criar usuario no auth.', 500);
    }

    const { error: profileError } = await supabase.from('users').insert({
      id: authUser.user.id,
      company_id: company.id,
      email,
      password_hash: '',
      full_name: email.split('@')[0]
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from('companies').delete().eq('id', company.id);
      return jsonError(profileError.message, 500);
    }

    return jsonOk({
      success: true,
      company,
      user: {
        id: authUser.user.id,
        email
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Erro inesperado no cadastro.', 500);
  }
}
