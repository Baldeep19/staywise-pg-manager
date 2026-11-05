-- Partner access and property expense tracking.
create table if not exists public.property_members (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner' check (role in ('partner','manager','viewer')),
  can_manage_residents boolean not null default true,
  can_manage_payments boolean not null default true,
  can_manage_electricity boolean not null default true,
  can_manage_expenses boolean not null default true,
  can_view_reports boolean not null default true,
  invited_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(property_id, user_id)
);

create table if not exists public.property_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null default 'Other',
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  paid_to text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.property_members enable row level security;
alter table public.property_expenses enable row level security;

create or replace function public.can_access_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.properties p where p.id = p_property_id and p.owner_id = auth.uid())
      or exists (select 1 from public.property_members m where m.property_id = p_property_id and m.user_id = auth.uid());
$$;

create policy "owners manage property members" on public.property_members for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy "members view own membership" on public.property_members for select
  using (user_id = auth.uid() or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "members view expenses" on public.property_expenses for select
  using (public.can_access_property(property_id));
create policy "members add expenses" on public.property_expenses for insert
  with check (public.can_access_property(property_id));
create policy "members update expenses" on public.property_expenses for update
  using (public.can_access_property(property_id)) with check (public.can_access_property(property_id));
create policy "owners delete expenses" on public.property_expenses for delete
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create index if not exists property_expenses_property_date_idx on public.property_expenses(property_id, expense_date desc);
