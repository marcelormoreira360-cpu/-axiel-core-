-- Moeda em que a CLÍNICA paga a ASSINATURA do Core à Oxiel (cobrança SaaS).
-- É um conceito SEPARADO de clinic_settings.default_currency (que é a moeda em
-- que a clínica cobra os PACIENTES dela no módulo financeiro).
--
-- No Stripe cada Price ID é de uma moeda só, então a escolha de moeda do
-- checkout de assinatura é resolvida por clínica a partir desta coluna:
--   BRL -> STRIPE_PRICE_<PLANO>       (ou STRIPE_PRICE_<PLANO>_BRL)
--   USD -> STRIPE_PRICE_<PLANO>_USD
--
-- Default 'BRL' de propósito: preserva EXATAMENTE o comportamento atual de
-- todas as clínicas existentes (inclusive a IFWC). Nenhuma clínica passa a ser
-- cobrada em USD sem que este campo seja explicitamente virado para 'USD'.
alter table public.clinics
  add column if not exists billing_currency text not null default 'BRL'
    check (billing_currency in ('BRL', 'USD', 'EUR'));

comment on column public.clinics.billing_currency is
  'Moeda da assinatura SaaS da clinica (clinica -> Oxiel). BRL|USD|EUR. Nao confundir com clinic_settings.default_currency (moeda que a clinica cobra pacientes).';
