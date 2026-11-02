create table if not exists public.electricity_meter_readings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  flat_id uuid not null references public.flats(id) on delete cascade,
  billing_month date not null,
  reading_date date not null default current_date,
  previous_room1_reading numeric(12,2) not null check (previous_room1_reading >= 0),
  current_room1_reading numeric(12,2) not null check (current_room1_reading >= previous_room1_reading),
  previous_room2_reading numeric(12,2) not null check (previous_room2_reading >= 0),
  current_room2_reading numeric(12,2) not null check (current_room2_reading >= previous_room2_reading),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint electricity_meter_readings_flat_cycle_key unique (property_id, flat_id, billing_month)
);

create index if not exists electricity_meter_readings_property_cycle_idx
  on public.electricity_meter_readings(property_id, billing_month desc);

create or replace function public.set_electricity_meter_reading_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists electricity_meter_readings_updated_at on public.electricity_meter_readings;
create trigger electricity_meter_readings_updated_at
  before update on public.electricity_meter_readings
  for each row execute function public.set_electricity_meter_reading_updated_at();

alter table public.electricity_meter_readings enable row level security;

drop policy if exists "owners manage own electricity meter readings" on public.electricity_meter_readings;
create policy "owners manage own electricity meter readings"
  on public.electricity_meter_readings for all
  using (exists (
    select 1 from public.properties p
    where p.id = electricity_meter_readings.property_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.properties p
    where p.id = electricity_meter_readings.property_id and p.owner_id = auth.uid()
  ));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'electricity_meter_readings'
     ) then
    alter publication supabase_realtime add table public.electricity_meter_readings;
  end if;
end $$;
