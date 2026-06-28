alter table public.users
  add column if not exists locale varchar(10) not null default 'pt-BR',
  add column if not exists timezone varchar(50) not null default 'America/Sao_Paulo',
  add column if not exists notification_prefs jsonb,
  add column if not exists updated_at timestamptz not null default now();
