alter table public.electricity_meter_readings
  add column if not exists main_bill_amount numeric(12,2) not null default 0 check (main_bill_amount >= 0),
  add column if not exists common_meter_total numeric(12,2) not null default 0 check (common_meter_total >= 0);

alter table public.residents
  add column if not exists meter_side text check (meter_side in ('left', 'right'));

comment on column public.electricity_meter_readings.main_bill_amount is
  'Main flat bill amount allocated between the two room meters by units consumed.';
comment on column public.electricity_meter_readings.common_meter_total is
  'Building-wide common meter charge, divided by active flat count then flat residents.';
