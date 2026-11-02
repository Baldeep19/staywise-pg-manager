alter table public.residents
  add column if not exists sharing_type text check (sharing_type in ('single','double'));
alter table public.residents
  add column if not exists deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0);
