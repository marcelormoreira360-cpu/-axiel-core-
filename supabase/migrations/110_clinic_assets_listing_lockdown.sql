-- 110: bucket público clinic-assets não deve permitir LISTAR todos os arquivos
-- (advisor public_bucket_allows_listing). O download por URL pública de bucket
-- público NÃO passa por RLS, então as logos continuam servindo normalmente;
-- esta policy só controla list/select via API. Escopo: membros da clínica.
drop policy if exists "Public read clinic assets" on storage.objects;
create policy "Clinic members can read own assets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] in (
      select cu.clinic_id::text
      from public.clinic_users cu
      where cu.user_id = auth.uid() and cu.status = 'active'
    )
  );
