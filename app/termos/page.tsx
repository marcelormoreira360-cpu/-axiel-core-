import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Termos de Uso — AXIEL Core",
  description:
    "Leia os Termos de Uso do AXIEL Core, a plataforma SaaS de gestao clinica para profissionais de saude integrativa.",
};

async function Navbar() {
  const t = await getTranslations("legal.nav");
  return (
    <header className="border-b border-[#0F1A2E]/10 bg-[#FAFAF8]/90 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-[800px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-[13px] font-semibold tracking-widest text-[#0F1A2E] uppercase">{t("brand")}</Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-[13px] text-[#0F1A2E]/55 hover:text-[#0F6E56] transition-colors">{t("back")}</Link>
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
          <Link href="/privacidade" className="text-[12px] text-[#0F1A2E]/50 hover:text-[#0F6E56] transition-colors">{t("privacy")}</Link>
          <Link href="/termos" className="text-[12px] text-[#0F6E56]">{t("terms")}</Link>
        </div>
      </div>
    </footer>
  );
}

const H2 = "text-[18px] font-semibold text-[#0F1A2E] mb-4";
const P = "text-[14px] leading-relaxed text-[#0F1A2E]/75";
const BULLET = <span className="text-[#0F6E56] mt-[3px] shrink-0 text-[10px]">&#9632;</span>;

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className={`space-y-2 ${P} mb-4`}>
      {items.map((item) => (
        <li key={item} className="flex gap-2 items-start">{BULLET}{item}</li>
      ))}
    </ul>
  );
}

export default async function TermosPage() {
  const t = await getTranslations("legal.terms");
  const s3Plans = t.raw("s3Plans") as { name: string; price: string; desc: string }[];

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
          <section><h2 className={H2}>{t("s1Title")}</h2><p className={P}>{t("s1Body")}</p></section>

          {/* 2 */}
          <section>
            <h2 className={H2}>{t("s2Title")}</h2>
            <p className={`${P} mb-4`}>{t("s2P1")}</p>
            <p className={`${P} mb-4`}>{t("s2P2")}</p>
            <p className={P}>{t("s2P3")}</p>
          </section>

          {/* 3 */}
          <section>
            <h2 className={H2}>{t("s3Title")}</h2>
            <p className={`${P} mb-5`}>{t("s3Intro")}</p>
            <div className="space-y-4 mb-5">
              {s3Plans.map((plan) => (
                <div key={plan.name} className="flex gap-4 items-start">
                  <div className="shrink-0 w-32">
                    <span className="text-[13px] font-semibold text-[#0F1A2E]">{plan.name}</span><br />
                    <span className="text-[12px] font-medium text-[#0F6E56]">{plan.price}</span>
                  </div>
                  <p className={P}>{plan.desc}</p>
                </div>
              ))}
            </div>
            <p className={`${P} mb-3`}>{t("s3P1")}</p>
            <p className={`${P} mb-3`}>{t("s3P2")}</p>
            <p className={P}>{t("s3P3")}</p>
          </section>

          {/* 4 */}
          <section>
            <h2 className={H2}>{t("s4Title")}</h2>
            <p className={`${P} mb-4`}>{t("s4Intro")}</p>
            <Bullets items={t.raw("s4Items") as string[]} />
            <p className={P}>{t("s4Outro")}</p>
          </section>

          {/* 5 */}
          <section>
            <h2 className={H2}>{t("s5Title")}</h2>
            <p className={`${P} mb-3`}>{t("s5P1")}</p>
            <p className={P}>{t("s5P2")}</p>
          </section>

          {/* 6 */}
          <section>
            <h2 className={H2}>{t("s6Title")}</h2>
            <p className={`${P} mb-4`}>{t("s6Intro")}</p>
            <Bullets items={t.raw("s6Items") as string[]} />
            <p className={P}>{t("s6Outro")}</p>
          </section>

          {/* 7 */}
          <section>
            <h2 className={H2}>{t("s7Title")}</h2>
            <p className={`${P} mb-3`}>{t("s7Intro")}</p>
            <Bullets items={t.raw("s7Items") as string[]} />
          </section>

          {/* 8 */}
          <section>
            <h2 className={H2}>{t("s8Title")}</h2>
            <p className={`${P} mb-3`}>{t("s8P1")}</p>
            <p className={`${P} mb-3`}>{t("s8P2")}</p>
            <Bullets items={t.raw("s8Items") as string[]} />
            <p className={P}>
              {t.rich("s8Outro", { a: (c) => <Link href="/privacidade" className="text-[#0F6E56] hover:underline">{c}</Link> })}
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className={H2}>{t("s9Title")}</h2>
            <p className={`${P} mb-3`}>{t("s9Intro")}</p>
            <Bullets items={t.raw("s9Items") as string[]} />
            <p className={P}>{t("s9Outro")}</p>
          </section>

          {/* 10 */}
          <section>
            <h2 className={H2}>{t("s10Title")}</h2>
            <p className={`${P} mb-3`}>{t("s10P1")}</p>
            <p className={`${P} mb-3`}>{t("s10P2")}</p>
            <p className={P}>{t("s10P3")}</p>
          </section>

          {/* 11 */}
          <section>
            <h2 className={H2}>{t("s11Title")}</h2>
            <p className={`${P} mb-3`}>{t("s11Intro")}</p>
            <Bullets items={t.raw("s11Items") as string[]} />
            <p className={P}>{t("s11Outro")}</p>
          </section>

          {/* 12 */}
          <section>
            <h2 className={H2}>{t("s12Title")}</h2>
            <p className={`${P} mb-3`}>{t("s12Intro")}</p>
            <Bullets items={t.raw("s12Items") as string[]} />
            <p className={P}>{t("s12Outro")}</p>
          </section>

          {/* 13 */}
          <section>
            <h2 className={H2}>{t("s13Title")}</h2>
            <p className={`${P} mb-4`}>{t("s13P1")}</p>
            <p className={`${P} mb-4`}>{t("s13P2")}</p>
            <Bullets items={t.raw("s13Items") as string[]} />
            <p className={P}>{t("s13Outro")}</p>
          </section>

          {/* 14 */}
          <section>
            <h2 className={H2}>{t("s14Title")}</h2>
            <p className={`${P} mb-3`}>{t("s14Intro")}</p>
            <Bullets items={t.raw("s14Items") as string[]} />
            <p className={P}>{t("s14Outro")}</p>
          </section>

          {/* 15 */}
          <section><h2 className={H2}>{t("s15Title")}</h2><p className={P}>{t("s15Body")}</p></section>
          {/* 16 */}
          <section><h2 className={H2}>{t("s16Title")}</h2><p className={P}>{t("s16Body")}</p></section>
          {/* 17 */}
          <section><h2 className={H2}>{t("s17Title")}</h2><p className={P}>{t("s17Body")}</p></section>
        </div>

        {/* Contact CTA */}
        <div className="mt-14 p-6 border border-[#0F6E56]/20 rounded-xl bg-[#0F6E56]/[0.04]">
          <p className="text-[14px] font-semibold text-[#0F1A2E] mb-1">{t("ctaTitle")}</p>
          <p className="text-[14px] leading-relaxed text-[#0F1A2E]/65">
            {t.rich("ctaBody", {
              mail: (c) => <a href="mailto:contato@axielcore.com" className="text-[#0F6E56] hover:underline font-medium">{c}</a>,
              privacy: (c) => <Link href="/privacidade" className="text-[#0F6E56] hover:underline font-medium">{c}</Link>,
            })}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
