create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  client_token text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.app_users is 'Anonymous and future-upgradeable product users identified by a client token.';
comment on column public.app_users.id is 'Stable primary key for the application user record.';
comment on column public.app_users.client_token is 'Locally generated anonymous client token used to find or create the user.';
comment on column public.app_users.created_at is 'UTC timestamp when the application user record was created.';
comment on column public.app_users.updated_at is 'UTC timestamp when the application user record was last updated.';

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  document jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.projects is 'Saved editor projects owned by a single application user.';
comment on column public.projects.id is 'Stable primary key for the saved project.';
comment on column public.projects.user_id is 'Owning application user for this project.';
comment on column public.projects.name is 'User-visible project name.';
comment on column public.projects.document is 'Current editor document payload stored without changing the editor document structure.';
comment on column public.projects.created_at is 'UTC timestamp when the project was created.';
comment on column public.projects.updated_at is 'UTC timestamp when the project was last updated.';

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_user_id_updated_at_idx on public.projects (user_id, updated_at desc);
