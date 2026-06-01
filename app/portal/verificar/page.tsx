import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Verifique seu e-mail | Portal do Paciente",
  robots: { index: false, follow: false },
};

export default async function PortalVerificarPage() {
  const t = await getTranslations("portal.verificar");
  return (
    <main className="min-h-screen bg-[#F8FAF9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F0FAF5]">
          <svg
            className="h-8 w-8 text-[#0F6E56]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>

        <div className="bg-white rounded-2xl border border-black/[.07] p-8 space-y-3">
          <h1 className="text-xl font-semibold tracking-tight text-[#0F1A2E]">
            {t("title")}
          </h1>
          <p className="text-sm text-black/50 leading-relaxed">
            {t.rich("desc", { b: (c) => <strong className="text-[#0F1A2E]">{c}</strong> })}
          </p>
          <p className="text-xs text-black/35 pt-1">
            {t("dontShare")}
          </p>
        </div>

        <Link
          href="/portal"
          className="inline-block text-sm font-medium text-[#0F6E56] hover:underline"
        >
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
