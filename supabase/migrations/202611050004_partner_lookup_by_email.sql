create or replace function public.lookup_partner_by_email(p_email text)
returns table(user_id uuid, display_name text, email text)
language sql stable security definer set search_path = public, auth as $$
  select u.id,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
    and exists (select 1 from public.properties p where p.owner_id = auth.uid());
$$;
revoke all on function public.lookup_partner_by_email(text) from public;
grant execute on function public.lookup_partner_by_email(text) to authenticated;
