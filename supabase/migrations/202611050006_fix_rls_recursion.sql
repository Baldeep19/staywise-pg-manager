-- 1) Fix "infinite recursion detected in policy for relation properties".
--    properties SELECT policy read property_members, whose policies read properties again.
--    SECURITY DEFINER helpers run as the function owner (bypassing RLS), which breaks the cycle.
-- 2) Treat partners (property_members) exactly like owners: same access everywhere.
-- Safe to re-run: every statement is create-or-replace / drop-if-exists.

create or replace function public.is_property_member(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.property_members m where m.property_id = p_property_id and m.user_id = auth.uid());
$$;

-- "Owner-equivalent": the owner OR any partner. Same logic as can_access_property, kept as one name for policies.
create or replace function public.is_property_owner(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.properties p where p.id = p_property_id and p.owner_id = auth.uid())
      or exists (select 1 from public.property_members m where m.property_id = p_property_id and m.user_id = auth.uid());
$$;

-- properties: owners and partners can view, update and delete. Insert stays owner_id = caller.
drop policy if exists "owners and members view properties" on public.properties;
create policy "owners and members view properties" on public.properties for select
  using (owner_id = auth.uid() or public.is_property_member(id));
drop policy if exists "owners update own properties" on public.properties;
create policy "owners update own properties" on public.properties for update
  using (owner_id = auth.uid() or public.is_property_member(id))
  with check (owner_id = auth.uid() or public.is_property_member(id));
drop policy if exists "owners delete own properties" on public.properties;
create policy "owners delete own properties" on public.properties for delete
  using (owner_id = auth.uid() or public.is_property_member(id));

-- property_members: owners and partners can manage partners (no direct subquery on properties).
drop policy if exists "owners manage property members" on public.property_members;
create policy "owners manage property members" on public.property_members for all
  using (public.is_property_owner(property_id))
  with check (public.is_property_owner(property_id));
drop policy if exists "members view own membership" on public.property_members;
create policy "members view own membership" on public.property_members for select
  using (user_id = auth.uid() or public.is_property_owner(property_id));

-- expenses: partners can delete too.
drop policy if exists "owners delete expenses" on public.property_expenses;
create policy "owners delete expenses" on public.property_expenses for delete
  using (public.is_property_owner(property_id));

-- Partners must be able to look up other partners by email (previously required owning a property).
create or replace function public.lookup_partner_by_email(p_email text)
returns table(user_id uuid, display_name text, email text)
language sql stable security definer set search_path = public, auth as $$
  select u.id,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
    and (exists (select 1 from public.properties p where p.owner_id = auth.uid())
         or exists (select 1 from public.property_members m where m.user_id = auth.uid()));
$$;

-- Names of everyone who owns/co-owns a property (owner + partners). Feeds the "Paid by" dropdown.
create or replace function public.property_people(p_property_id uuid)
returns table(user_id uuid, display_name text, email text)
language sql stable security definer set search_path = public, auth as $$
  select u.id,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email
  from auth.users u
  where public.is_property_owner(p_property_id)
    and (u.id = (select p.owner_id from public.properties p where p.id = p_property_id)
         or u.id in (select m.user_id from public.property_members m where m.property_id = p_property_id));
$$;
revoke all on function public.property_people(uuid) from public;
grant execute on function public.property_people(uuid) to authenticated;
