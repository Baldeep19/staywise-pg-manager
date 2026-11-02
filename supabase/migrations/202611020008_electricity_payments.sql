alter table public.electricity_bills
  drop constraint if exists electricity_bills_status_check;
alter table public.electricity_bills
  add constraint electricity_bills_status_check
  check (status in ('due','partial','paid','waived'));

create table public.electricity_bill_payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  bill_id uuid not null references public.electricity_bills(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'UPI',
  reference text,
  created_at timestamptz not null default now()
);
create index electricity_bill_payments_bill_idx on public.electricity_bill_payments(bill_id, paid_on desc);
alter table public.electricity_bill_payments enable row level security;
create policy "owners manage own electricity payments" on public.electricity_bill_payments for all
using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));
