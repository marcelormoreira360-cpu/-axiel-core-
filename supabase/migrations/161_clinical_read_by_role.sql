-- 161_clinical_read_by_role.sql
-- Minimo privilegio na LEITURA de documentos clinicos. Ate aqui, qualquer usuario com
-- acesso a clinica (can_access_clinic) lia SOAP, insights/relatorios de IA e exames
-- funcionais. Agora a leitura desses DOCUMENTOS CLINICOS exige papel clinico.
--
-- Papeis que LEEM documento clinico: clinic_owner, clinic_manager, practitioner,
-- read_only_staff. Recepcao (front_desk) deixa de ler esses documentos.
--
-- IMPORTANTE: a tabela public.patients NAO e alterada (recepcao precisa dela para agendar
-- e contatar). Escrita (insert/update/delete) tambem nao muda (segue can_write_clinic_data
-- / can_manage_clinic). Platform staff continua com acesso aqui; o endurecimento de acesso
-- interno (remover o acesso amplo do suporte) e tratado a parte.
--
-- Seguro para os usuarios atuais: todas as contas ativas sao clinic_owner ou clinic_manager,
-- ambos no conjunto permitido (nenhum usuario perde acesso com esta migration).

create or replace function public.can_read_clinical_data(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_platform_staff()
    or (
      public.can_access_clinic(target_clinic_id)
      and public.current_membership_role(target_clinic_id) in
        ('clinic_owner', 'clinic_manager', 'practitioner', 'read_only_staff')
    ),
    false
  );
$$;

comment on function public.can_read_clinical_data(uuid) is
  'Leitura de documento clinico (SOAP, insights de IA, exames funcionais): exige papel '
  'clinico (owner/manager/practitioner/read_only_staff). Recepcao (front_desk) fica de fora. '
  'Nao restringe a tabela patients, so os documentos clinicos.';

-- Troca APENAS o predicado de leitura (preserva roles/cmd/with-check das policies).
alter policy "Clinic users can view active ai_insights" on public.ai_insights
  using (public.can_read_clinical_data(clinic_id) and deleted_at is null);

alter policy "Clinic users can view active session_records" on public.session_records
  using (public.can_read_clinical_data(clinic_id) and deleted_at is null);

alter policy "patient_functional_exams_select" on public.patient_functional_exams
  using (public.can_read_clinical_data(clinic_id));
