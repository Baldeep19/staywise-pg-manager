-- Allow allocated partners to load and work with the property they were assigned.
drop policy if exists "owners manage own properties" on public.properties;
create policy "owners and members view properties" on public.properties for select
  using (owner_id = auth.uid() or exists (select 1 from public.property_members m where m.property_id = id and m.user_id = auth.uid()));
create policy "owners manage own properties" on public.properties for insert
  with check (owner_id = auth.uid());
create policy "owners update own properties" on public.properties for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete own properties" on public.properties for delete
  using (owner_id = auth.uid());

drop policy if exists "owners manage own flats" on public.flats;
create policy "members manage accessible flats" on public.flats for all
  using (public.can_access_property(property_id)) with check (public.can_access_property(property_id));
drop policy if exists "owners manage own residents" on public.residents;
create policy "members manage accessible residents" on public.residents for all
  using (public.can_access_property(property_id)) with check (public.can_access_property(property_id));
drop policy if exists "owners manage own rent payments" on public.rent_payments;
create policy "members manage accessible rent payments" on public.rent_payments for all
  using (public.can_access_property(property_id)) with check (public.can_access_property(property_id));
drop policy if exists "owners manage own electricity bills" on public.electricity_bills;
create policy "members manage accessible electricity bills" on public.electricity_bills for all
  using (public.can_access_property(property_id)) with check (public.can_access_property(property_id));

drop policy if exists "owners manage electricity bill payments" on public.electricity_bill_payments;
create policy "members manage electricity bill payments" on public.electricity_bill_payments for all
  using (public.can_access_property(property_id)) with check (public.can_access_property(property_id));
drop policy if exists "owners manage electricity meter readings" on public.electricity_meter_readings;
create policy "members manage electricity meter readings" on public.electricity_meter_readings for all
  using (public.can_access_property(property_id)) with check (public.can_access_property(property_id));
