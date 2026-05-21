import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Privacidade — AXIEL Core",
  description:
    "Saiba como o AXIEL Core coleta, usa, armazena e protege os seus dados e os dados dos seus pacientes, em conformidade com a LGPD (Lei n. 13.709/2018).",
};

// ---------------------------------------------------------------------------
// Shared layout atoms
// ---------------------------------------------------------------------------

function Navbar() {
  return (
    <header className="border-b border-[#0F1A2E]/10 bg-[#FAFAF8]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-[800px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-[13px] font-semibold tracking-widest text-[#0F1A2E] uppercase"
        >
          AXIEL CORE
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-[13px] text-[#0F1A2E]/55 hover:text-[#0F6E56] transition-colors"
          >
            Voltar
          </Link>
          <Link
            href="/auth/login"
            className="text-[13px] text-[#0F1A2E]/55 hover:text-[#0F6E56] transition-colors"
          >
            Entrar
          </Link>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#0F1A2E]/10 bg-[#FAFAF8]">
      <div className="max-w-[800px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[12px] text-[#0F1A2E]/40">
          &copy; 2025 AXIEL Core. Todos os direitos reservados.
        </p>
        <div className="flex items-center gap-5">
          <Link href="/privacidade" className="text-[12px] text-[#0F6E56]">
            Privacidade
          </Link>
          <Link
            href="/termos"
            className="text-[12px] text-[#0F1A2E]/50 hover:text-[#0F6E56] transition-colors"
          >
            Termos de Uso
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F1A2E] font-sans">
      <Navbar />

      <main className="max-w-[800px] mx-auto px-6 py-14">
        {/* Title block */}
        <div className="mb-12">
          <p className="text-[12px] font-medium tracking-widest text-[#0F6E56] uppercase mb-3">
            Documento legal
          </p>
          <h1 className="text-[28px] font-semibold text-[#0F1A2E] leading-tight mb-4">
            Politica de Privacidade
          </h1>
          <p className="text-[14px] text-[#0F1A2E]/55 leading-relaxed">
            Vigencia: Maio de 2025 &nbsp;&middot;&nbsp; Ultima atualizacao: Maio de 2025
          </p>
        </div>

        {/* Intro */}
        <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-12">
          A AXIEL Core respeita a privacidade de todos os seus usuarios e dos pacientes de suas
          clinicas. Esta Politica de Privacidade descreve como coletamos, usamos, armazenamos,
          compartilhamos e protegemos informacoes pessoais no ambito da plataforma AXIEL Core, em
          conformidade com a Lei Geral de Protecao de Dados Pessoais (LGPD — Lei Federal n.
          13.709/2018) e demais normas brasileiras aplicaveis.
        </p>

        <div className="space-y-12">

          {/* 1 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              1. Identificacao do Controlador de Dados
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              O controlador dos dados pessoais tratados nesta politica e a empresa responsavel
              pela plataforma AXIEL Core (razao social a ser definida no momento da constituicao
              formal da pessoa juridica), com sede no Estado de Sao Paulo, Brasil. Para quaisquer
              questoes relacionadas a privacidade e protecao de dados, entre em contato pelo
              endereco eletronico oficial:{" "}
              <a
                href="mailto:privacidade@axielcore.com"
                className="text-[#0F6E56] hover:underline"
              >
                privacidade@axielcore.com
              </a>
              .
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              2. Dados Pessoais Coletados
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-5">
              Coletamos diferentes categorias de dados de acordo com o tipo de titular e com a
              finalidade do tratamento:
            </p>
            <div className="space-y-5">
              <div>
                <p className="text-[14px] font-semibold text-[#0F1A2E] mb-2">
                  2.1 Dados do profissional de saude (usuario da plataforma)
                </p>
                <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
                  Nome completo, endereco de e-mail, senha (armazenada em formato criptografado),
                  numero de registro profissional (CRM, CRP, CRN, CREFITO, CRFA ou equivalente),
                  especialidade, dados de faturamento (CPF ou CNPJ, endereco) e eventuais
                  informacoes de perfil fornecidas voluntariamente.
                </p>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0F1A2E] mb-2">
                  2.2 Dados clinicos dos pacientes
                </p>
                <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
                  Nome, data de nascimento, sexo, dados de contato (telefone, e-mail), anamnese,
                  registros de evolucao clinica, hipoteses diagnosticas, resultados de exames,
                  prescricoes, planos de tratamento, fotos e documentos clinicos anexados pelo
                  profissional. Esses dados constituem dados sensiveis na categoria de dados de
                  saude, nos termos do Art. 5, inciso II, da LGPD.
                </p>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0F1A2E] mb-2">
                  2.3 Dados de acesso e navegacao
                </p>
                <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
                  Endereco IP, tipo e versao do navegador, sistema operacional, paginas acessadas,
                  horarios de login e logout, logs de acoes realizadas na plataforma e dados de
                  desempenho e erros coletados para fins de estabilidade do sistema.
                </p>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0F1A2E] mb-2">
                  2.4 Dados de cookies
                </p>
                <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
                  Utilizamos cookies estritamente necessarios para o funcionamento da plataforma
                  (autenticacao de sessao, preferencias de interface) e cookies analiticos
                  anonimizados para compreender o uso da plataforma. O usuario pode gerenciar
                  as preferencias de cookies por meio das configuracoes do navegador.
                </p>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              3. Base Legal para o Tratamento (LGPD)
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-5">
              Todo tratamento de dados realizado pela AXIEL Core esta fundamentado em bases
              legais expressamente previstas na LGPD:
            </p>
            <div className="space-y-4">
              {[
                {
                  label: "Art. 7, V — execucao de contrato",
                  desc: "Tratamento dos dados do profissional necessario para a prestacao dos servicos contratados, incluindo criacao e manutencao de conta, processamento de assinaturas e comunicacoes operacionais.",
                },
                {
                  label: "Art. 7, IX — legitimo interesse",
                  desc: "Coleta de logs de acesso, dados de seguranca, prevencao de fraudes e melhoria continua da plataforma, desde que nao prejudiquem os interesses fundamentais do titular.",
                },
                {
                  label: "Art. 7, VI — exercicio regular de direitos",
                  desc: "Retencao de dados para cumprimento de obrigacoes legais e regulatorias, especialmente nas areas fiscal, tributaria e de saude.",
                },
                {
                  label: "Art. 11, II, f — prestacao de servicos de saude",
                  desc: "Tratamento de dados sensiveis de saude dos pacientes para possibilitar ao profissional o exercicio de suas atividades clinicas por meio da plataforma.",
                },
                {
                  label: "Art. 11, I — consentimento",
                  desc: "Quando o paciente acessa o Portal do Paciente e fornece dados diretamente a plataforma, o tratamento e realizado com base em seu consentimento livre, informado e inequivoco.",
                },
              ].map((item) => (
                <div key={item.label} className="pl-4 border-l-2 border-[#0F6E56]/25">
                  <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
                    <span className="font-semibold text-[#0F1A2E]">{item.label}:</span>{" "}
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              4. Finalidades do Tratamento
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              Os dados pessoais sao tratados exclusivamente para as seguintes finalidades:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75">
              {[
                "Criacao, manutencao e autenticacao de contas de usuario na plataforma;",
                "Operacao das funcionalidades: agenda, prontuario eletronico, comunicacoes automaticas, financeiro e relatorios;",
                "Processamento de pagamentos e emissao de cobrancas referentes a assinatura do plano;",
                "Envio de notificacoes transacionais (confirmacoes de agendamento, lembretes, atualizacoes do sistema);",
                "Geracao de insights clinicos por inteligencia artificial, exclusivamente a partir dos dados do proprio paciente e para uso do profissional responsavel;",
                "Monitoramento da seguranca, deteccao de acessos nao autorizados e prevencao de fraudes;",
                "Melhoria continua dos servicos por meio de dados agregados e anonimizados;",
                "Cumprimento de obrigacoes legais, regulatorias e contratuais.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              5. Compartilhamento de Dados com Terceiros
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-5">
              A AXIEL Core jamais vende, aluga ou cede dados pessoais a terceiros para fins
              comerciais. O compartilhamento ocorre exclusivamente com os seguintes fornecedores
              tecnicos, na qualidade de operadores de dados, que atuam sob contrato e em
              conformidade com a LGPD:
            </p>
            <div className="space-y-4">
              {[
                {
                  name: "Supabase / AWS",
                  desc: "Infraestrutura de banco de dados e armazenamento em nuvem. Todos os dados sao armazenados com criptografia em repouso (AES-256) e em transito (TLS 1.2+).",
                },
                {
                  name: "Stripe",
                  desc: "Processamento de pagamentos e gestao de assinaturas. Dados de cartao de credito nunca trafegam pelos servidores da AXIEL Core — processados diretamente pelo Stripe com certificacao PCI-DSS.",
                },
                {
                  name: "Resend",
                  desc: "Envio de e-mails transacionais (confirmacoes, lembretes, notificacoes). Apenas o endereco de e-mail do destinatario e o conteudo necessario para a comunicacao sao transmitidos.",
                },
                {
                  name: "Twilio",
                  desc: "Envio de mensagens SMS e comunicacoes via WhatsApp. O numero de telefone e o conteudo da mensagem sao compartilhados exclusivamente para possibilitar a entrega da comunicacao.",
                },
              ].map((item) => (
                <div key={item.name} className="flex gap-4 items-start">
                  <span className="text-[12px] font-semibold text-[#0F6E56] uppercase tracking-wider mt-[2px] shrink-0 w-28">
                    {item.name}
                  </span>
                  <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mt-5">
              Alem dos fornecedores acima, poderemos compartilhar dados quando exigido por lei,
              ordem judicial ou autoridade competente, ou para proteger os direitos, propriedade
              ou seguranca da AXIEL Core, de seus usuarios ou de terceiros.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              6. Transferencia Internacional de Dados
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Alguns de nossos fornecedores tecnicos possuem infraestrutura em territorio
              estrangeiro. Toda transferencia internacional de dados pessoais e realizada em
              conformidade com o Art. 33 da LGPD, mediante adocao de clausulas contratuais padrao
              ou constatacao de que o pais de destino oferece grau de protecao adequado ao previsto
              na legislacao brasileira. Atualmente, dados podem ser processados em servidores
              localizados nos Estados Unidos e na Uniao Europeia, ambos com mecanismos de
              adequacao reconhecidos pela ANPD e pela doutrina especializada.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              7. Prazo de Retencao dos Dados
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              Os dados pessoais sao retidos pelo tempo necessario para cumprir as finalidades
              descritas nesta politica, observados os seguintes criterios:
            </p>
            <ul className="space-y-3 text-[14px] leading-relaxed text-[#0F1A2E]/75">
              {[
                {
                  title: "Conta ativa",
                  desc: "Os dados sao mantidos durante toda a vigencia do contrato de prestacao de servicos.",
                },
                {
                  title: "Apos encerramento da conta",
                  desc: "Os dados sao retidos por ate 5 (cinco) anos para cumprimento de obrigacoes legais nas areas fiscal (Decreto n. 9.580/2018), previdenciaria e de saude (Resolucao CFM n. 1.821/2007 e normas equivalentes).",
                },
                {
                  title: "Logs de acesso",
                  desc: "Retidos por 6 (seis) meses, conforme o Art. 15 do Marco Civil da Internet (Lei n. 12.965/2014).",
                },
                {
                  title: "Dados anonimizados",
                  desc: "Podem ser retidos indefinidamente para fins de inteligencia de negocios e melhoria de produto, uma vez que nao permitem a identificacao do titular.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  <span>
                    <span className="font-semibold text-[#0F1A2E]">{item.title}:</span>{" "}
                    {item.desc}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              8. Direitos do Titular (LGPD, Art. 18)
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-5">
              O titular dos dados pessoais possui os seguintes direitos, que podem ser exercidos a
              qualquer momento mediante solicitacao ao nosso Encarregado pelo endereco{" "}
              <a
                href="mailto:privacidade@axielcore.com"
                className="text-[#0F6E56] hover:underline"
              >
                privacidade@axielcore.com
              </a>
              :
            </p>
            <div className="space-y-3">
              {[
                {
                  title: "Confirmacao e acesso",
                  desc: "Confirmar a existencia de tratamento e acessar os dados pessoais mantidos pela AXIEL Core.",
                },
                {
                  title: "Correcao",
                  desc: "Solicitar a correcao de dados incompletos, inexatos ou desatualizados.",
                },
                {
                  title: "Anonimizacao, bloqueio ou eliminacao",
                  desc: "Solicitar a anonimizacao de dados desnecessarios ou excessivos, o bloqueio do tratamento ou a eliminacao dos dados, salvo quando a retencao for exigida por lei.",
                },
                {
                  title: "Portabilidade",
                  desc: "Receber os dados em formato estruturado e interoperavel para transferencia a outro fornecedor de servicos.",
                },
                {
                  title: "Informacao sobre compartilhamento",
                  desc: "Obter informacao sobre com quais entidades publicas e privadas os dados foram compartilhados.",
                },
                {
                  title: "Revogacao do consentimento",
                  desc: "Quando o tratamento for baseado em consentimento, revoga-lo a qualquer momento, sem prejuizo da licitude dos tratamentos realizados anteriormente.",
                },
                {
                  title: "Oposicao",
                  desc: "Opor-se a tratamentos realizados com fundamento em bases legais diversas do consentimento, em caso de descumprimento desta politica.",
                },
                {
                  title: "Revisao de decisoes automatizadas",
                  desc: "Solicitar a revisao de decisoes tomadas unicamente com base em tratamento automatizado de dados pessoais que afetem seus interesses.",
                },
                {
                  title: "Peticionar a ANPD",
                  desc: "Apresentar peticao a Autoridade Nacional de Protecao de Dados (ANPD) em relacao aos seus dados.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
                    <span className="font-semibold text-[#0F1A2E]">{item.title}:</span>{" "}
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mt-5">
              Responderemos a todas as solicitacoes em ate 15 (quinze) dias corridos, podendo esse
              prazo ser prorrogado por igual periodo, devidamente justificado, nos termos da
              regulamentacao da ANPD.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              9. Medidas de Seguranca
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              Adotamos medidas tecnicas e organizacionais adequadas para proteger os dados pessoais
              contra acesso nao autorizado, perda, destruicao, alteracao ou divulgacao indevida:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75">
              {[
                "Criptografia em transito via TLS 1.2 ou superior em todas as comunicacoes entre cliente e servidor;",
                "Criptografia em repouso (AES-256) para todos os dados armazenados em banco de dados e no servico de armazenamento de arquivos;",
                "Row-Level Security (RLS) garantindo que cada profissional acesse exclusivamente os dados de seus proprios pacientes;",
                "Autenticacao segura com suporte a autenticacao multifator (MFA) e tokens de sessao com expiracao controlada;",
                "Logs de auditoria registrando todas as acoes relevantes realizadas na plataforma;",
                "Controle de acesso interno baseado no principio do menor privilegio, restringindo o acesso de colaboradores da AXIEL Core aos dados estritamente necessarios;",
                "Testes regulares de seguranca e revisao de vulnerabilidades;",
                "Procedimento de resposta a incidentes com notificacao a ANPD e aos titulares afetados dentro do prazo legal.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              10. Responsabilidade do Profissional sobre os Dados dos Pacientes
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              O profissional de saude usuario da plataforma e o controlador dos dados pessoais
              de seus pacientes, cabendo a AXIEL Core a funcao de operadora de dados, conforme
              Art. 5, inciso VII, da LGPD. Nessa condicao, o profissional e responsavel por:
              (i) obter o consentimento adequado dos pacientes para a coleta e tratamento de seus
              dados clinicos; (ii) garantir a exatidao e atualizacao das informacoes inseridas;
              (iii) observar os deveres eticos e as normas dos respectivos conselhos profissionais
              (CFM, CFP, CRN, CREFITO e outros); e (iv) comunicar a seus pacientes a existencia
              desta Politica de Privacidade quando aplicavel. A AXIEL Core disponibiliza ao
              profissional todas as ferramentas tecnicas necessarias para o cumprimento dessas
              obrigacoes.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              11. Inteligencia Artificial e Tratamento Automatizado
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              A plataforma AXIEL Core utiliza recursos de inteligencia artificial para gerar
              insights clinicos, sugestoes de evolucao e resumos de atendimento. Esses recursos
              processam os dados clinicos do paciente exclusivamente para apoiar o trabalho do
              profissional de saude responsavel, e jamais para tomar decisoes diagnosticas ou
              terapeuticas de forma autonoma. Nenhum dado e utilizado para treinar modelos de
              inteligencia artificial de terceiros sem anonimizacao previa e consentimento
              explicito. O titular tem o direito de solicitar a revisao de qualquer processamento
              automatizado que o afete, conforme descrito na Secao 8.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              12. Portal do Paciente
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              O Portal do Paciente e um ambiente disponibilizado ao profissional para que seus
              pacientes possam visualizar informacoes de acompanhamento do tratamento. Quando o
              paciente acessa o Portal, seus dados de acesso (nome, e-mail, preferencias) sao
              coletados com base em seu consentimento explicito. O paciente pode, a qualquer
              momento, solicitar a revogacao do acesso ao Portal diretamente ao profissional
              responsavel pelo seu atendimento. O conteudo exibido no Portal e de responsabilidade
              exclusiva do profissional que o configura.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              13. Menores de Idade
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              A plataforma AXIEL Core e destinada exclusivamente a profissionais de saude maiores
              de 18 (dezoito) anos. Dados pessoais de criancas e adolescentes podem ser inseridos
              na plataforma pelo profissional responsavel pelo atendimento, como dados de pacientes
              pediatricos. Nesses casos, o tratamento deve observar o Art. 14 da LGPD e as normas
              do Estatuto da Crianca e do Adolescente (ECA — Lei n. 8.069/1990), sendo de
              responsabilidade do profissional obter o consentimento dos pais ou responsaveis
              legais quando exigido.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              14. Incidentes de Seguranca
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Em caso de incidente de seguranca que possa acarretar risco ou dano relevante aos
              titulares, a AXIEL Core notificara a ANPD e os titulares afetados dentro do prazo
              estabelecido pela regulamentacao vigente. A notificacao contera: (i) descricao da
              natureza dos dados afetados; (ii) informacoes sobre os titulares envolvidos;
              (iii) indicacao das medidas tecnicas e de seguranca utilizadas; (iv) riscos
              relacionados ao incidente; e (v) medidas que foram ou que serao adotadas para
              reverter ou mitigar os efeitos do incidente.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              15. Encarregado pelo Tratamento de Dados (DPO)
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Nos termos do Art. 41 da LGPD, a AXIEL Core designou um Encarregado pelo Tratamento
              de Dados Pessoais (Data Protection Officer — DPO), responsavel por atuar como canal
              de comunicacao entre a empresa, os titulares dos dados e a Autoridade Nacional de
              Protecao de Dados (ANPD). O Encarregado pode ser contatado pelo endereco
              eletronico:{" "}
              <a
                href="mailto:privacidade@axielcore.com"
                className="text-[#0F6E56] hover:underline"
              >
                privacidade@axielcore.com
              </a>
              . Todas as solicitacoes sao tratadas com confidencialidade e respondidas dentro dos
              prazos legais.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              16. Alteracoes nesta Politica
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Esta Politica de Privacidade pode ser atualizada periodicamente para refletir
              mudancas nas praticas de tratamento de dados, novas funcionalidades da plataforma
              ou alteracoes legislativas. Notificaremos os usuarios sobre alteracoes materiais
              por e-mail e por aviso destacado na plataforma, com antecedencia minima de 15
              (quinze) dias antes da entrada em vigor. O uso continuado da plataforma apos a
              data de vigencia das novas condicoes constituira aceitacao das alteracoes. Versoes
              anteriores desta politica serao mantidas em arquivo e disponibilizadas mediante
              solicitacao.
            </p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              17. Foro e Lei Aplicavel
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Esta Politica de Privacidade e regida pelas leis da Republica Federativa do Brasil,
              em especial pela Lei n. 13.709/2018 (LGPD), pelo Marco Civil da Internet (Lei n.
              12.965/2014) e pelo Codigo de Defesa do Consumidor (Lei n. 8.078/1990). Para
              dirimir quaisquer controversias decorrentes desta politica, fica eleito o foro da
              Comarca de Sao Paulo, Estado de Sao Paulo, com expressa renúncia a qualquer outro,
              por mais privilegiado que seja.
            </p>
          </section>

        </div>

        {/* Contact CTA */}
        <div className="mt-14 p-6 border border-[#0F6E56]/20 rounded-xl bg-[#0F6E56]/[0.04]">
          <p className="text-[14px] font-semibold text-[#0F1A2E] mb-1">
            Duvidas sobre privacidade?
          </p>
          <p className="text-[14px] leading-relaxed text-[#0F1A2E]/65">
            Entre em contato com nosso Encarregado de Dados:{" "}
            <a
              href="mailto:privacidade@axielcore.com"
              className="text-[#0F6E56] hover:underline font-medium"
            >
              privacidade@axielcore.com
            </a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
