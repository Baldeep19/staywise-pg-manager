-- Which partner holds the collected rent. Profit settlement uses this to work out who owes whom.
-- NULL means the building owner collects (the default before anyone changes it).
alter table public.properties
  add column if not exists rent_collector_user_id uuid references auth.users(id) on delete set null;

comment on column public.properties.rent_collector_user_id is
  'Partner or owner who receives the rent payments for this building; NULL = the building owner.';
