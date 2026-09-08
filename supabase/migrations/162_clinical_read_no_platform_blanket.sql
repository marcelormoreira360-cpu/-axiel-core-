-- 162_clinical_read_no_platform_blanket.sql
-- Endurecimento de acesso interno (#6, parte 1): a leitura de documento clinico deixa de
-- conceder acesso AMPLO ao "platform staff" (admin/platform_admin/platform_support) so por
-- ser staff da plataforma. Antes, can_read_clinical_data comecava com "is_platform_staff() or",
-- o que dava a esses papeis leitura de PHI de TODAS as clinicas por padrao.
--
-- Agora um usuario de plataforma so le documento clinico se for MEMBRO ativo da clinica com
-- papel clinico (owner/manager/practitioner/read_only_staff) — como qualquer outro. Nao ha
-- usuario de plataforma hoje, e o app usa service_role (que ignora RLS) para operacoes
-- legitimas, entao nenhuma funcionalidade quebra. Acesso de suporte, quando existir, deve
-- passar por um mecanismo explicito (break-glass + log), tratado a parte.
--
-- Observacao: can_access_clinic ainda embute is_platform_staff() e nao e alterado aqui (segue
-- valendo para dados administrativos/nao-clinicos); a restricao e so para DOCUMENTO CLINICO.

create or replace function public.can_read_clinical_data(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.clinic_users cu
      where cu.user_id = auth.uid()
        and cu.clinic_id = target_clinic_id
        and cu.status = 'active'
        and cu.role::text in ('clinic_owner', 'clinic_manager', 'practitioner', 'read_only_staff')
    )
    or (
      -- Modelo antigo (papel global em users, sem linha em clinic_users).
      public.current_user_clinic_id() = target_clinic_id
      and public.current_membership_role(target_clinic_id)::text in
        ('clinic_owner', 'clinic_manager', 'practitioner', 'read_only_staff')
    ),
    false
  );
$$;
