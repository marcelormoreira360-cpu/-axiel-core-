import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink, Link2, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { CopyPortalLinkCard } from "@/components/copy-portal-link-card";
import { getPatientById } from "@/services/patient-service";
import { getRecentPatientPortalLinks } from "@/services/patient-portal-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { createPatientPortalLinkAction, regeneratePatientPortalLinkAction, revokePatientPortalLinkAction } from "@/app/patients/[id]/portal-link/actions";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

async function getBaseUrl() {
  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return `${protocol}://${host}`;
}

export default async function PatientPortalLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations("portal.link");
  const { id } = await params;
  const { token } = await searchParams;
  const clinic = await getCurrentClinic();
  const patient = await getPatientById(id, clinic?.id); // A-06
  if (!patient) notFound();

  const [baseUrl, recentLinks] = await Promise.all([getBaseUrl(), getRecentPatientPortalLinks(id)]);
  const portalUrl = token ? `${baseUrl}/p/${token}` : null;
  const createAction = createPatientPortalLinkAction.bind(null, id);
  const regenerateAction = regeneratePatientPortalLinkAction.bind(null, id);

  return (
    <Shell>
      <BackLink fallbackHref={`/patients/${patient.id}`} className="mb-6 inline-flex items-center gap-2 rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/60 shadow-sm transition hover:bg-axiel-blueSoft dark:hover:bg-[#0F6E56]/[.12]">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </BackLink>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-7">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-axiel-ink text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-3 text-sm leading-6 text-black/50">
            {t("description", { name: patient.full_name })}
          </p>

          <div className="mt-6 grid gap-3">
            <form action={createAction}>
              <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-axiel-blue px-6 text-base font-semibold text-white shadow-md transition hover:bg-axiel-blueDark">
                <Link2 className="h-5 w-5" /> {t("create")}
              </button>
            </form>
            <form action={regenerateAction}>
              <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-axiel-line bg-white px-6 text-sm font-semibold text-black/65 shadow-sm transition hover:border border-axiel-line bg-white">
                {t("regenerate")}
              </button>
            </form>
          </div>
          <p className="mt-4 text-xs leading-5 text-black/40">
            {t("regenerateHint")}
          </p>
        </Card>

        <div className="grid gap-4">
          {portalUrl ? <CopyPortalLinkCard url={portalUrl} /> : null}

          <Card className="p-6">
            <p className="text-sm font-semibold text-black/40">{t("recent")}</p>
            <div className="mt-4 grid gap-3">
              {recentLinks.length ? (
                recentLinks.map((link) => {
                  const revokeAction = revokePatientPortalLinkAction.bind(null, patient.id, link.id);
                  const isActive = !link.revoked_at && new Date(link.expires_at).getTime() > Date.now();

                  return (
                    <div key={link.id} className="rounded-[1.5rem] bg-axiel-soft dark:bg-white/[.04] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-black/75 dark:text-white/75">{t("expires", { date: formatDate(link.expires_at) })}</p>
                          <p className="mt-1 text-xs text-black/40">
                            {link.revoked_at ? t("revoked") : link.last_viewed_at ? t("viewedAt", { date: formatDate(link.last_viewed_at) }) : t("notViewed")}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-black/25" />
                      </div>
                      {isActive ? (
                        <form action={revokeAction} className="mt-3">
                          <button className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black/55 transition hover:bg-black/5 dark:hover:bg-white/5">
                            {t("revoke")}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-[1.5rem] bg-axiel-soft dark:bg-white/[.04] p-4 text-sm text-black/45">{t("empty")}</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
