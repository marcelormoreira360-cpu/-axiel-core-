-- AXIEL Core — Bucket público para assets de clínica (logo, etc.)
-- Executar no Supabase SQL Editor ou via supabase db push

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-assets',
  'clinic-assets',
  true,
  2097152,  -- 2 MB
  array['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Clínicas podem fazer upload na sua própria pasta (clinic_id/*)
create policy "Clinic members can upload assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinic-assets'
  and (storage.foldername(name))[1] in (
    select cu.clinic_id::text
    from public.clinic_users cu
    where cu.user_id = auth.uid() and cu.status = 'active'
  )
);

-- Clínicas podem atualizar/deletar seus próprios assets
create policy "Clinic members can update own assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'clinic-assets'
  and (storage.foldername(name))[1] in (
    select cu.clinic_id::text
    from public.clinic_users cu
    where cu.user_id = auth.uid() and cu.status = 'active'
  )
);

create policy "Clinic members can delete own assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'clinic-assets'
  and (storage.foldername(name))[1] in (
    select cu.clinic_id::text
    from public.clinic_users cu
    where cu.user_id = auth.uid() and cu.status = 'active'
  )
);

-- Leitura pública (logos são públicas por design)
create policy "Public read clinic assets"
on storage.objects for select to public
using (bucket_id = 'clinic-assets');
