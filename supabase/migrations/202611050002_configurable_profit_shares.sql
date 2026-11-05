alter table public.property_members
  add column if not exists ownership_percent numeric(5,2) not null default 0
  check (ownership_percent >= 0 and ownership_percent <= 100);

alter table public.property_expenses
  add column if not exists paid_by_user_id uuid references auth.users(id);

create or replace function public.property_ownership_total(p_property_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(ownership_percent), 0)
  from public.property_members where property_id = p_property_id;
$$;

comment on column public.property_members.ownership_percent is 'Configurable ownership share used to allocate net profit; total active shares should equal 100.';
comment on column public.property_expenses.paid_by_user_id is 'Partner or owner who paid this expense, used for settlement reporting.';
