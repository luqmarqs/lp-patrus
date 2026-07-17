create table if not exists public.manifesto_signatures (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 3),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,11}$'),
  email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  birth_date date not null check (birth_date <= current_date),
  state text not null default 'MG' check (state = 'MG'),
  city text not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.manifesto_signatures enable row level security;

-- Também atende instalações em que a tabela já existia antes desta migration.
alter table public.manifesto_signatures
  add column if not exists state text;

update public.manifesto_signatures
set state = 'MG'
where state is null;

alter table public.manifesto_signatures
  alter column state set default 'MG',
  alter column state set not null;

alter table public.manifesto_signatures
  drop constraint if exists manifesto_signatures_state_check;

alter table public.manifesto_signatures
  add constraint manifesto_signatures_state_check check (state = 'MG');

drop policy if exists "Permite assinaturas públicas" on public.manifesto_signatures;

create policy "Permite assinaturas públicas"
on public.manifesto_signatures
for insert
to anon
with check (
  state = 'MG'
  and char_length(trim(city)) > 0
);
