-- Notice period: when a resident said they are leaving, and the day they will move out.
-- Kept apart from move_out, which is the day the resident was actually marked as moved out (active = false).
alter table public.residents
  add column if not exists notice_given_on date,
  add column if not exists notice_vacate_on date;

alter table public.residents
  drop constraint if exists residents_notice_dates_check;
alter table public.residents
  add constraint residents_notice_dates_check check (
    (notice_given_on is null and notice_vacate_on is null)
    or (notice_given_on is not null and notice_vacate_on is not null and notice_vacate_on >= notice_given_on)
  );

comment on column public.residents.notice_given_on is 'Day the resident gave notice that they are leaving.';
comment on column public.residents.notice_vacate_on is
  'Planned move-out day. Defaults to one month after notice in the app; can be later when notice is given early.';
