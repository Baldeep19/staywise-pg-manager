-- Derive property ownership from the authenticated Supabase session.
alter table public.properties alter column owner_id set default auth.uid();
