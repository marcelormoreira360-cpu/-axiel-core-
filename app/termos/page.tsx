import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — AXIEL Core",
  description:
    "Leia os Termos de Uso do AXIEL Core, a plataforma SaaS de gestao clinica para profissionais de saude integrativa.",
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
          <Link
            href="/privacidade"
            className="text-[12px] text-[#0F1A2E]/50 hover:text-[#0F6E56] transition-colors"
          >
            Privacidade
          </Link>
          <Link href="/termos" className="text-[12px] text-[#0F6E56]">
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

export default function TermosPage() {
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
            Termos de Uso
          </h1>
          <p className="text-[14px] text-[#0F1A2E]/55 leading-relaxed">
            Vigencia: Maio de 2025 &nbsp;&middot;&nbsp; Ultima atualizacao: Maio de 2025
          </p>
        </div>

        {/* Intro */}
        <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-12">
          Estes Termos de Uso regulam o acesso e a utilizacao da plataforma AXIEL Core
          ("Plataforma"), disponibilizada pela empresa responsavel pelo AXIEL Core ("AXIEL Core",
          "nos" ou "nosso"). Ao criar uma conta ou utilizar qualquer funcionalidade da Plataforma,
          voce ("Usuario" ou "Profissional") declara ter lido, compreendido e concordado
          integralmente com estes Termos. Caso nao concorde com qualquer disposicao, nao utilize
          a Plataforma.
        </p>

        <div className="space-y-12">

          {/* 1 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              1. Objeto e Descricao da Plataforma
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              O AXIEL Core e uma plataforma de software como servico (SaaS) destinada a
              profissionais e clinicas de saude integrativa, desenvolvida para centralizar a
              gestao clinica em um unico ambiente digital. A Plataforma oferece as seguintes
              funcionalidades principais, que podem variar conforme o plano contratado: agenda
              inteligente com lembretes automaticos, prontuario eletronico (anamnese, evolucao
              clinica, prescricoes, exames e documentos), gestao financeira, automacoes de
              relacionamento com pacientes via WhatsApp e e-mail, portal do paciente com link
              personalizado, relatorios e indicadores clinicos, e insights gerados por
              inteligencia artificial como suporte ao trabalho clinico. A AXIEL Core reserva-se
              o direito de adicionar, modificar ou descontinuar funcionalidades mediante
              comunicacao previa aos usuarios.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              2. Elegibilidade e Cadastro
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              O uso da Plataforma e permitido exclusivamente a profissionais de saude com
              registro ativo em um conselho profissional brasileiro competente, incluindo, sem
              limitacao: Conselho Federal de Medicina (CFM), Conselho Federal de Psicologia
              (CFP), Conselho Federal de Nutricionistas (CFN), Conselho Federal de
              Fisioterapia e Terapia Ocupacional (COFFITO), Conselho Federal de Fonoaudiologia
              (CFFa), Conselho Federal de Enfermagem (COFEN) e outros conselhos equivalentes.
              Tambem e permitido a clinicas, espacos de bem-estar e estabelecimentos de saude
              devidamente constituidos, representados por um responsavel tecnico habilitado.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              Para criar uma conta, o Usuario devera fornecer informacoes verdadeiras, completas
              e atualizadas, incluindo nome completo, endereco de e-mail valido e numero de
              registro profissional. O Usuario e integralmente responsavel pela veracidade das
              informacoes cadastradas e pela manutencao da confidencialidade de suas credenciais
              de acesso.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              E vedado o cadastro de menores de 18 (dezoito) anos como usuarios da Plataforma.
              A AXIEL Core reserva-se o direito de verificar a validade dos registros
              profissionais informados e de suspender ou cancelar contas que nao atendam aos
              criterios de elegibilidade.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              3. Planos, Precos e Cobranca
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-5">
              A Plataforma e oferecida nos seguintes planos de assinatura:
            </p>
            <div className="space-y-4 mb-5">
              {(
                [
                  {
                    name: "Starter",
                    price: "R$ 78/mes",
                    desc: "Para profissionais autonomos em inicio de uso. Inclui funcionalidades essenciais de agenda, prontuario e comunicacao com pacientes.",
                  },
                  {
                    name: "Professional",
                    price: "R$ 118/mes",
                    desc: "Para profissionais com volume maior de atendimentos. Inclui todas as funcionalidades do Starter mais automacoes avancadas, insights de IA, portal do paciente e relatorios financeiros.",
                  },
                  {
                    name: "Enterprise",
                    price: "Sob consulta",
                    desc: "Para clinicas e equipes multiprofissionais. Inclui todas as funcionalidades do Professional mais multiusuarios, customizacoes, integracoes dedicadas e suporte prioritario.",
                  },
                ] as const
              ).map((plan) => (
                <div key={plan.name} className="flex gap-4 items-start">
                  <div className="shrink-0 w-32">
                    <span className="text-[13px] font-semibold text-[#0F1A2E]">{plan.name}</span>
                    <br />
                    <span className="text-[12px] font-medium text-[#0F6E56]">{plan.price}</span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">{plan.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              Todos os novos usuarios tem acesso a um periodo de avaliacao gratuita de 14
              (quatorze) dias com acesso completo ao plano Professional, sem necessidade de
              cadastro de cartao de credito. Apos o termino do periodo de avaliacao, o Usuario
              devera contratar um dos planos pagos para continuar utilizando a Plataforma.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              As assinaturas sao cobradas mensalmente de forma antecipada. O processamento de
              pagamentos e realizado exclusivamente pelo Stripe. A AXIEL Core reserva-se o
              direito de reajustar os precos dos planos mediante notificacao ao Usuario com
              antecedencia minima de 30 (trinta) dias. O uso continuado da Plataforma apos a
              data de vigencia do novo preco constituira aceite do reajuste.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Em caso de inadimplencia, o acesso a Plataforma podera ser suspenso apos 5 (cinco)
              dias corridos de atraso, sendo restabelecido apos a regularizacao do pagamento.
              Nao ha reembolso proporcional em caso de cancelamento antes do final do periodo
              de cobranca em curso.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              4. Conta e Responsabilidades do Usuario
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              O Usuario e o unico e exclusivo responsavel por:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              {[
                "Manter a confidencialidade de seu login e senha, nao os compartilhando com terceiros;",
                "Todas as acoes realizadas na Plataforma a partir de suas credenciais de acesso;",
                "Notificar imediatamente a AXIEL Core pelo e-mail suporte@axielcore.com em caso de acesso nao autorizado ou suspeita de comprometimento de suas credenciais;",
                "Garantir que os dados inseridos na Plataforma sao verdadeiros, precisos e obtidos de forma legal e etica;",
                "Manter atualizados seus dados cadastrais e de contato.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              A AXIEL Core nao sera responsavel por prejuizos decorrentes do uso nao autorizado
              da conta do Usuario quando este nao comunicar a situacao em tempo habil.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              5. Periodo de Avaliacao Gratuita (Trial)
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              O periodo de avaliacao gratuita de 14 (quatorze) dias e oferecido uma unica vez
              por CPF ou CNPJ, ao primeiro cadastro. Durante o trial, o Usuario tem acesso
              completo as funcionalidades do plano Professional, salvo restricoes tecnicas
              operacionais.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Ao final do periodo de avaliacao, caso o Usuario nao contrate um plano pago, o
              acesso a Plataforma sera suspenso automaticamente e os dados ficam retidos por
              30 (trinta) dias para eventual reativacao. Apos esse prazo, os dados poderao ser
              permanentemente eliminados, salvo obrigacao legal de retencao. A AXIEL Core nao
              oferece extensao do periodo de trial sem autorizacao expressa.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              6. Uso Aceitavel da Plataforma
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              O Usuario compromete-se a utilizar a Plataforma exclusivamente para fins licitos,
              eticos e de acordo com estes Termos. Sao expressamente vedados:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              {[
                "Utilizar os insights e sugestoes gerados pela inteligencia artificial como diagnostico medico, psicologico ou nutricional definitivo — tais recursos sao exclusivamente de suporte ao julgamento clinico do profissional;",
                "Inserir dados de pacientes sem o seu consentimento ou sem a devida autorizacao legal;",
                "Utilizar a Plataforma para fins que violem a etica profissional ou as normas dos respectivos conselhos profissionais;",
                "Realizar engenharia reversa, decompilar ou tentar extrair o codigo-fonte da Plataforma;",
                "Utilizar meios automatizados (bots, scrapers, crawlers) para acessar ou coletar dados da Plataforma sem autorizacao expressa;",
                "Compartilhar ou revender o acesso a Plataforma a terceiros;",
                "Inserir conteudo ilegal, difamatorio, discriminatorio ou que viole direitos de terceiros;",
                "Utilizar a Plataforma de forma que comprometa sua seguranca, disponibilidade ou desempenho para outros usuarios.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              A violacao de qualquer das disposicoes acima pode resultar na suspensao ou
              cancelamento imediato da conta, sem direito a reembolso, alem de responsabilizacao
              civil e criminal nas esferas aplicaveis.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              7. Inteligencia Artificial — Limites e Responsabilidade
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              A AXIEL Core utiliza modelos de linguagem de grande porte (LLMs) para oferecer
              funcionalidades como geracao de resumos de atendimento, insights clinicos,
              transcricao de audio e sugestoes de evolucao. O Usuario reconhece e concorda que:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              {[
                "Os outputs gerados pela IA sao sugestoes de apoio ao trabalho clinico e nao substituem o julgamento, a avaliacao ou a responsabilidade do profissional de saude;",
                "A AXIEL Core nao garante a exatidao, completude ou adequacao clinica dos conteudos gerados por IA;",
                "O profissional e integralmente responsavel por revisar, validar e tomar decisoes com base nos outputs gerados;",
                "O uso de insights de IA para embasar exclusivamente decisoes diagnosticas ou terapeuticas, sem supervisao profissional, e expressamente vedado e constitui uso indevido da Plataforma;",
                "A AXIEL Core nao se responsabiliza por danos decorrentes do uso inadequado ou da interpretacao incorreta dos conteudos gerados pela IA.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              8. Dados Clinicos e Privacidade dos Pacientes
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              O Usuario, na qualidade de profissional de saude, e o controlador dos dados
              pessoais de seus pacientes inseridos na Plataforma, nos termos da Lei Geral de
              Protecao de Dados (LGPD — Lei n. 13.709/2018). A AXIEL Core atua como operadora
              de dados, processando as informacoes unicamente conforme as instrucoes do Usuario
              e para as finalidades descritas na Politica de Privacidade.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              O Usuario e responsavel por:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              {[
                "Obter o consentimento adequado dos pacientes para coleta, armazenamento e tratamento de seus dados clinicos na Plataforma;",
                "Informar os pacientes sobre a existencia e o conteudo da Politica de Privacidade da AXIEL Core;",
                "Garantir a exatidao e a licitude dos dados inseridos;",
                "Cumprir as obrigacoes de sigilo profissional e etica previstas nas normas dos conselhos profissionais competentes;",
                "Exercer o direito de portabilidade dos dados dos pacientes, quando solicitado, por meio das ferramentas disponibilizadas na Plataforma.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Para mais informacoes sobre como tratamos os dados pessoais, consulte nossa{" "}
              <Link href="/privacidade" className="text-[#0F6E56] hover:underline">
                Politica de Privacidade
              </Link>
              .
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              9. Disponibilidade, Uptime e Manutencao
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              A AXIEL Core empreende esforcos comercialmente razoaveis para manter a Plataforma
              disponivel 24 (vinte e quatro) horas por dia, 7 (sete) dias por semana. No
              entanto, a AXIEL Core nao garante disponibilidade ininterrupta de 100%, e o
              Usuario reconhece que a Plataforma pode ficar indisponivel temporariamente por
              razoes que incluem:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              {[
                "Manutencao preventiva programada, comunicada ao Usuario com antecedencia minima de 48 (quarenta e oito) horas por e-mail e/ou aviso na Plataforma;",
                "Falhas em infraestrutura de terceiros (provedores de nuvem, redes de telecomunicacao);",
                "Eventos de forca maior ou caso fortuito (desastres naturais, ataques ciberneticos de grande escala, falhas de energia);",
                "Atualizacoes emergenciais de seguranca, que podem ser realizadas sem aviso previo.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Em casos de indisponibilidade prolongada e injustificada, superior a 72 (setenta
              e duas) horas consecutivas, o Usuario podera solicitar credito proporcional ao
              tempo de interrupcao, a criterio da AXIEL Core, mediante abertura de chamado de
              suporte.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              10. Propriedade Intelectual
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              Todos os direitos de propriedade intelectual relacionados a Plataforma AXIEL Core,
              incluindo software, codigo-fonte, design, interface, logotipos, marcas, textos,
              metodologias e documentacao, sao de propriedade exclusiva da AXIEL Core ou de
              seus licenciantes, e estao protegidos pela Lei de Propriedade Industrial (Lei n.
              9.279/1996), pela Lei de Direitos Autorais (Lei n. 9.610/1998) e por outros
              instrumentos legais aplicaveis.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              A contratacao dos servicos concede ao Usuario uma licenca limitada, intransferivel,
              nao exclusiva e revogavel para acessar e utilizar a Plataforma estritamente dentro
              dos limites estabelecidos nestes Termos. Esta licenca nao inclui o direito de
              reproduzir, distribuir, modificar, criar obras derivadas, sublicenciar, vender ou
              explorar comercialmente qualquer componente da Plataforma.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Os dados inseridos pelo Usuario na Plataforma (incluindo prontuarios, evolucoes e
              documentos clinicos) permanecem de propriedade do Usuario. A AXIEL Core nao
              reivindica propriedade sobre os dados clinicos dos pacientes cadastrados.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              11. Conformidade com Normas Profissionais
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              O Usuario e integralmente responsavel por garantir que seu uso da Plataforma esta
              em conformidade com as normas eticas e regulatorias dos seus respectivos conselhos
              profissionais, incluindo, sem limitacao:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              {[
                "Resolucoes do CFM sobre prontuario eletronico, telemedicina e uso de IA (incluindo Resolucao CFM n. 1.821/2007 e subsequentes);",
                "Resolucoes do CFP sobre atendimento online e registros clinicos;",
                "Normas do CFN sobre documentacao e conduta profissional;",
                "Normas do COFFITO, CFFa, COFEN e demais conselhos competentes;",
                "Legislacao sanitaria aplicavel, incluindo normas da ANVISA sobre prontuario eletronico e telemedicina.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              A AXIEL Core nao se responsabiliza por irregularidades no exercicio profissional do
              Usuario decorrentes do descumprimento das normas acima.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              12. Suporte ao Usuario
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              A AXIEL Core oferece suporte tecnico aos usuarios dos planos pagos pelos seguintes
              canais:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              {[
                "E-mail: suporte@axielcore.com (resposta em ate 1 dia util nos planos Starter e Professional);",
                "Chat na Plataforma disponivel nos planos Professional e Enterprise, em horario comercial de segunda a sexta-feira, das 9h as 18h, horario de Brasilia;",
                "Suporte prioritario dedicado para o plano Enterprise, conforme acordado em contrato.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              O suporte abrange exclusivamente questoes tecnicas relacionadas ao uso da
              Plataforma. Questoes juridicas, fiscais ou de etica profissional nao fazem parte
              do escopo de suporte da AXIEL Core.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              13. Cancelamento e Rescisao
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              O Usuario pode cancelar sua assinatura a qualquer momento por meio das
              configuracoes da conta na Plataforma ou entrando em contato com o suporte. O
              cancelamento entra em vigor ao final do periodo de cobranca em curso, sem prejuizo
              do acesso ate essa data. Nao ha cobranca de multa rescisoria para cancelamentos
              realizados conforme este processo.
            </p>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              A AXIEL Core podera cancelar ou suspender a conta do Usuario, com ou sem aviso
              previo, nas seguintes situacoes:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              {[
                "Violacao de qualquer clausula destes Termos de Uso;",
                "Uso da Plataforma para fins ilegais, antiéticos ou que prejudiquem terceiros;",
                "Inadimplencia por periodo superior a 30 (trinta) dias apos notificacao;",
                "Fornecimento de informacoes falsas no cadastro, incluindo registro profissional inativo ou invalido;",
                "Determinacao judicial ou administrativa.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Apos o cancelamento — seja pelo Usuario ou pela AXIEL Core — o Usuario tera 30
              (trinta) dias para exportar seus dados. Apos esse prazo, os dados serao retidos
              conforme a Politica de Privacidade e as obrigacoes legais aplicaveis.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              14. Limitacao de Responsabilidade
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-3">
              Na maxima extensao permitida pela legislacao brasileira aplicavel, a AXIEL Core
              nao sera responsavel por:
            </p>
            <ul className="space-y-2 text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-4">
              {[
                "Danos indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo perda de receita, perda de dados, perda de oportunidades de negocios ou danos a reputacao;",
                "Danos decorrentes de acesso nao autorizado a conta do Usuario causado por negligencia do proprio Usuario;",
                "Decisoes clinicas, diagnosticas ou terapeuticas tomadas pelo Usuario com base nos dados gerenciados na Plataforma;",
                "Interrupcoes de servico causadas por terceiros (provedores de nuvem, operadoras de telecomunicacoes, fornecedores de IA);",
                "Danos decorrentes de uso inadequado da Plataforma em desacordo com estes Termos.",
              ].map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Em qualquer hipotese, a responsabilidade total da AXIEL Core perante o Usuario
              fica limitada ao valor total pago pelo Usuario a AXIEL Core nos 3 (tres) meses
              imediatamente anteriores ao evento que deu origem a reclamacao.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              15. Indenizacao
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              O Usuario concorda em indenizar, defender e isentar a AXIEL Core, seus diretores,
              funcionarios, agentes e parceiros de quaisquer reclamacoes, responsabilidades,
              danos, perdas e despesas (incluindo honorarios advocaticios razoaveis) decorrentes
              de: (i) violacao destes Termos pelo Usuario; (ii) uso inadequado da Plataforma;
              (iii) violacao de direitos de terceiros, incluindo direitos de privacidade ou
              propriedade intelectual; (iv) conteudo inserido pelo Usuario na Plataforma; ou
              (v) descumprimento de normas eticas ou regulatorias da profissao do Usuario.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              16. Alteracoes nos Termos
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              A AXIEL Core reserva-se o direito de modificar estes Termos de Uso a qualquer
              momento. Alteracoes materiais serao comunicadas ao Usuario por e-mail e por aviso
              destacado na Plataforma com antecedencia minima de 15 (quinze) dias antes da
              entrada em vigor. Alteracoes nao materiais (correcoes gramaticais, ajustes de
              formatacao, atualizacoes de contato) podem ser realizadas sem aviso previo. O
              uso continuado da Plataforma apos a data de vigencia das novas condicoes
              constituira aceite dos Termos revisados. Caso o Usuario nao concorde com as
              alteracoes, podera cancelar sua conta conforme descrito na Secao 13.
            </p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="text-[18px] font-semibold text-[#0F1A2E] mb-4">
              17. Lei Aplicavel e Foro
            </h2>
            <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75">
              Estes Termos de Uso sao regidos e interpretados de acordo com as leis da Republica
              Federativa do Brasil, em especial pela Lei n. 10.406/2002 (Codigo Civil), pela Lei
              n. 8.078/1990 (Codigo de Defesa do Consumidor), pela Lei n. 12.965/2014 (Marco
              Civil da Internet) e pela Lei n. 13.709/2018 (LGPD). As partes elegem o foro da
              Comarca de Sao Paulo, Estado de Sao Paulo, para dirimir quaisquer controversias
              decorrentes destes Termos, com expressa renuncio a qualquer outro foro, por mais
              privilegiado que seja. Antes de recorrer ao judiciario, as partes comprometem-se
              a tentar a resolucao amigavel da controversia por um periodo minimo de 30 (trinta)
              dias.
            </p>
          </section>

        </div>

        {/* Contact CTA */}
        <div className="mt-14 p-6 border border-[#0F6E56]/20 rounded-xl bg-[#0F6E56]/[0.04]">
          <p className="text-[14px] font-semibold text-[#0F1A2E] mb-1">
            Duvidas sobre estes Termos?
          </p>
          <p className="text-[14px] leading-relaxed text-[#0F1A2E]/65">
            Fale conosco pelo e-mail{" "}
            <a
              href="mailto:contato@axielcore.com"
              className="text-[#0F6E56] hover:underline font-medium"
            >
              contato@axielcore.com
            </a>{" "}
            ou acesse nossa{" "}
            <Link href="/privacidade" className="text-[#0F6E56] hover:underline font-medium">
              Politica de Privacidade
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
