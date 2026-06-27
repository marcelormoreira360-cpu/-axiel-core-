import Link from "next/link";
import { BackLink } from "@/components/back-link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Politica de Privacidade — AXIEL Core",
  description:
    "Saiba como o AXIEL Core coleta, usa, armazena e protege os seus dados e os dados dos seus pacientes, em conformidade com a LGPD (Lei n. 13.709/2018).",
};

const MAIL = "privacidade@axielcore.com";

async function Navbar() {
  const t = await getTranslations("legal.nav");
  return (
    <header className="border-b border-[#0F1A2E]/10 bg-[#FAFAF8]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-[800px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-[13px] font-semibold tracking-widest text-[#0F1A2E] uppercase">
          {t("brand")}
        </Link>
        <div className="flex items-center gap-6">
          <BackLink fallbackHref="/" className="text-[13px] text-[#0F1A2E]/55 hover:text-[#0F6E56] transition-colors">{t("back")}</BackLink>
          <Link href="/auth/login" className="text-[13px] text-[#0F1A2E]/55 hover:text-[#0F6E56] transition-colors">{t("login")}</Link>
        </div>
      </div>
    </header>
  );
}

async function Footer() {
  const t = await getTranslations("legal.footer");
  return (
    <footer className="border-t border-[#0F1A2E]/10 bg-[#FAFAF8]">
      <div className="max-w-[800px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[12px] text-[#0F1A2E]/40">{t("rights")}</p>
        <div className="flex items-center gap-5">
          <Link href="/privacidade" className="text-[12px] text-[#0F6E56]">{t("privacy")}</Link>
          <Link href="/termos" className="text-[12px] text-[#0F1A2E]/50 hover:text-[#0F6E56] transition-colors">{t("terms")}</Link>
        </div>
      </div>
    </footer>
  );
}

function MailLink({ className = "text-[#0F6E56] hover:underline" }: { className?: string }) {
  return <a href={`mailto:${MAIL}`} className={className}>{MAIL}</a>;
}

const H2 = "text-[18px] font-semibold text-[#0F1A2E] mb-4";
const P = "text-[14px] leading-relaxed text-[#0F1A2E]/75";
const BULLET = <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>;

export default async function PrivacidadePage() {
  const t = await getTranslations("legal.privacy");
  const s2 = t.raw("s2Items") as { title: string; desc: string }[];
  const s3 = t.raw("s3Items") as { label: string; desc: string }[];
  const s4 = t.raw("s4Items") as string[];
  const s5 = t.raw("s5Items") as { name: string; desc: string }[];
  const s7 = t.raw("s7Items") as { title: string; desc: string }[];
  const s8 = t.raw("s8Items") as { title: string; desc: string }[];
  const s9 = t.raw("s9Items") as string[];

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F1A2E] font-sans">
      <Navbar />

      <main className="max-w-[800px] mx-auto px-6 py-14">
        <div className="mb-12">
          <p className="text-[12px] font-medium tracking-widest text-[#0F6E56] uppercase mb-3">{t("eyebrow")}</p>
          <h1 className="text-[28px] font-semibold text-[#0F1A2E] leading-tight mb-4">{t("title")}</h1>
          <p className="text-[14px] text-[#0F1A2E]/55 leading-relaxed">{t("validity")}</p>
        </div>

        <p className="text-[14px] leading-relaxed text-[#0F1A2E]/75 mb-12">{t("intro")}</p>

        <div className="space-y-12">
          {/* 1 */}
          <section>
            <h2 className={H2}>{t("s1Title")}</h2>
            <p className={P}>{t("s1Body")} <MailLink />.</p>
          </section>

          {/* 2 */}
          <section>
            <h2 className={H2}>{t("s2Title")}</h2>
            <p className={`${P} mb-5`}>{t("s2Intro")}</p>
            <div className="space-y-5">
              {s2.map((item) => (
                <div key={item.title}>
                  <p className="text-[14px] font-semibold text-[#0F1A2E] mb-2">{item.title}</p>
                  <p className={P}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className={H2}>{t("s3Title")}</h2>
            <p className={`${P} mb-5`}>{t("s3Intro")}</p>
            <div className="space-y-4">
              {s3.map((item) => (
                <div key={item.label} className="pl-4 border-l-2 border-[#0F6E56]/25">
                  <p className={P}>
                    <span className="font-semibold text-[#0F1A2E]">{item.label}:</span> {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className={H2}>{t("s4Title")}</h2>
            <p className={`${P} mb-4`}>{t("s4Intro")}</p>
            <ul className={`space-y-2 ${P}`}>
              {s4.map((item) => (
                <li key={item} className="flex gap-2 items-start">{BULLET}{item}</li>
              ))}
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className={H2}>{t("s5Title")}</h2>
            <p className={`${P} mb-5`}>{t("s5Intro")}</p>
            <div className="space-y-4">
              {s5.map((item) => (
                <div key={item.name} className="flex gap-4 items-start">
                  <span className="text-[12px] font-semibold text-[#0F6E56] uppercase tracking-wider mt-[2px] shrink-0 w-28">{item.name}</span>
                  <p className={P}>{item.desc}</p>
                </div>
              ))}
            </div>
            <p className={`${P} mt-5`}>{t("s5Outro")}</p>
          </section>

          {/* 6 */}
          <section>
            <h2 className={H2}>{t("s6Title")}</h2>
            <p className={P}>{t("s6Body")}</p>
          </section>

          {/* 7 */}
          <section>
            <h2 className={H2}>{t("s7Title")}</h2>
            <p className={`${P} mb-4`}>{t("s7Intro")}</p>
            <ul className={`space-y-3 ${P}`}>
              {s7.map((item) => (
                <li key={item.title} className="flex gap-2 items-start">
                  {BULLET}
                  <span><span className="font-semibold text-[#0F1A2E]">{item.title}:</span> {item.desc}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className={H2}>{t("s8Title")}</h2>
            <p className={`${P} mb-5`}>{t("s8Intro")} <MailLink />:</p>
            <div className="space-y-3">
              {s8.map((item) => (
                <div key={item.title} className="flex gap-2 items-start">
                  {BULLET}
                  <p className={P}>
                    <span className="font-semibold text-[#0F1A2E]">{item.title}:</span> {item.desc}
                  </p>
                </div>
              ))}
            </div>
            <p className={`${P} mt-5`}>{t("s8Outro")}</p>
          </section>

          {/* 9 */}
          <section>
            <h2 className={H2}>{t("s9Title")}</h2>
            <p className={`${P} mb-4`}>{t("s9Intro")}</p>
            <ul className={`space-y-2 ${P}`}>
              {s9.map((item) => (
                <li key={item} className="flex gap-2 items-start">{BULLET}{item}</li>
              ))}
            </ul>
          </section>

          {/* 10–17 (prose) */}
          <section><h2 className={H2}>{t("s10Title")}</h2><p className={P}>{t("s10Body")}</p></section>
          <section><h2 className={H2}>{t("s11Title")}</h2><p className={P}>{t("s11Body")}</p></section>
          <section><h2 className={H2}>{t("s12Title")}</h2><p className={P}>{t("s12Body")}</p></section>
          <section><h2 className={H2}>{t("s13Title")}</h2><p className={P}>{t("s13Body")}</p></section>
          <section><h2 className={H2}>{t("s14Title")}</h2><p className={P}>{t("s14Body")}</p></section>
          <section><h2 className={H2}>{t("s15Title")}</h2><p className={P}>{t("s15Body")} <MailLink />.</p></section>
          <section><h2 className={H2}>{t("s16Title")}</h2><p className={P}>{t("s16Body")}</p></section>
          <section><h2 className={H2}>{t("s17Title")}</h2><p className={P}>{t("s17Body")}</p></section>
        </div>

        {/* Contact CTA */}
        <div className="mt-14 p-6 border border-[#0F6E56]/20 rounded-xl bg-[#0F6E56]/[0.04]">
          <p className="text-[14px] font-semibold text-[#0F1A2E] mb-1">{t("ctaTitle")}</p>
          <p className="text-[14px] leading-relaxed text-[#0F1A2E]/65">
            {t("ctaBody")} <MailLink className="text-[#0F6E56] hover:underline font-medium" />
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
