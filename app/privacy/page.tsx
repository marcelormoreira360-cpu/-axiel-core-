import Link from "next/link";
import { BackLink } from "@/components/back-link";
import type { Metadata } from "next";

/**
 * Política de Privacidade da IFWC (clínica), servida pelo próprio Core porque
 * Marcelo não tem acesso ao site jifwc.com. Página PÚBLICA (sem login) — precisa
 * estar na allowlist do middleware (rota "/privacy" em publicRoutes) e é o
 * destino do consentimento do formulário público (PRIVACY_URL em
 * components/public-capture-form.tsx).
 *
 * Conteúdo estático bilíngue (EN primeiro, PT depois), destilado do rascuho
 * jurídico. NÃO usa next-intl de propósito: é copy legal fixa (mesma em qualquer
 * idioma da UI) e não deve inflar os namespaces do verify:i18n. Os marcadores
 * internos "[confirmar jurídico ...]" e as seções internas do rascunho foram
 * removidos. Datas de vigência/atualização: 7 de julho de 2026.
 */

export const metadata: Metadata = {
  title: "Privacy Policy — IFWC",
  description:
    "How Integrative & Functional Wellness Center (IFWC / Moreira & Angeli LLC) collects, uses, and protects your information.",
  robots: { index: true, follow: true },
};

const EFFECTIVE_EN = "July 7, 2026";
const EFFECTIVE_PT = "7 de julho de 2026";

const H2 = "text-[18px] font-semibold text-[#0F1A2E] mb-4";
const P = "text-[14px] leading-relaxed text-[#0F1A2E]/75";
const STRONG = "font-semibold text-[#0F1A2E]";
const BULLET = <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>;

function Navbar() {
  return (
    <header className="border-b border-[#0F1A2E]/10 bg-[#FAFAF8]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-[800px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-[13px] font-semibold tracking-widest text-[#0F1A2E] uppercase">
          IFWC
        </Link>
        <div className="flex items-center gap-6">
          <BackLink fallbackHref="/" className="text-[13px] text-[#0F1A2E]/55 hover:text-[#0F6E56] transition-colors">
            Back
          </BackLink>
          <a href="#pt" className="text-[13px] text-[#0F1A2E]/55 hover:text-[#0F6E56] transition-colors">
            Português
          </a>
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
          &copy; {new Date().getFullYear()} Moreira &amp; Angeli LLC (IFWC)
        </p>
        <div className="flex items-center gap-5">
          <a href="#en" className="text-[12px] text-[#0F1A2E]/50 hover:text-[#0F6E56] transition-colors">
            English
          </a>
          <a href="#pt" className="text-[12px] text-[#0F1A2E]/50 hover:text-[#0F6E56] transition-colors">
            Português
          </a>
        </div>
      </div>
    </footer>
  );
}

function Mail({ children = "procurement@jifwc.com" }: { children?: string }) {
  return (
    <a href="mailto:procurement@jifwc.com" className="text-[#0F6E56] hover:underline">
      {children}
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={H2}>{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className={`space-y-2 ${P}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 items-start">
          {BULLET}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* PART A — ENGLISH                                                     */
/* ------------------------------------------------------------------ */

function PolicyEnglish() {
  return (
    <>
      <div className="mb-12">
        <p className="text-[12px] font-medium tracking-widest text-[#0F6E56] uppercase mb-3">Privacy</p>
        <h1 className="text-[28px] font-semibold text-[#0F1A2E] leading-tight mb-4">Privacy Policy</h1>
        <p className="text-[14px] text-[#0F1A2E]/55 leading-relaxed">
          <span className={STRONG}>Effective date:</span> {EFFECTIVE_EN}
          <br />
          <span className={STRONG}>Last updated:</span> {EFFECTIVE_EN}
        </p>
      </div>

      <div className="space-y-12">
        <Section title="1. Who we are">
          <p className={P}>
            This Privacy Policy explains how <span className={STRONG}>Moreira &amp; Angeli LLC</span>, doing business as{" "}
            <span className={STRONG}>Integrative &amp; Functional Wellness Center (&ldquo;IFWC,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)</span>,
            located in Orlando, Florida, USA, collects, uses, and protects your information when you visit{" "}
            <span className={STRONG}>jifwc.com</span>, fill out our forms or wellness questionnaires (including at public
            events), contact us, or receive our wellness services.
          </p>
          <p className={`${P} mt-4`}>
            By using our website or providing your information, you agree to this Policy. If you do not agree, please do
            not submit your information.
          </p>
        </Section>

        <Section title="2. Scope of this Policy">
          <p className={P}>
            This Policy covers information we collect through our website, online and paper forms, wellness
            self-assessment questionnaires (such as a symptom/MSQ questionnaire), event sign-ups, and general
            communications with us. Additional terms may apply once you become a patient of our clinic (see Section 9).
          </p>
        </Section>

        <Section title="3. Information we collect">
          <p className={`${P} mb-4`}>We only collect what we need. Depending on how you interact with us, this may include:</p>
          <Bullets
            items={[
              <><span className={STRONG}>Contact details you give us:</span> first name, last name, email address, and phone number.</>,
              <><span className={STRONG}>Wellness questionnaire responses:</span> answers you provide in wellness or symptom self-assessments (for example, an MSQ or similar questionnaire). These are used to give you general educational wellness information.</>,
              <><span className={STRONG}>Basic website/usage data:</span> standard technical information such as browser type, device, approximate location, and pages viewed, collected through cookies or similar technologies to keep the site working and improve it.</>,
              <><span className={STRONG}>Additional health information (patients only):</span> if you choose to become a patient, we collect additional health information needed to provide care, as described in Section 9.</>,
            ]}
          />
          <p className={`${P} mt-4`}>
            We do <span className={STRONG}>not</span> knowingly collect more sensitive information than needed for the
            purpose you contacted us about.
          </p>
        </Section>

        <Section title="4. How we use your information">
          <p className={`${P} mb-4`}>We use your information to:</p>
          <Bullets
            items={[
              "respond to you and follow up on your request;",
              "schedule appointments and provide our wellness services;",
              "send you the educational wellness information you asked for;",
              "operate, secure, and improve our website and services.",
            ]}
          />
          <p className={`${P} mt-4`}>
            <span className={STRONG}>Important &mdash; this is not medical advice.</span> Our wellness self-assessments and
            general information are <span className={STRONG}>educational wellness tools only</span>. They are{" "}
            <span className={STRONG}>not</span> a medical diagnosis, medical advice, or a substitute for care from a
            licensed healthcare provider. Always consult a qualified professional about your health.
          </p>
        </Section>

        <Section title="5. Why we contact you (consent)">
          <p className={P}>
            <span className={STRONG}>We only contact people who have given us their information and agreed to be contacted.</span>{" "}
            When you enter your email or phone number in one of our forms, you are asking us to reach out to you about
            your request. You can ask us to stop contacting you at any time (see Section 8).
          </p>
        </Section>

        <Section title="6. Text messages (SMS)">
          <p className={P}>
            We will only send you text messages if you separately opt in to receive them (for example, by checking an
            SMS consent box). SMS messaging is governed by its own terms, including message frequency, that message and
            data rates may apply, and how to opt out. See our <span className={STRONG}>SMS Terms</span> at{" "}
            <span className={STRONG}>jifwc.com/sms-terms</span>.
          </p>
          <p className={`${P} mt-4`}>
            You can <span className={STRONG}>reply STOP at any time to unsubscribe</span> from text messages, or reply
            HELP for help. Consent to receive text messages is never a condition of receiving our services. (Note: at
            public events we collect email only; SMS is a separate, future step and requires its own opt-in.)
          </p>
        </Section>

        <Section title="7. How we share information">
          <p className={`${P} mb-4`}>
            <span className={STRONG}>We do not sell your personal information, and we do not share it for advertising in exchange for money.</span>
          </p>
          <p className={`${P} mb-4`}>
            We share information only with trusted service providers who help us operate, and only as needed to provide
            our services. These currently include:
          </p>
          <Bullets
            items={[
              <><span className={STRONG}>Twilio</span> &mdash; to send messages and communications;</>,
              <><span className={STRONG}>Supabase</span> &mdash; database hosting;</>,
              <><span className={STRONG}>Vercel</span> &mdash; website hosting.</>,
            ]}
          />
          <p className={`${P} mt-4`}>
            These providers are bound by agreements that limit how they may use your information, including a Business
            Associate Agreement (BAA) where applicable to protected health information.
          </p>
          <p className={`${P} mt-4`}>
            We may also disclose information when required by law, to protect our rights or safety, or in connection with
            a business transfer.
          </p>
        </Section>

        <Section title="8. Your choices and rights">
          <p className={`${P} mb-4`}>You may:</p>
          <Bullets
            items={[
              <><span className={STRONG}>access</span> the personal information we hold about you;</>,
              <><span className={STRONG}>correct</span> information that is inaccurate;</>,
              <><span className={STRONG}>delete</span> your personal information;</>,
              <><span className={STRONG}>opt out</span> of our communications (email or SMS).</>,
            ]}
          />
          <p className={`${P} mt-4`}>
            To make a request, email us at <Mail />. We will respond within a reasonable time and as required by
            applicable law.
          </p>
        </Section>

        <Section title="9. Health information and HIPAA">
          <p className={P}>
            Information collected from the general public at an event or through a website form &mdash; before you become
            a patient &mdash; is <span className={STRONG}>not</span> protected health information (PHI) under HIPAA.
          </p>
          <p className={`${P} mt-4`}>
            <span className={STRONG}>When you become a patient of our clinic,</span> the health information we collect to
            provide your care is handled in accordance with applicable law, including HIPAA where it applies. As a
            patient you receive a separate <span className={STRONG}>Notice of Privacy Practices</span> that describes your
            rights regarding your health records.
          </p>
        </Section>

        <Section title="10. Data security and retention">
          <p className={P}>
            We use reasonable administrative, technical, and physical safeguards to protect your information. No method
            of transmission or storage is 100% secure, so we cannot guarantee absolute security.
          </p>
          <p className={`${P} mt-4`}>
            We keep your information only as long as needed for the purposes described in this Policy, or as required by
            law, after which we delete or de-identify it. In general, we keep information from event leads and
            pre-patients for up to 24 months, or until you ask us to delete it. Patient health records are kept for as
            long as required by Florida law.
          </p>
        </Section>

        <Section title="11. Minors">
          <p className={P}>
            Our services and forms are intended for individuals <span className={STRONG}>18 years of age or older</span>,
            or minors with the consent and involvement of a parent or legal guardian. We do not knowingly collect
            information from children without appropriate consent.
          </p>
        </Section>

        <Section title="12. Changes to this Policy">
          <p className={P}>
            We may update this Policy from time to time. When we do, we will change the &ldquo;Last updated&rdquo; date
            above and, if the changes are significant, provide additional notice where appropriate. Your continued use of
            our services after an update means you accept the revised Policy.
          </p>
        </Section>

        <Section title="13. Contact us">
          <p className={`${P} mb-4`}>If you have any questions about this Policy or your information, contact:</p>
          <p className={P}>
            <span className={STRONG}>Moreira &amp; Angeli LLC (Integrative &amp; Functional Wellness Center / IFWC)</span>
            <br />
            Orlando, Florida, USA
            <br />
            Email: <Mail />
            <br />
            Website: jifwc.com
          </p>
        </Section>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* PART B — PORTUGUÊS                                                   */
/* ------------------------------------------------------------------ */

function PolicyPortugues() {
  return (
    <>
      <div className="mb-12">
        <p className="text-[12px] font-medium tracking-widest text-[#0F6E56] uppercase mb-3">Privacidade</p>
        <h1 className="text-[28px] font-semibold text-[#0F1A2E] leading-tight mb-4">Política de Privacidade</h1>
        <p className="text-[14px] text-[#0F1A2E]/55 leading-relaxed">
          <span className={STRONG}>Data de vigência:</span> {EFFECTIVE_PT}
          <br />
          <span className={STRONG}>Última atualização:</span> {EFFECTIVE_PT}
        </p>
      </div>

      <div className="space-y-12">
        <Section title="1. Quem somos">
          <p className={P}>
            Esta Política de Privacidade explica como a <span className={STRONG}>Moreira &amp; Angeli LLC</span>, atuando
            como <span className={STRONG}>Integrative &amp; Functional Wellness Center (&ldquo;IFWC&rdquo;, &ldquo;nós&rdquo;)</span>,
            sediada em Orlando, Flórida, EUA, coleta, usa e protege suas informações quando você visita o{" "}
            <span className={STRONG}>jifwc.com</span>, preenche nossos formulários ou questionários de bem-estar
            (inclusive em eventos públicos), entra em contato conosco ou recebe nossos serviços de bem-estar.
          </p>
          <p className={`${P} mt-4`}>
            Ao usar nosso site ou fornecer suas informações, você concorda com esta Política. Se não concordar, por favor
            não envie suas informações.
          </p>
        </Section>

        <Section title="2. Abrangência desta Política">
          <p className={P}>
            Esta Política cobre as informações que coletamos pelo site, por formulários (online e em papel), por
            questionários de autoavaliação de bem-estar (como um questionário de sintomas/MSQ), por inscrições em eventos
            e nas comunicações com você. Termos adicionais podem se aplicar quando você se torna paciente da nossa clínica
            (ver Seção 9).
          </p>
        </Section>

        <Section title="3. Informações que coletamos">
          <p className={`${P} mb-4`}>Coletamos apenas o necessário. Conforme a forma como você interage conosco, isso pode incluir:</p>
          <Bullets
            items={[
              <><span className={STRONG}>Dados de contato que você nos fornece:</span> nome, sobrenome, e-mail e telefone.</>,
              <><span className={STRONG}>Respostas de questionários de bem-estar:</span> respostas que você fornece em autoavaliações de bem-estar ou de sintomas (por exemplo, um MSQ ou questionário semelhante). Usadas para oferecer a você informações educacionais gerais de bem-estar.</>,
              <><span className={STRONG}>Dados básicos de navegação/uso:</span> informações técnicas padrão, como tipo de navegador, dispositivo, localização aproximada e páginas visitadas, coletadas por meio de cookies ou tecnologias semelhantes para manter o site funcionando e melhorá-lo.</>,
              <><span className={STRONG}>Informações de saúde adicionais (apenas pacientes):</span> se você optar por se tornar paciente, coletamos informações de saúde adicionais necessárias para prestar o atendimento, conforme a Seção 9.</>,
            ]}
          />
          <p className={`${P} mt-4`}>
            <span className={STRONG}>Não</span> coletamos, de forma consciente, informações mais sensíveis do que o
            necessário para a finalidade que motivou seu contato.
          </p>
        </Section>

        <Section title="4. Como usamos suas informações">
          <p className={`${P} mb-4`}>Usamos suas informações para:</p>
          <Bullets
            items={[
              "responder e dar retorno à sua solicitação;",
              "agendar consultas e prestar nossos serviços de bem-estar;",
              "enviar as informações educacionais de bem-estar que você pediu;",
              "operar, proteger e melhorar nosso site e nossos serviços.",
            ]}
          />
          <p className={`${P} mt-4`}>
            <span className={STRONG}>Importante &mdash; isto não é aconselhamento médico.</span> Nossas autoavaliações de
            bem-estar e informações gerais são <span className={STRONG}>apenas ferramentas educacionais de bem-estar</span>.
            Elas <span className={STRONG}>não</span> são diagnóstico médico, aconselhamento médico, nem substituem o
            cuidado de um profissional de saúde licenciado. Consulte sempre um profissional qualificado sobre sua saúde.
          </p>
        </Section>

        <Section title="5. Por que entramos em contato (consentimento)">
          <p className={P}>
            <span className={STRONG}>Só entramos em contato com pessoas que nos forneceram suas informações e concordaram em ser contatadas.</span>{" "}
            Ao inserir seu e-mail ou telefone em um de nossos formulários, você está nos pedindo para retornar sobre sua
            solicitação. Você pode pedir que paremos de contatá-lo a qualquer momento (ver Seção 8).
          </p>
        </Section>

        <Section title="6. Mensagens de texto (SMS)">
          <p className={P}>
            Só enviaremos mensagens de texto se você optar separadamente por recebê-las (por exemplo, marcando uma caixa
            de consentimento de SMS). O envio de SMS é regido por termos próprios, incluindo frequência de mensagens, o
            aviso de que podem incidir tarifas de mensagem e de dados, e como cancelar. Veja nossos{" "}
            <span className={STRONG}>Termos de SMS</span> em <span className={STRONG}>jifwc.com/sms-terms</span>.
          </p>
          <p className={`${P} mt-4`}>
            Você pode <span className={STRONG}>responder STOP a qualquer momento para cancelar</span> as mensagens de
            texto, ou responder HELP para ajuda. O consentimento para receber mensagens de texto nunca é condição para
            receber nossos serviços. (Observação: em eventos públicos coletamos apenas e-mail; o SMS é uma etapa separada
            e futura, e exige consentimento próprio.)
          </p>
        </Section>

        <Section title="7. Como compartilhamos informações">
          <p className={`${P} mb-4`}>
            <span className={STRONG}>Não vendemos suas informações pessoais e não as compartilhamos para publicidade em troca de dinheiro.</span>
          </p>
          <p className={`${P} mb-4`}>
            Compartilhamos informações apenas com prestadores de serviço confiáveis que nos ajudam a operar, e somente na
            medida necessária para prestar nossos serviços. Atualmente incluem:
          </p>
          <Bullets
            items={[
              <><span className={STRONG}>Twilio</span> &mdash; para enviar mensagens e comunicações;</>,
              <><span className={STRONG}>Supabase</span> &mdash; hospedagem de banco de dados;</>,
              <><span className={STRONG}>Vercel</span> &mdash; hospedagem do site.</>,
            ]}
          />
          <p className={`${P} mt-4`}>
            Esses prestadores estão vinculados a acordos que limitam como podem usar suas informações, incluindo um
            Acordo de Associado de Negócios (BAA) quando aplicável a informações de saúde protegidas.
          </p>
          <p className={`${P} mt-4`}>
            Também podemos divulgar informações quando exigido por lei, para proteger nossos direitos ou a segurança, ou
            em conexão com uma transferência de negócios.
          </p>
        </Section>

        <Section title="8. Suas escolhas e direitos">
          <p className={`${P} mb-4`}>Você pode:</p>
          <Bullets
            items={[
              <><span className={STRONG}>acessar</span> as informações pessoais que mantemos sobre você;</>,
              <><span className={STRONG}>corrigir</span> informações imprecisas;</>,
              <><span className={STRONG}>excluir</span> suas informações pessoais;</>,
              <><span className={STRONG}>descadastrar-se (opt-out)</span> de nossas comunicações (e-mail ou SMS).</>,
            ]}
          />
          <p className={`${P} mt-4`}>
            Para fazer uma solicitação, escreva para <Mail />. Responderemos em prazo razoável e conforme a legislação
            aplicável.
          </p>
        </Section>

        <Section title="9. Informações de saúde e HIPAA">
          <p className={P}>
            As informações coletadas do público geral em um evento ou por formulário do site &mdash; antes de você se
            tornar paciente &mdash; <span className={STRONG}>não</span> são informações de saúde protegidas (PHI) sob a
            HIPAA.
          </p>
          <p className={`${P} mt-4`}>
            <span className={STRONG}>Quando você se torna paciente da nossa clínica,</span> as informações de saúde que
            coletamos para prestar seu atendimento são tratadas de acordo com a legislação aplicável, incluindo a HIPAA
            quando cabível. Como paciente, você recebe um <span className={STRONG}>Aviso de Práticas de Privacidade</span>{" "}
            separado, que descreve seus direitos sobre seus registros de saúde.
          </p>
        </Section>

        <Section title="10. Segurança e retenção de dados">
          <p className={P}>
            Usamos salvaguardas administrativas, técnicas e físicas razoáveis para proteger suas informações. Nenhum
            método de transmissão ou armazenamento é 100% seguro, portanto não podemos garantir segurança absoluta.
          </p>
          <p className={`${P} mt-4`}>
            Mantemos suas informações apenas pelo tempo necessário para as finalidades descritas nesta Política, ou
            conforme exigido por lei, após o que as excluímos ou anonimizamos. Em geral, mantemos as informações de leads
            e pré-pacientes de eventos por até 24 meses, ou até você pedir a exclusão. Os prontuários de pacientes são
            mantidos pelo prazo exigido pela lei da Flórida.
          </p>
        </Section>

        <Section title="11. Menores">
          <p className={P}>
            Nossos serviços e formulários destinam-se a pessoas com <span className={STRONG}>18 anos ou mais</span>, ou a
            menores com o consentimento e a participação de um pai ou responsável legal. Não coletamos, de forma
            consciente, informações de crianças sem o consentimento adequado.
          </p>
        </Section>

        <Section title="12. Alterações nesta Política">
          <p className={P}>
            Podemos atualizar esta Política periodicamente. Quando o fizermos, alteraremos a data de &ldquo;Última
            atualização&rdquo; acima e, se as mudanças forem significativas, forneceremos aviso adicional quando
            apropriado. O uso continuado dos nossos serviços após uma atualização significa que você aceita a Política
            revisada.
          </p>
        </Section>

        <Section title="13. Fale conosco">
          <p className={`${P} mb-4`}>Se tiver dúvidas sobre esta Política ou suas informações, contate:</p>
          <p className={P}>
            <span className={STRONG}>Moreira &amp; Angeli LLC (Integrative &amp; Functional Wellness Center / IFWC)</span>
            <br />
            Orlando, Flórida, EUA
            <br />
            E-mail: <Mail />
            <br />
            Site: jifwc.com
          </p>
        </Section>
      </div>
    </>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F1A2E] font-sans">
      <Navbar />

      <main className="max-w-[800px] mx-auto px-6 py-14">
        <section id="en" className="scroll-mt-20">
          <PolicyEnglish />
        </section>

        <hr className="my-16 border-[#0F1A2E]/10" />

        <section id="pt" className="scroll-mt-20">
          <PolicyPortugues />
        </section>
      </main>

      <Footer />
    </div>
  );
}
