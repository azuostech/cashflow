import 'server-only';

import {
  withSupabase as createWithSupabaseHandler
} from '@supabase/server';
import type { SupabaseContext, WithSupabaseConfig } from '@supabase/server';
import { resolveSupabaseServerEnv } from './server-env';

export function withSupabase<Database = unknown>(
  config: WithSupabaseConfig,
  handler: (req: Request, ctx: SupabaseContext<Database>) => Promise<Response>
) {
  return createWithSupabaseHandler<Database>(
    {
      ...config,
      env: {
        ...resolveSupabaseServerEnv(),
        ...config.env
      }
    },
    handler
  );
}
