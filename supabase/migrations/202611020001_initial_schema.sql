create extension if not exists pgcrypto;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table public.flats (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  flat_number text not null,
  created_at timestamptz not null default now(),
  unique(property_id, flat_number)
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  flat_id uuid references public.flats(id) on delete set null,
  full_name text not null,
  phone text not null,
  permanent_address text,
  emergency_contact text,
  monthly_rent numeric(12,2) not null default 0 check (monthly_rent >= 0),
  move_in date,
  move_out date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'UPI',
  reference text,
  created_at timestamptz not null default now()
);

create table public.electricity_bills (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  flat_id uuid references public.flats(id) on delete set null,
  resident_id uuid not null references public.residents(id) on delete cascade,
  billing_month date not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'due' check (status in ('due','paid','waived')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index residents_property_flat_idx on public.residents(property_id, flat_id) where active;
create index rent_payments_resident_date_idx on public.rent_payments(resident_id, paid_on desc);
create index electricity_bills_property_due_idx on public.electricity_bills(property_id, due_date);

alter table public.properties enable row level security;
alter table public.flats enable row level security;
alter table public.residents enable row level security;
alter table public.rent_payments enable row level security;
alter table public.electricity_bills enable row level security;

create policy "owners manage own properties" on public.properties
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owners manage own flats" on public.flats for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "owners manage own residents" on public.residents for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "owners manage own rent payments" on public.rent_payments for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "owners manage own electricity bills" on public.electricity_bills for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));
