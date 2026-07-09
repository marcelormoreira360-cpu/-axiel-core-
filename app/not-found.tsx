import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("nav.notFoundPage");
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <p className="text-sm font-medium text-slate-500">{t("brand")}</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">{t("title")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {t("text")}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-axiel-blue px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-axiel-blueDark"
        >
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}
