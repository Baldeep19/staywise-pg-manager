-- Separate encrypted store for optional resident Aadhaar values.
-- Access only through authenticated Edge Function using server-side service role.
create table public.resident_aadhaar_vault (
  resident_id uuid primary key references public.residents(id) on delete cascade,
  ciphertext text not null,
  nonce text not null,
  key_version text not null default 'v1',
  updated_at timestamptz not null default now()
);
create table public.aadhaar_access_audit (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  action text not null check (action in ('store','read','delete')),
  created_at timestamptz not null default now()
);
alter table public.resident_aadhaar_vault enable row level security;
alter table public.aadhaar_access_audit enable row level security;
-- No authenticated-client policies: browser clients cannot read these tables.
