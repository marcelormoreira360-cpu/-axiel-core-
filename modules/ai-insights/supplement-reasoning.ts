// Protocolo dos 10 Filtros de raciocínio clínico da suplementação (Neuro ID).
// Valida a suplementação gerada pela IA (Documento 2) com o mesmo rigor dos
// gates clínicos Salvo (segurança) e Aval (fonte/evidência/linguagem).
//
// VERSIONADO: a versão identifica a config vigente do raciocínio no prompt e
// será carimbada em cada suplementação regenerada pela fila de regeneração em
// massa (Fase 2, ainda não implementada). Ao mudar as regras abaixo, incremente
// a versão para que a fila consiga distinguir protocolos pré e pós-mudança.
export const SUPPLEMENT_REASONING_VERSION = "2026-09-suplementacao-10-filtros-v3-antitemplate";

// Bloco de instruções injetado no topo do DOCUMENTO 2 (protocolo_suplementacao)
// do prompt de guarda-corpos. É o "cérebro clínico" que rege TODA a suplementação.
// É uma constante (não varia por chamada); construída uma vez no carregamento do módulo.
export const supplementReasoningFilters = `
PROTOCOLO DOS 10 FILTROS (config: ${SUPPLEMENT_REASONING_VERSION}) — regra que rege TODA a
suplementação abaixo; aplique ANTES de sugerir qualquer ativo. Estes filtros PREVALECEM sobre TODA
instrução do Documento 2 mais adiante, inclusive as de "cobertura de eixos" e os exemplos de ativos:
cobrir os eixos que os dados sustentam significa fazê-lo de forma PRIORIZADA e FASEADA (começando pelo
eixo prioritário, com núcleo enxuto), NUNCA empilhando todos os ativos de saída.
REGRA-MÃE: nenhum achado gera suplemento diretamente. Antes de propor um ativo, verifique nesta
ordem: (1) a VALIDADE DA FONTE do achado, (2) relevância clínica, (3) segurança e medicações em uso,
(4) alternativa não farmacológica; só então proponha o suplemento, sempre modular e ajustável. Primeiro
a leitura integrada e a segurança; os produtos vêm por último.
1. VALIDADE DA FONTE: biorressonância/bioemocional, teste de reatividade capilar e correlação autonômica
   (neurometria/tilt) são HIPÓTESES, não diagnóstico. Sozinhos NÃO sustentam dose nem indicam/contraindicam
   um ativo; só ganham peso correlacionados a exame convencional e clínica. Nunca trate um "T3"/sinal de
   tireoide de aparelho como alteração de tireoide.
2. FASEAMENTO é forma de PRIORIZAR e comunicar, não ordem fisiológica obrigatória. Não afirme que o corpo
   precisa ser tratado numa sequência fixa.
3. NÃO EMPILHAR de saída: comece com POUCOS ativos, os do eixo prioritário, para que dê para avaliar
   tolerância e resposta. Cobrir os eixos que os dados sustentam significa priorizar e ESCALONAR ao longo
   do plano (os demais eixos entram como próximas etapas), não despejar todos os ativos de uma vez.
4. MODULARIDADE: mantenha os ativos ajustáveis separáveis; CONSOLIDE o mesmo ativo repetido em fórmulas
   diferentes (ex.: magnésio somado em duas fórmulas) e confira o total para não passar do teto seguro.
5. LINGUAGEM PROPORCIONAL: nunca afirmação mecanicista categórica ("isto causa aquilo"). Use "pode estar
   associado / sugere / merece avaliação". Não troque uma certeza indevida por outra (não afirme que um
   ativo "é ineficaz" nem que "com certeza resolve").
6. CAUTELA PELO PERFIL DE SEGURANÇA, não por mecanismo inventado. Em quadro ansioso / simpático dominante,
   é PROIBIDO colocar adaptógenos ativadores (rhodiola, ashwagandha e afins) ou precursores catecolaminérgicos
   (tirosina) nas FÓRMULAS ou nos ITENS iniciais. Não basta "incluir com ressalva": eles NÃO entram no plano
   de saída. Se fizerem sentido no futuro, cite-os APENAS em observacoes_gerais como "passo a avaliar com o
   profissional mais adiante", nunca como fórmula/item agora. Motivos (cautela, não mecanismo): rhodiola pode
   causar insônia/agitação; tirosina pode ser desnecessária ou inadequada; ashwagandha exige antes descartar
   incerteza tireoidiana (exame convencional), alteração hepática e interação com sedativo/anti-hipertensivo.
   NÃO afirme que "aumentam o simpático"; justifique pela cautela e pelo efeito adverso conhecido.
7. PRECURSORES SEROTONINÉRGICOS (triptofano, 5-HTP) são item de GATE: só sugira se as medicações em uso
   estiverem confirmadas SEM serotoninérgicos (ISRS, IRSN, IMAO, triptanos, tramadol, lítio) e sem sinal
   de instabilidade ou ideação. Caso contrário, deixe em "observacao" como "a confirmar com o profissional
   antes de iniciar", nunca como item pronto. O 5-HTP tem barra ainda mais alta.
8. PROBIÓTICOS: peça gênero + espécie + CEPA e UFC garantido até o vencimento; coerente com o padrão
   clínico, não com a disbiose de aparelho.
9. EXCLUSÃO ALIMENTAR só com base sólida: reatividade de teste NÃO é alergia. Não recomende retirar
   amplamente alimentos (nem no excipiente das fórmulas) apenas por reatividade; achado inespecífico
   (fadiga, temperatura periférica baixa) não justifica painel laboratorial extenso de saída.
10. COERÊNCIA DE STATUS: se um item depende de dado de segurança que falta (medicação, gestação, exame),
    ele entra como "em preparação, a confirmar com o profissional", NUNCA apresentado como decidido/pronto.
`;
