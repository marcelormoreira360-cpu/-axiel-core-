import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: `${t("title")} | AXIEL Core` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; email?: string; next?: string }>;
}) {
  const { invite, email, next } = await searchParams;
  const t = await getTranslations("auth.login");
  const tAuth = await getTranslations("auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff_0,#fbfaf7_48%,#f1eee8_100%)] px-6">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">{tAuth("brand")}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm leading-6 text-black/55">
            {invite ? t("subtitleInvite") : t("subtitle")}
          </p>
          <LoginForm inviteToken={invite} prefillEmail={email} redirectTo={next} />
        </Card>
        <p className="text-center text-xs text-black/30">
          {t("noAccount")}{" "}
          <a
            href={invite ? `/auth/signup?invite=${invite}${email ? `&email=${encodeURIComponent(email)}` : ""}` : "/auth/signup"}
            className="text-axiel-ink font-medium hover:underline transition"
          >
            {t("createAccount")}
          </a>
        </p>
        <p className="text-center text-xs text-black/30">
          {t("terms")}{" "}
          <a href="/termos" className="underline hover:text-black/50 transition" target="_blank" rel="noopener noreferrer">{t("termsOfUse")}</a>
          {" "}{t("and")}{" "}
          <a href="/privacidade" className="underline hover:text-black/50 transition" target="_blank" rel="noopener noreferrer">{t("privacyPolicy")}</a>.
        </p>
      </div>
    </main>
  );
}
