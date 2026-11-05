alter table public.property_members add column if not exists display_name text;
alter table public.property_members add column if not exists email text;

create or replace function public.lookup_partner_account(p_user_id uuid)
returns table(display_name text, email text)
language sql stable security definer set search_path = public, auth as $$
  select coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)), u.email
  from auth.users u
  where u.id = p_user_id
    and exists (select 1 from public.properties p where p.owner_id = auth.uid());
$$;
revoke all on function public.lookup_partner_account(uuid) from public;
grant execute on function public.lookup_partner_account(uuid) to authenticated;
