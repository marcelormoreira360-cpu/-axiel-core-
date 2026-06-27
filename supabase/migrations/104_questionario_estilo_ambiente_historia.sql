-- 104_questionario_estilo_ambiente_historia.sql
-- Fase 2b: questionário do paciente "Estilo de Vida, Ambiente e História" (escala 0–4),
-- 3 seções. Alimenta a Avaliação (ATM): História Familiar → Antecedentes;
-- Estilo de Vida + Ambiente → Anamnese (Mediadores), via "Importar achados".
-- Não entra na pirâmide Bio³ (é contexto de antecedentes/mediadores).
-- Idempotente: cria só para clínicas que ainda não têm este template.

do $$
declare
  c   record;
  tpl uuid;
  sec uuid;
begin
  for c in (select distinct clinic_id from public.assessment_templates where clinic_id is not null) loop
    if exists (
      select 1 from public.assessment_templates
      where clinic_id = c.clinic_id
        and name = 'Estilo de Vida, Ambiente e História'
        and deleted_at is null
    ) then
      continue;
    end if;

    insert into public.assessment_templates
      (clinic_id, name, description, scale_labels, placement, is_active)
    values (
      c.clinic_id,
      'Estilo de Vida, Ambiente e História',
      'Contexto de antecedentes e mediadores. Responda de 0 (nada) a 4 (muito).',
      '{"0":"Nada","1":"Pouco","2":"Moderado","3":"Bastante","4":"Muito"}'::jsonb,
      '{intake}'::text[],
      true
    )
    returning id into tpl;

    -- Seção 1 — ESTILO DE VIDA (→ Anamnese / Mediadores)
    insert into public.assessment_sections (template_id, title, order_index)
    values (tpl, 'ESTILO DE VIDA', 0) returning id into sec;
    insert into public.assessment_questions (template_id, section_id, text, question_type, min_score, max_score, order_index, is_required) values
      (tpl, sec, 'Sono insuficiente ou não reparador', 'scale', 0, 4, 0, false),
      (tpl, sec, 'Sedentarismo ou pouca atividade física', 'scale', 0, 4, 1, false),
      (tpl, sec, 'Alimentação ultraprocessada ou pouca variedade', 'scale', 0, 4, 2, false),
      (tpl, sec, 'Baixa hidratação (pouca água ao dia)', 'scale', 0, 4, 3, false),
      (tpl, sec, 'Excesso de telas, principalmente à noite', 'scale', 0, 4, 4, false),
      (tpl, sec, 'Pouco contato com sol e natureza', 'scale', 0, 4, 5, false),
      (tpl, sec, 'Uso de álcool, tabaco ou outras substâncias', 'scale', 0, 4, 6, false),
      (tpl, sec, 'Pouco lazer, descanso ou prática espiritual', 'scale', 0, 4, 7, false);

    -- Seção 2 — AMBIENTE (→ Anamnese / Mediadores)
    insert into public.assessment_sections (template_id, title, order_index)
    values (tpl, 'AMBIENTE', 1) returning id into sec;
    insert into public.assessment_questions (template_id, section_id, text, question_type, min_score, max_score, order_index, is_required) values
      (tpl, sec, 'Mofo ou umidade em casa ou no trabalho', 'scale', 0, 4, 0, false),
      (tpl, sec, 'Metais pesados (amálgama dentário, peixe em excesso, exposição ocupacional)', 'scale', 0, 4, 1, false),
      (tpl, sec, 'Agrotóxicos ou alimentos não orgânicos', 'scale', 0, 4, 2, false),
      (tpl, sec, 'Produtos de limpeza, perfumes ou cosméticos fortes', 'scale', 0, 4, 3, false),
      (tpl, sec, 'Plásticos no preparo ou armazenamento de comida', 'scale', 0, 4, 4, false),
      (tpl, sec, 'Água não filtrada', 'scale', 0, 4, 5, false),
      (tpl, sec, 'Exposição ocupacional a químicos, poeira ou radiação', 'scale', 0, 4, 6, false);

    -- Seção 3 — HISTÓRIA FAMILIAR (→ Antecedentes) · 0 = não há · 4 = múltiplos / 1º grau
    insert into public.assessment_sections (template_id, title, order_index)
    values (tpl, 'HISTÓRIA FAMILIAR', 2) returning id into sec;
    insert into public.assessment_questions (template_id, section_id, text, question_type, min_score, max_score, order_index, is_required) values
      (tpl, sec, 'Doenças autoimunes', 'scale', 0, 4, 0, false),
      (tpl, sec, 'Depressão, ansiedade ou transtornos psiquiátricos', 'scale', 0, 4, 1, false),
      (tpl, sec, 'Câncer', 'scale', 0, 4, 2, false),
      (tpl, sec, 'Diabetes, obesidade ou síndrome metabólica', 'scale', 0, 4, 3, false),
      (tpl, sec, 'Doença cardiovascular ou hipertensão', 'scale', 0, 4, 4, false),
      (tpl, sec, 'Doença neurodegenerativa (Alzheimer, Parkinson)', 'scale', 0, 4, 5, false),
      (tpl, sec, 'Doenças da tireoide ou hormonais', 'scale', 0, 4, 6, false);
  end loop;
end $$;

notify pgrst, 'reload schema';
