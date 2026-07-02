export const dynamic = "force-dynamic";

import { Building2, Users, Brain, Dumbbell, Heart, Leaf, Sparkles, CheckCircle2, Palette, Phone, Mail, Globe, MapPin, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";
import { ClinicEditForm } from "@/components/clinic-edit-form";
import { getClinicsForUser, updateClinic, getCurrentClinic } from "@/services/clinic-service";
import { getUsersForCurrentScope } from "@/services/user-service";
import { roleLabels } from "@/modules/auth/roles";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import type { ClinicProfile } from "@/lib/types";

const PROFILES: {
  id: ClinicProfile;
  icon: React.ReactNode;
}[] = [
  { id: "integrativa", icon: <Leaf className="h-4 w-4" /> },
  { id: "fisioterapia", icon: <Dumbbell className="h-4 w-4" /> },
  { id: "saude_mental", icon: <Brain className="h-4 w-4" /> },
  { id: "nutricao", icon: <Heart className="h-4 w-4" /> },
  { id: "wellness", icon: <Sparkles className="h-4 w-4" /> },
];

export default async function ClinicsPage() {
  const t = await getTranslations("clinics");
  const [clinics, users, myClinic] = await Promise.all([
    getClinicsForUser().catch((e) => { console.error("[/clinics] getClinicsForUser error:", e?.message ?? e); return []; }),
    getUsersForCurrentScope().catch((e) => { console.error("[/clinics] getUsersForCurrentScope error:", e?.message ?? e); return []; }),
    getCurrentClinic().catch((e) => { console.error("[/clinics] getCurrentClinic error:", e?.message ?? e); return null; }),
  ]);

  const billingCtx = myClinic ? await getBillingContext(myClinic.id) : null;
  const canMultiClinic = billingCtx ? canUseFeature(billingCtx, "multi_clinic") : false;

  async function updateClinicAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    if (!id || !name || !slug) {
      const tAction = await getTranslations("clinics");
      throw new Error(tAction("errors.requiredFields"));
    }
    await updateClinic(id, { name, slug });
    revalidatePath("/clinics");
    revalidatePath("/settings");
  }

  async function updateClinicContactAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await updateClinic(id, {
      phone:         String(formData.get("phone")         ?? "").trim() || null,
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      website:       String(formData.get("website")       ?? "").trim() || null,
      address_line:  String(formData.get("address_line")  ?? "").trim() || null,
      city:          String(formData.get("city")          ?? "").trim() || null,
      state:         String(formData.get("state")         ?? "").trim() || null,
      cnpj:          String(formData.get("cnpj")          ?? "").trim() || null,
      description:   String(formData.get("description")   ?? "").trim() || null,
    });
    revalidatePath("/clinics");
  }

  async function updateClinicProfileAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const clinic_profile = String(formData.get("clinic_profile") ?? "");
    if (!id || !clinic_profile) return;
    await updateClinic(id, { clinic_profile });
    revalidatePath("/clinics");
    revalidatePath("/dashboard");
  }

  return (
    <Shell>
      <header className="mb-7">
        <BackLink
          fallbackHref="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("header.back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("header.eyebrow")}</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("header.title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("header.subtitle")}</p>
      </header>

      {/* ── Minha clínica — nome e slug ── */}
      {myClinic && (
        <div className="space-y-[14px]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
              {t("sections.nameUrl")}
            </p>
            <Card className="p-[16px]">
              <ClinicEditForm
                id={myClinic.id}
                name={myClinic.name}
                slug={myClinic.slug}
                updateAction={updateClinicAction}
              />
            </Card>
          </div>

          {/* ── Perfil da clínica ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
              {t("sections.practiceProfile")}
            </p>
            <Card className="p-[16px]">
              <p className="text-[13px] text-[#0F1A2E] font-medium mb-[4px]">{t("profileCard.title")}</p>
              <p className="text-[12px] text-[#A09E98] mb-[14px]">
                {t("profileCard.subtitle")}
              </p>
              <div className="grid gap-[8px] sm:grid-cols-2">
                {PROFILES.map((profile) => {
                  const isActive = (myClinic.clinic_profile ?? "integrativa") === profile.id;
                  return (
                    <form key={profile.id} action={updateClinicProfileAction}>
                      <input type="hidden" name="id" value={myClinic.id} />
                      <input type="hidden" name="clinic_profile" value={profile.id} />
                      <button
                        type="submit"
                        className={[
                          "w-full text-left rounded-[10px] border px-[14px] py-[12px] transition flex items-start gap-[10px]",
                          isActive
                            ? "border-[#0F6E56] bg-[#E1F5EE]"
                            : "border-black/[.07] bg-white hover:border-black/[.15] hover:bg-[#FAFAF8]",
                        ].join(" ")}
                      >
                        <div className={[
                          "w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0 mt-[1px]",
                          isActive ? "bg-[#0F6E56] text-white" : "bg-[#F4F3EF] text-[#6B6A66]",
                        ].join(" ")}>
                          {profile.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={[
                            "text-[12px] font-semibold",
                            isActive ? "text-[#085041]" : "text-[#0F1A2E]",
                          ].join(" ")}>
                            {t(`profiles.${profile.id}.label`)}
                          </p>
                          <p className={[
                            "text-[11px] mt-[1px] leading-relaxed",
                            isActive ? "text-[#0F6E56]" : "text-[#A09E98]",
                          ].join(" ")}>
                            {t(`profiles.${profile.id}.examples`)}
                          </p>
                        </div>
                        {isActive && (
                          <CheckCircle2 className="h-4 w-4 text-[#0F6E56] shrink-0 mt-[1px]" />
                        )}
                      </button>
                    </form>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ── Contato e localização ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
              {t("sections.contact")}
            </p>
            <Card className="p-[16px]">
              <p className="text-[12px] text-[#A09E98] mb-[14px]">
                {t("contact.subtitle")}
              </p>
              <form action={updateClinicContactAction} className="space-y-[12px]">
                <input type="hidden" name="id" value={myClinic.id} />

                {/* Descrição */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                    <FileText className="h-3 w-3" /> {t("contact.description")}
                  </label>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={myClinic.description ?? ""}
                    placeholder={t("contact.descriptionPlaceholder")}
                    className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] resize-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                  {/* Telefone */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                      <Phone className="h-3 w-3" /> {t("contact.phone")}
                    </label>
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={myClinic.phone ?? ""}
                      placeholder={t("contact.phonePlaceholder")}
                      className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                    />
                  </div>

                  {/* Email de contato */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                      <Mail className="h-3 w-3" /> {t("contact.email")}
                    </label>
                    <input
                      name="contact_email"
                      type="email"
                      defaultValue={myClinic.contact_email ?? ""}
                      placeholder={t("contact.emailPlaceholder")}
                      className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                    />
                  </div>

                  {/* Site */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                      <Globe className="h-3 w-3" /> {t("contact.website")}
                    </label>
                    <input
                      name="website"
                      type="url"
                      defaultValue={myClinic.website ?? ""}
                      placeholder={t("contact.websitePlaceholder")}
                      className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                    />
                  </div>

                  {/* CNPJ */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                      <FileText className="h-3 w-3" /> {t("contact.taxId")}
                    </label>
                    <input
                      name="cnpj"
                      defaultValue={myClinic.cnpj ?? ""}
                      placeholder={t("contact.taxIdPlaceholder")}
                      className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                    />
                  </div>

                  {/* Endereço */}
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                      <MapPin className="h-3 w-3" /> {t("contact.address")}
                    </label>
                    <input
                      name="address_line"
                      defaultValue={myClinic.address_line ?? ""}
                      placeholder={t("contact.addressPlaceholder")}
                      className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                    />
                  </div>

                  {/* Cidade */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("contact.city")}</label>
                    <input
                      name="city"
                      defaultValue={myClinic.city ?? ""}
                      placeholder={t("contact.cityPlaceholder")}
                      className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                    />
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("contact.state")}</label>
                    <input
                      name="state"
                      defaultValue={myClinic.state ?? ""}
                      placeholder={t("contact.statePlaceholder")}
                      maxLength={2}
                      className="w-full text-[13px] text-[#0F1A2E] border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition uppercase"
                    />
                  </div>
                </div>

                <div className="pt-[2px]">
                  <button
                    type="submit"
                    className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] px-[14px] py-[7px] rounded-[8px] transition"
                  >
                    {t("contact.save")}
                  </button>
                </div>
              </form>
            </Card>
          </div>

          {/* ── Identidade visual (atalho) ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
              {t("sections.branding")}
            </p>
            <Link href="/settings/branding">
              <Card className="p-[16px] flex items-center justify-between hover:border-black/[.15] transition group">
                <div className="flex items-center gap-3">
                  {myClinic.logo_url ? (
                    <Image src={myClinic.logo_url} alt={t("branding.logoAlt")} width={36} height={36} className="h-9 w-9 rounded-[8px] object-contain border border-black/[.07]" />
                  ) : (
                    <div className="h-9 w-9 rounded-[8px] border border-black/[.07] bg-[#F4F3EF] flex items-center justify-center">
                      <Palette className="h-4 w-4 text-[#A09E98]" />
                    </div>
                  )}
                  <div>
                    <p className="text-[13px] font-medium text-[#0F1A2E]">{t("branding.title")}</p>
                    <p className="text-[11px] text-[#A09E98] mt-[1px]">
                      {myClinic.primary_color
                        ? t("branding.activeColor", { color: myClinic.primary_color })
                        : t("branding.noColor")}
                      {myClinic.logo_url ? t("branding.logoUploaded") : t("branding.noLogo")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {myClinic.primary_color && (
                    <div
                      className="h-5 w-5 rounded-full border border-black/[.10]"
                      style={{ backgroundColor: myClinic.primary_color }}
                    />
                  )}
                  <span className="text-[12px] text-[#0F6E56] group-hover:underline">{t("branding.edit")}</span>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      )}

      {/* ── Outras clínicas (admins, plan: multi_clinic) ── */}
      {canMultiClinic && clinics.filter((c) => c.id !== myClinic?.id).length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
            {t("sections.otherClinics")}
          </p>
          <div className="grid gap-3">
            {clinics.filter((c) => c.id !== myClinic?.id).slice(0, 5).map((clinic) => (
              <Card key={clinic.id}>
                <h2 className="font-semibold text-[14px]">{clinic.name}</h2>
                <p className="mt-1 text-[12px] text-black/50">/{clinic.slug} · {clinic.status}</p>
              </Card>
            ))}
            {clinics.filter((c) => c.id !== myClinic?.id).length > 5 && (
              <LimitedList
                items={clinics.filter((c) => c.id !== myClinic?.id).slice(5)}
                detailsLabel={t("list.moreClinics", { count: clinics.length - 5 })}
                renderItem={(clinic) => (
                  <Card key={clinic.id}>
                    <h2 className="font-semibold text-[14px]">{clinic.name}</h2>
                    <p className="mt-1 text-[12px] text-black/50">/{clinic.slug} · {clinic.status}</p>
                  </Card>
                )}
              />
            )}
          </div>
        </div>
      )}

      {clinics.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title={t("emptyClinics.title")}
          text={t("emptyClinics.text")}
          href="/onboarding"
          action={t("emptyClinics.action")}
        />
      )}

      {/* ── Equipe ── */}
      <div className="mt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[8px]">
          {t("sections.team")}
        </p>
        <div className="grid gap-3">
          {users.slice(0, 5).map((user) => (
            <Card key={user.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-[#0F1A2E]">
                  {user.full_name || user.email || t("team.noName")}
                </p>
                <p className="mt-[2px] text-[12px] text-black/50">{user.email ?? t("team.noEmail")}</p>
              </div>
              <span className="rounded-full bg-[#F4F3EF] px-3 py-1 text-[11px] font-medium text-[#6B6A66]">
                {roleLabels[user.role]}
              </span>
            </Card>
          ))}
          {users.length > 5 && (
            <LimitedList
              items={users.slice(5)}
              detailsLabel={t("team.moreMembers", { count: users.length - 5 })}
              renderItem={(user) => (
                <Card key={user.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F1A2E]">
                      {user.full_name || user.email || t("team.noName")}
                    </p>
                    <p className="mt-[2px] text-[12px] text-black/50">{user.email ?? t("team.noEmail")}</p>
                  </div>
                  <span className="rounded-full bg-[#F4F3EF] px-3 py-1 text-[11px] font-medium text-[#6B6A66]">
                    {roleLabels[user.role]}
                  </span>
                </Card>
              )}
            />
          )}
          {users.length === 0 && (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title={t("team.emptyTitle")}
              text={t("team.emptyText")}
              href="/settings/equipe"
              action={t("team.emptyAction")}
            />
          )}
        </div>
      </div>
    </Shell>
  );
}
