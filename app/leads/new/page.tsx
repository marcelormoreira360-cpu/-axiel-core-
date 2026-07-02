import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { createLeadAction } from "./actions";
import { getTranslations } from "next-intl/server";

export default async function NewLeadPage() {
  const t = await getTranslations("leads.new");
  return (
    <Shell>
      <SimplePageHeader eyebrow={t("eyebrow")} title={t("title")} helper={t("helper")} />
      <Card className="max-w-2xl p-6">
        <form action={createLeadAction} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">{t("fullName")}
            <input name="full_name" required className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30" placeholder={t("fullNamePlaceholder")} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">{t("email")}
              <input name="email" type="email" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30" placeholder={t("emailPlaceholder")} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">{t("phone")}
              <input name="phone" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30" placeholder={t("phonePlaceholder")} />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">{t("mainComplaint")}
            <input name="main_complaint" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30" placeholder={t("mainComplaintPlaceholder")} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">{t("source")}
            <select name="source" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30">
              <option value="instagram">{t("sourceOptions.instagram")}</option>
              <option value="google">{t("sourceOptions.google")}</option>
              <option value="facebook">{t("sourceOptions.facebook")}</option>
              <option value="website">{t("sourceOptions.website")}</option>
              <option value="referral">{t("sourceOptions.referral")}</option>
              <option value="other">{t("sourceOptions.other")}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">{t("notes")}
            <textarea name="notes" rows={4} className="rounded-2xl border border-axiel-line bg-white p-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30" placeholder={t("notesPlaceholder")} />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <button className="min-h-14 rounded-lg bg-axiel-blue px-7 text-base font-semibold text-white shadow-md" type="submit">{t("save")}</button>
            <Link href="/leads" className="inline-flex min-h-14 items-center rounded-lg border border-axiel-line bg-white px-7 text-base font-semibold">{t("cancel")}</Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
