alter table public.rent_payments
  add column if not exists rent_month date,
  add column if not exists updated_at timestamptz not null default now();

update public.rent_payments
set rent_month = date_trunc('month', paid_on::timestamp)::date
where rent_month is null;

alter table public.rent_payments
  alter column rent_month set not null;

-- Remove exact duplicate submissions, keeping the most recently created copy.
with exact_duplicates as (
  select id,
         row_number() over (
           partition by property_id, resident_id, rent_month, paid_on, amount, method, reference
           order by created_at desc, id desc
         ) as row_number
  from public.rent_payments
)
delete from public.rent_payments payment
using exact_duplicates duplicate
where payment.id = duplicate.id
  and duplicate.row_number > 1;

-- Keep one monthly row per resident. Distinct partial payments are combined,
-- and the retained payment date is the latest date recorded in that month.
with monthly_rows as (
  select id,
         sum(amount) over (partition by property_id, resident_id, rent_month) as monthly_amount,
         max(paid_on) over (partition by property_id, resident_id, rent_month) as latest_paid_on,
         first_value(method) over (
           partition by property_id, resident_id, rent_month
           order by created_at desc, id desc
         ) as latest_method,
         first_value(reference) over (
           partition by property_id, resident_id, rent_month
           order by created_at desc, id desc
         ) as latest_reference,
         row_number() over (
           partition by property_id, resident_id, rent_month
           order by created_at desc, id desc
         ) as row_number,
         count(*) over (partition by property_id, resident_id, rent_month) as row_count
  from public.rent_payments
)
update public.rent_payments payment
set amount = monthly.monthly_amount,
    paid_on = monthly.latest_paid_on,
    method = monthly.latest_method,
    reference = monthly.latest_reference,
    updated_at = now()
from monthly_rows monthly
where payment.id = monthly.id
  and monthly.row_number = 1
  and monthly.row_count > 1;

with monthly_duplicates as (
  select id,
         row_number() over (
           partition by property_id, resident_id, rent_month
           order by created_at desc, id desc
         ) as row_number
  from public.rent_payments
)
delete from public.rent_payments payment
using monthly_duplicates duplicate
where payment.id = duplicate.id
  and duplicate.row_number > 1;

create unique index if not exists rent_payments_property_resident_month_uidx
  on public.rent_payments(property_id, resident_id, rent_month);

create or replace function public.record_rent_payment(
  p_property_id uuid,
  p_resident_id uuid,
  p_amount numeric,
  p_paid_on date,
  p_method text,
  p_reference text
)
returns public.rent_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_payment public.rent_payments;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  insert into public.rent_payments (
    property_id, resident_id, rent_month, amount, paid_on, method, reference
  ) values (
    p_property_id,
    p_resident_id,
    date_trunc('month', p_paid_on::timestamp)::date,
    p_amount,
    p_paid_on,
    coalesce(nullif(p_method, ''), 'UPI'),
    nullif(p_reference, '')
  )
  on conflict (property_id, resident_id, rent_month)
  do update set
    amount = public.rent_payments.amount + excluded.amount,
    paid_on = greatest(public.rent_payments.paid_on, excluded.paid_on),
    method = excluded.method,
    reference = excluded.reference,
    updated_at = now()
  returning * into saved_payment;

  return saved_payment;
end;
$$;

revoke all on function public.record_rent_payment(uuid, uuid, numeric, date, text, text) from public, anon;
grant execute on function public.record_rent_payment(uuid, uuid, numeric, date, text, text) to authenticated;
