-- 122: fecha as 4 sobreposições permissivas restantes (plans, subscriptions,
-- product_order_items, working_hours). Mesma técnica da 120: ALL vira per-comando
-- e o SELECT funde com OR para não perder acesso de admin/staff.

-- plans
drop policy if exists "Platform admins can manage plans" on public.plans;
drop policy if exists "Authenticated users can view active plans" on public.plans;
create policy "Users can view active plans, staff and admins all" on public.plans
  for select to authenticated using ((is_active = true) or is_platform_staff() or is_platform_admin());
create policy "Platform admins can insert plans" on public.plans
  for insert to authenticated with check (is_platform_admin());
create policy "Platform admins can update plans" on public.plans
  for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "Platform admins can delete plans" on public.plans
  for delete to authenticated using (is_platform_admin());

-- subscriptions
drop policy if exists "Platform admins can manage subscriptions" on public.subscriptions;
drop policy if exists "Clinic users can view subscriptions" on public.subscriptions;
create policy "Clinic users or admins can view subscriptions" on public.subscriptions
  for select to authenticated using ((clinic_id is null) or can_access_clinic(clinic_id) or is_platform_admin());
create policy "Platform admins can insert subscriptions" on public.subscriptions
  for insert to authenticated with check (is_platform_admin());
create policy "Platform admins can update subscriptions" on public.subscriptions
  for update to authenticated using (is_platform_admin()) with check (is_platform_admin());
create policy "Platform admins can delete subscriptions" on public.subscriptions
  for delete to authenticated using (is_platform_admin());

-- product_order_items
drop policy if exists "product_order_items_write" on public.product_order_items;
drop policy if exists "product_order_items_select" on public.product_order_items;
create policy "product_order_items_select" on public.product_order_items
  for select to authenticated using (can_access_clinic(clinic_id) or can_write_clinic_data(clinic_id));
create policy "product_order_items_insert" on public.product_order_items
  for insert to authenticated with check (can_write_clinic_data(clinic_id));
create policy "product_order_items_update" on public.product_order_items
  for update to authenticated using (can_write_clinic_data(clinic_id)) with check (can_write_clinic_data(clinic_id));
create policy "product_order_items_delete" on public.product_order_items
  for delete to authenticated using (can_write_clinic_data(clinic_id));

-- working_hours: o SELECT de view é idêntico ao USING do ALL de manage; basta dropar.
drop policy if exists "Clinic users can view working hours" on public.working_hours;
