alter table public.user_company_roles
  add column if not exists invited_by uuid references public.users(id),
  add column if not exists invite_email varchar(255),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists user_company_roles_invited_by_idx
  on public.user_company_roles(invited_by);
