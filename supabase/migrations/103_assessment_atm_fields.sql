-- 103_assessment_atm_fields.sql
-- Fase 2 (ATM): adiciona 3 campos humanos de alto valor à Avaliação das clínicas
-- existentes (Objetivo, Linha do tempo, Integração). Aditivo e idempotente.
-- Clínicas novas já recebem estes campos pelo seed (DEFAULT_ASSESSMENT_FIELDS).
-- O agrupamento ATM é feito por código (groupForFieldKey), sem coluna nova.

insert into clinic_assessment_fields
  (clinic_id, field_key, label, field_type, placeholder, options, order_index, include_in_report, is_active)
select c.clinic_id, v.field_key, v.label, v.field_type, v.placeholder, null, v.order_index, true, true
from (select distinct clinic_id from clinic_assessment_fields) c
cross join (values
  ('objetivo',       'Objetivo (3 prioridades)',   'textarea', 'Se eu pudesse resolver 3 coisas na sua saúde, quais seriam?', 5),
  ('linha_do_tempo', 'Linha do tempo (gatilhos)',  'textarea', 'Quando começou? O que aconteceu antes? (cirurgias, COVID, perdas, mudanças hormonais, estresse intenso)', 6),
  ('integracao_atm', 'Integração clínica (ATM)',   'textarea', 'Principais queixas, gatilhos, fatores que mantêm o quadro, sistemas mais desregulados, hipóteses a confirmar.', 7)
) as v(field_key, label, field_type, placeholder, order_index)
on conflict (clinic_id, field_key) do nothing;
