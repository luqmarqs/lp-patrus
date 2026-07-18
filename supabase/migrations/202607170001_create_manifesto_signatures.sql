create table if not exists public.manifesto_patrus (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 3),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,11}$'),
  email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  birth_date date not null check (birth_date <= current_date),
  state text not null default 'MG' check (state in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')),
  city text not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.manifesto_patrus enable row level security;

-- Também atende instalações em que a tabela já existia antes desta migration.
-- Colunas existentes não são alteradas por CREATE TABLE IF NOT EXISTS.
alter table public.manifesto_patrus
  add column if not exists name text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists birth_date date,
  add column if not exists state text;

alter table public.manifesto_patrus
  add column if not exists city text,
  add column if not exists consent_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

update public.manifesto_patrus set state = 'MG' where state is null;

alter table public.manifesto_patrus
  alter column state set default 'MG',
  alter column state set not null;

alter table public.manifesto_patrus
  drop constraint if exists manifesto_patrus_state_check;

alter table public.manifesto_patrus
  add constraint manifesto_patrus_state_check check (state in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'));

drop policy if exists "Permite assinaturas Patrus públicas" on public.manifesto_patrus;

create policy "Permite assinaturas Patrus públicas"
on public.manifesto_patrus
for insert
to anon
with check (
  char_length(trim(name)) >= 3
  and whatsapp ~ '^[0-9]{10,11}$'
  and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and birth_date <= current_date
  and state in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')
  and char_length(trim(city)) > 0
);
