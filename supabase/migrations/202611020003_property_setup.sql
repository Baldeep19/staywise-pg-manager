alter table public.properties add column if not exists setup_complete boolean not null default false;
alter table public.flats add column if not exists floor_name text not null default 'Ground';
alter table public.flats add column if not exists bed_count integer not null default 1 check (bed_count > 0);
alter table public.flats add column if not exists active boolean not null default true;
