"use server";

import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimitDb } from "@/lib/webhook-guard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UF_RE = /^[A-Za-zÀ-ÿ\s]{2,40}$/;

function clean(v: FormDataEntryValue | null, max = 200): string {
  return ((v as string) ?? "").trim().slice(0, max);
}

async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : (h.get("x-real-ip") ?? null);
  const ua = h.get("user-agent");
  return { ip: ip || null, ua: ua ? ua.slice(0, 300) : null };
}

export async function submitSelfRegistrationAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const clinicId = clean(formData.get("clinic_id"), 64);
  if (!clinicId) return { error: "Clínica inválida." };

  // Rate limit: 30 auto-cadastros por clínica por hora
  if (!(await checkRateLimitDb(`self-register:${clinicId}`, 30, 60 * 60_000))) {
    return { error: "Muitas solicitações. Tente novamente em alguns minutos." };
  }

  const fullName = clean(formData.get("full_name"), 120);
  const email = clean(formData.get("email"), 160).toLowerCase();
  const phoneRaw = clean(formData.get("phone"), 40);
  const cpf = clean(formData.get("cpf"), 20) || null;
  const dob = clean(formData.get("date_of_birth"), 10) || null;
  const sex = clean(formData.get("sex"), 40) || null;
  const weightRaw = clean(formData.get("weight_kg"), 10).replace(",", ".");
  const heightRaw = clean(formData.get("height_cm"), 10).replace(",", ".");
  const weight_kg = weightRaw && Number.isFinite(Number(weightRaw)) ? Number(weightRaw) : null;
  const height_cm = heightRaw && Number.isFinite(Number(heightRaw)) ? Number(heightRaw) : null;

  const addressLine = clean(formData.get("address_line"), 200) || null;
  const neighborhood = clean(formData.get("neighborhood"), 120) || null;
  const city = clean(formData.get("city"), 120) || null;
  const state = clean(formData.get("state"), 40) || null;
  const zipCode = clean(formData.get("zip_code"), 20) || null;
  const country = clean(formData.get("country"), 60) || "Brasil";

  // Consentimentos
  const consentData = formData.get("consent_data") === "on";
  const consentAnalytics = formData.get("consent_analytics") === "on";
  const consentWhatsapp = formData.get("consent_whatsapp") === "on";
  const consentSms = formData.get("consent_sms") === "on";

  // ── Validação ──
  if (!fullName) return { error: "Informe seu nome completo." };
  if (!email || !EMAIL_RE.test(email)) return { error: "E-mail inválido." };
  if (state && !UF_RE.test(state)) return { error: "Estado inválido." };
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: "Data de nascimento inválida." };
  if (!consentData) {
    return { error: "É necessário aceitar o tratamento dos seus dados para concluir o cadastro." };
  }

  const phone = phoneRaw ? phoneRaw.replace(/\D/g, "") || phoneRaw : null;
  // Opt-in de SMS (TCPA) exige um telefone.
  if (consentSms && !phone) {
    return { error: "Informe um telefone para receber mensagens SMS." };
  }
  const supabase = createSupabaseAdminClient();

  // ── Find-or-create (dedup por e-mail e, se houver, telefone) ──
  let patientId: string;
  let existing: { id: string } | null = null;
  {
    const { data } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("email", email)
      .maybeSingle();
    existing = data ?? null;
  }
  if (!existing && phone) {
    const { data } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    existing = data ?? null;
  }

  // Idioma escolhido na página pública (cookie AXIEL_LOCALE) vira o locale do paciente
  const { cookies } = await import("next/headers");
  const rawLocale = (await cookies()).get("AXIEL_LOCALE")?.value;
  const patientLocale = rawLocale === "pt-BR" || rawLocale === "en" || rawLocale === "pt-PT" ? rawLocale : null;

  const addressFields = {
    full_name: fullName,
    email,
    phone,
    ...(patientLocale ? { locale: patientLocale } : {}),
    cpf,
    date_of_birth: dob,
    sex,
    weight_kg,
    height_cm,
    address_line: addressLine,
    neighborhood,
    city,
    state,
    zip_code: zipCode,
    country,
  };

  if (existing) {
    patientId = existing.id;
    // Atualiza/enriquece o registro existente com o que o paciente preencheu
    const { error } = await supabase
      .from("patients")
      .update({ ...addressFields, status: "active", updated_at: new Date().toISOString() })
      .eq("id", patientId)
      .eq("clinic_id", clinicId);
    if (error) return { error: "Erro ao atualizar seus dados. Tente novamente." };
  } else {
    const { data: created, error } = await supabase
      .from("patients")
      .insert({ clinic_id: clinicId, status: "active", ...addressFields })
      .select("id")
      .single();
    if (error || !created) return { error: "Erro ao concluir o cadastro. Tente novamente." };
    patientId = created.id;
  }

  // ── Consentimentos (LGPD) ──
  const { ip, ua } = await clientMeta();
  const consentRows = [
    {
      clinic_id: clinicId,
      patient_id: patientId,
      consent_type: "data_processing",
      granted: true,
      ip_address: ip,
      user_agent: ua,
      source: "onboarding",
    },
    {
      clinic_id: clinicId,
      patient_id: patientId,
      consent_type: "analytics_anonymized",
      granted: consentAnalytics,
      ip_address: ip,
      user_agent: ua,
      source: "onboarding",
    },
  ];
  // Opt-in por canal (ver services/channel-consent-service): grava só o que foi
  // marcado, como prova de opt-in (TCPA/HIPAA). consent_type = channel_<canal>.
  const channelConsentRows = [
    consentWhatsapp ? "channel_whatsapp" : null,
    consentSms ? "channel_sms" : null,
  ]
    .filter((t): t is string => t !== null)
    .map((consent_type) => ({
      clinic_id: clinicId,
      patient_id: patientId,
      consent_type,
      granted: true,
      ip_address: ip,
      user_agent: ua,
      source: "onboarding",
    }));

  // Best-effort: cadastro não deve falhar se o log de consentimento falhar
  await supabase.from("patient_consents").insert([...consentRows, ...channelConsentRows]);

  return { success: true };
}
