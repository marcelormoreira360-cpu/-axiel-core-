import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("referral-service");

// Cookie onde o middleware guarda o ?ref= capturado na página de signup.
// Mantido aqui (server-only) e duplicado como literal no middleware (edge),
// que não pode importar este módulo (puxa supabase-admin/node:crypto).
export const REFERRAL_COOKIE = "AXIEL_REF";

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L) — códigos legíveis em voz alta.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export type ReferralStats = {
  code: string | null;
  signedUp: number;
  converted: number;
  rewarded: number;
};

function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Retorna o referral_code da clínica, gerando (e persistindo) um novo se
 * ainda não existir. Admin client — chamado de server components/actions
 * sempre com o clinicId da própria clínica autenticada.
 */
export async function getOrCreateReferralCode(clinicId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("referral_code")
    .eq("id", clinicId)
    .maybeSingle();

  if (!clinic) return null;
  if (clinic.referral_code) return clinic.referral_code as string;

  // Gera com retry em colisão (índice único em clinics.referral_code).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await supabase
      .from("clinics")
      .update({ referral_code: code })
      .eq("id", clinicId)
      .is("referral_code", null); // não sobrescreve se outra request já gerou

    if (!error) {
      // Pode ter sido um no-op (corrida com outra request) — relê o valor real.
      const { data: fresh } = await supabase
        .from("clinics")
        .select("referral_code")
        .eq("id", clinicId)
        .maybeSingle();
      return (fresh?.referral_code as string | null) ?? code;
    }
    // 23505 = unique_violation → colisão de código, tenta outro.
    if (error.code !== "23505") {
      log.error("getOrCreateReferralCode: falha ao gravar código", error, { clinic_id: clinicId });
      return null;
    }
  }

  log.error("getOrCreateReferralCode: esgotou tentativas de gerar código único", new Error("retry exhausted"), { clinic_id: clinicId });
  return null;
}

/**
 * Resolve um código de indicação para o clinic_id do indicador (ou null).
 */
export async function resolveReferralCode(code: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(normalized)) return null;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinics")
    .select("id")
    .eq("referral_code", normalized)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

/**
 * Registra o cadastro de uma clínica indicada. Idempotente — a constraint
 * unique em referred_clinic_id garante no máximo 1 indicação por clínica.
 */
export async function recordReferralSignup(
  referrerClinicId: string,
  referredClinicId: string,
): Promise<void> {
  if (!referrerClinicId || !referredClinicId || referrerClinicId === referredClinicId) return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("referral_conversions")
    .upsert(
      {
        referrer_clinic_id: referrerClinicId,
        referred_clinic_id: referredClinicId,
        status: "signed_up",
      },
      { onConflict: "referred_clinic_id", ignoreDuplicates: true },
    );

  if (error) {
    log.warn("recordReferralSignup: falha ao registrar indicação", {
      referrer_clinic_id: referrerClinicId,
      referred_clinic_id: referredClinicId,
      error: error.message,
    });
  }
}

/**
 * Marca a conversão quando a assinatura PAGA da clínica indicada fica ativa.
 * Idempotente: só transiciona signed_up → converted. Retorna a linha da
 * conversão (para o chamador recompensar o indicador) ou null.
 */
export async function markReferralConverted(referredClinicId: string): Promise<{
  id: string;
  referrer_clinic_id: string;
  status: string;
} | null> {
  const supabase = createSupabaseAdminClient();

  const { data: conversion } = await supabase
    .from("referral_conversions")
    .select("id, referrer_clinic_id, status")
    .eq("referred_clinic_id", referredClinicId)
    .maybeSingle();

  if (!conversion) return null;

  if (conversion.status === "signed_up") {
    const { error } = await supabase
      .from("referral_conversions")
      .update({ status: "converted", converted_at: new Date().toISOString() })
      .eq("id", conversion.id as string)
      .eq("status", "signed_up");
    if (error) {
      log.warn("markReferralConverted: falha ao marcar conversão", {
        referred_clinic_id: referredClinicId,
        error: error.message,
      });
      return conversion as { id: string; referrer_clinic_id: string; status: string };
    }
    return { ...(conversion as { id: string; referrer_clinic_id: string; status: string }), status: "converted" };
  }

  return conversion as { id: string; referrer_clinic_id: string; status: string };
}

/**
 * Recompensa o INDICADOR com 1 mês grátis: aplica o coupon
 * STRIPE_REFERRAL_COUPON_ID na assinatura Stripe ativa dele.
 *
 * ⚠️ Pré-requisito de configuração (fora do código):
 *   1. Criar no painel do Stripe um coupon de 100% off com duration "once"
 *      (= 1 fatura grátis para assinaturas).
 *   2. Setar o ID dele na env STRIPE_REFERRAL_COUPON_ID.
 * Sem a env, a conversão é marcada mas ninguém recebe desconto automático.
 *
 * Chamado pelo webhook do Stripe quando a assinatura da clínica indicada
 * vira ativa. Nunca lança — falha de recompensa só loga (recompensa manual).
 */
export async function processReferralConversion(referredClinicId: string): Promise<void> {
  try {
    const conversion = await markReferralConverted(referredClinicId);
    if (!conversion) return;            // clínica não foi indicada
    if (conversion.status === "rewarded") return; // já recompensado — idempotente

    const couponId = process.env.STRIPE_REFERRAL_COUPON_ID;
    if (!couponId) {
      log.warn("processReferralConversion: STRIPE_REFERRAL_COUPON_ID não configurado — recompensa manual necessária", {
        referred_clinic_id: referredClinicId,
        referrer_clinic_id: conversion.referrer_clinic_id,
      });
      return;
    }

    const supabase = createSupabaseAdminClient();
    const { data: referrerSub } = await supabase
      .from("subscriptions")
      .select("external_subscription_id, status")
      .eq("clinic_id", conversion.referrer_clinic_id)
      .maybeSingle();

    // Indicador só recebe o mês grátis se tiver assinatura Stripe ativa/trial.
    const rewardable =
      referrerSub?.external_subscription_id &&
      ["active", "trialing"].includes(referrerSub.status as string);

    if (!rewardable) {
      log.info("processReferralConversion: indicador sem assinatura ativa — recompensa adiada/manual", {
        referrer_clinic_id: conversion.referrer_clinic_id,
        referrer_status: referrerSub?.status ?? null,
      });
      return;
    }

    try {
      const { stripe } = await import("@/lib/stripe");
      await stripe.subscriptions.update(referrerSub!.external_subscription_id as string, {
        coupon: couponId,
      });

      await supabase
        .from("referral_conversions")
        .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
        .eq("id", conversion.id);

      log.info("processReferralConversion: indicador recompensado com 1 mês grátis", {
        referrer_clinic_id: conversion.referrer_clinic_id,
        referred_clinic_id: referredClinicId,
      });
    } catch (stripeError) {
      // Não relança: a conversão fica em 'converted' e a recompensa pode ser
      // aplicada manualmente no painel do Stripe.
      log.error(
        "processReferralConversion: falha ao aplicar coupon no indicador — aplicar manualmente",
        stripeError as Error,
        {
          referrer_clinic_id: conversion.referrer_clinic_id,
          referrer_subscription: referrerSub!.external_subscription_id,
        },
      );
    }
  } catch (error) {
    // Falha de referral NUNCA pode derrubar o webhook de billing.
    log.error("processReferralConversion: erro inesperado", error as Error, {
      referred_clinic_id: referredClinicId,
    });
  }
}

/**
 * Estatísticas do programa para o card "Indique e ganhe" do dashboard.
 */
export async function getReferralStats(clinicId: string): Promise<ReferralStats> {
  const code = await getOrCreateReferralCode(clinicId);

  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from("referral_conversions")
    .select("status")
    .eq("referrer_clinic_id", clinicId);

  const all = (rows ?? []) as { status: string }[];
  const converted = all.filter((r) => r.status === "converted" || r.status === "rewarded").length;
  const rewarded = all.filter((r) => r.status === "rewarded").length;

  return { code, signedUp: all.length, converted, rewarded };
}
