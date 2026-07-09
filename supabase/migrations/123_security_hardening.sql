-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 123 — Security hardening (lote segurança)
--
-- 1) Policies de ESCRITA do bucket clinic-assets por pasta clinic_id/*.
--    Elas existiam só em migrations_archive/044_clinic_assets_storage.sql e
--    NÃO estavam nas migrations ativas: um banco recriado do zero ficava sem
--    elas (qualquer authenticated poderia escrever no bucket, que é público
--    para leitura). Recriadas aqui com drop-if-exists para serem idempotentes
--    em produção, onde a 044 já rodou.
--
-- 2) Documentação da decisão sobre clinics.ical_secret (mantido em claro).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. clinic-assets: escrita restrita à pasta da própria clínica ────────────

-- Clínicas podem fazer upload na sua própria pasta (clinic_id/*)
drop policy if exists "Clinic members can upload assets" on storage.objects;
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
drop policy if exists "Clinic members can update own assets" on storage.objects;
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

drop policy if exists "Clinic members can delete own assets" on storage.objects;
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

-- Leitura restrita a membros da própria clínica.
-- IMPORTANTE: NÃO é leitura pública. A listagem pública foi removida de
-- propósito na migration 110 (advisor). Logos são servidas por getPublicUrl
-- (bucket público serve o objeto direto, sem passar por esta policy); esta
-- policy governa só a API de listagem/download autenticada.
drop policy if exists "Clinic members can read own assets" on storage.objects;
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

-- ── 2. clinics.ical_secret: decisão de manter em claro (não hashear) ─────────
-- A tela app/settings/integrations exibe a URL do feed reconstruída a partir
-- do valor salvo (getIcalSecret), então o segredo precisa continuar
-- recuperável. Hashear (padrão patient_portal_links) quebraria a exibição.
-- Mitigações adotadas no app: rate limit por token+IP na rota /api/ical/[token]
-- e remoção de notas clínicas (PHI) do corpo do feed.
comment on column public.clinics.ical_secret is
  'Segredo do feed iCal (/api/ical/[token]). Mantido EM CLARO de propósito: a tela de integrações reconstrói e exibe a URL do feed a partir deste valor, então ele precisa ser recuperável (hash quebraria a UI). Mitigações: rate limit por token+IP na rota e feed sem notas clínicas (PHI). Se um dia a UI passar a mostrar a URL só no momento da geração, migrar para hash SHA-256 (padrão patient_portal_links).';
