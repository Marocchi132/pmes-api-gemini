create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  plano text default 'gratuito',
  created_at timestamptz default now()
);
create table if not exists public.simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  nota integer not null default 0,
  acertos integer not null default 0,
  total integer not null default 0,
  detalhes jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create table if not exists public.redacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tema text not null,
  texto text not null,
  nota integer not null default 0,
  correcao jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
alter table public.simulados enable row level security;
alter table public.redacoes enable row level security;
do $$ begin
  create policy "Usuário lê o próprio perfil" on public.profiles for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Usuário atualiza o próprio perfil" on public.profiles for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Usuário lê seus simulados" on public.simulados for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Usuário cria seus simulados" on public.simulados for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Usuário lê suas redações" on public.redacoes for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Usuário cria suas redações" on public.redacoes for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
