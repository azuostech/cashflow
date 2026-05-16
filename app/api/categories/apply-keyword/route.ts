import { z } from 'zod';
import { getSessionContext } from '@/lib/auth';
import { applyCategoryToSimilar } from '@/lib/categorization';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  categoryId: z.string().uuid(),
  keyword: z.string().min(2)
});

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError('Payload invalido.', 400);
  }

  const result = await applyCategoryToSimilar(parsed.data.categoryId, parsed.data.keyword, session.companyId);
  return jsonOk(result);
}
