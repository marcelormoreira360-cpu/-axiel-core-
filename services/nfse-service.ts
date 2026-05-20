import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ── Types ─────────────────────────────────────────────────────────

export interface NfseConfig {
  api_key: string;
  company_id: string;
  city_service_code: string;   // e.g. "1.05"
  service_description: string; // default description
  cnae_code?: string;          // e.g. "8630504"
}

export interface NfseInvoice {
  id: string;
  clinic_id: string;
  patient_payment_id: string | null;
  patient_id: string | null;
  nfse_external_id: string | null;
  nfse_number: string | null;
  nfse_series: string | null;
  nfse_check_code: string | null;
  status: "processing" | "issued" | "cancelled" | "error";
  error_message: string | null;
  amount_cents: number;
  borrower_name: string | null;
  borrower_cpf: string | null;
  service_description: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  issued_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface EmitNfseInput {
  clinicId: string;
  patientPaymentId?: string;
  patientId?: string;
  amountCents: number;
  borrowerName: string;
  borrowerEmail?: string | null;
  borrowerCpf?: string | null;
  serviceDescription?: string;
}

const NFSEIO_BASE = "https://api.nfe.io/v1";

// ── Config helpers ────────────────────────────────────────────────

export async function getNfseConfig(clinicId: string): Promise<NfseConfig | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const s = (data?.settings ?? {}) as Record<string, unknown>;
  if (!s.nfse_api_key || !s.nfse_company_id) return null;

  return {
    api_key:             String(s.nfse_api_key),
    company_id:          String(s.nfse_company_id),
    city_service_code:   String(s.nfse_city_service_code ?? "1.05"),
    service_description: String(s.nfse_service_description ?? "Prestação de serviços de saúde"),
    cnae_code:           s.nfse_cnae_code ? String(s.nfse_cnae_code) : undefined,
  };
}

export async function saveNfseConfig(
  clinicId: string,
  config: Partial<NfseConfig>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const current = (data?.settings ?? {}) as Record<string, unknown>;
  const updated = {
    ...current,
    ...(config.api_key             !== undefined && { nfse_api_key: config.api_key }),
    ...(config.company_id          !== undefined && { nfse_company_id: config.company_id }),
    ...(config.city_service_code   !== undefined && { nfse_city_service_code: config.city_service_code }),
    ...(config.service_description !== undefined && { nfse_service_description: config.service_description }),
    ...(config.cnae_code           !== undefined && { nfse_cnae_code: config.cnae_code }),
  };

  await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, settings: updated }, { onConflict: "clinic_id" });
}

// ── Invoice CRUD ──────────────────────────────────────────────────

export async function listNfseInvoices(
  clinicId: string,
  limit = 50,
): Promise<NfseInvoice[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("nfse_invoices")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as NfseInvoice[];
}

// ── Emit ──────────────────────────────────────────────────────────

export async function emitNfse(input: EmitNfseInput): Promise<NfseInvoice> {
  const config = await getNfseConfig(input.clinicId);
  if (!config) throw new Error("NFSe não configurada. Acesse Configurações → Integrações → NFS-e.");

  const supabase = createSupabaseAdminClient();

  // Build NFe.io payload
  const amount = input.amountCents / 100;
  const payload: Record<string, unknown> = {
    cityServiceCode:  config.city_service_code,
    description:      input.serviceDescription ?? config.service_description,
    servicesAmount:   amount,
    borrower: {
      name:  input.borrowerName,
      ...(input.borrowerEmail && { email: input.borrowerEmail }),
      ...(input.borrowerCpf   && { federalTaxNumber: Number(input.borrowerCpf.replace(/\D/g, "")) }),
    },
  };
  if (config.cnae_code) payload.cnaeCode = config.cnae_code;

  // Insert in DB with "processing" status first
  const { data: record, error: insertError } = await supabase
    .from("nfse_invoices")
    .insert({
      clinic_id:           input.clinicId,
      patient_payment_id:  input.patientPaymentId ?? null,
      patient_id:          input.patientId ?? null,
      status:              "processing",
      amount_cents:        input.amountCents,
      borrower_name:       input.borrowerName,
      borrower_cpf:        input.borrowerCpf ?? null,
      service_description: input.serviceDescription ?? config.service_description,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);
  const localId = record.id as string;

  // Call NFe.io API
  try {
    const res = await fetch(
      `${NFSEIO_BASE}/companies/${config.company_id}/serviceinvoices`,
      {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   config.api_key,
        },
        body: JSON.stringify(payload),
      },
    );

    const json = await res.json();

    if (!res.ok) {
      const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`;
      await supabase.from("nfse_invoices").update({ status: "error", error_message: msg }).eq("id", localId);
      throw new Error(`NFe.io: ${msg}`);
    }

    // Update record with external ID
    const externalId: string = json.id ?? json.serviceInvoiceId ?? "";
    await supabase.from("nfse_invoices").update({
      nfse_external_id: externalId,
    }).eq("id", localId);

    // Immediately try to fetch full status
    const updated = await syncNfseStatus(input.clinicId, localId, config, externalId);
    return updated;

  } catch (err) {
    if (err instanceof Error && err.message.startsWith("NFe.io:")) throw err;
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    await supabase.from("nfse_invoices").update({ status: "error", error_message: msg }).eq("id", localId);
    throw err;
  }
}

// ── Sync status from NFe.io ───────────────────────────────────────

export async function syncNfseStatus(
  clinicId: string,
  localId: string,
  config?: NfseConfig | null,
  externalId?: string,
): Promise<NfseInvoice> {
  const supabase = createSupabaseAdminClient();

  const cfg = config ?? (await getNfseConfig(clinicId));
  if (!cfg) throw new Error("Configuração NFSe não encontrada.");

  // Get external ID if not provided
  if (!externalId) {
    const { data } = await supabase.from("nfse_invoices").select("nfse_external_id").eq("id", localId).single();
    externalId = (data?.nfse_external_id as string | null) ?? undefined;
  }
  if (!externalId) {
    const { data } = await supabase.from("nfse_invoices").select("*").eq("id", localId).single();
    return data as NfseInvoice;
  }

  const res = await fetch(
    `${NFSEIO_BASE}/companies/${cfg.company_id}/serviceinvoices/${externalId}`,
    { headers: { Authorization: cfg.api_key } },
  );

  if (!res.ok) {
    const { data } = await supabase.from("nfse_invoices").select("*").eq("id", localId).single();
    return data as NfseInvoice;
  }

  const json = await res.json();

  // Map NFe.io status → internal status
  const rawStatus: string = json.flowStatus ?? json.status ?? "";
  const status: NfseInvoice["status"] =
    rawStatus === "Issued" || rawStatus === "issued"         ? "issued"
    : rawStatus === "Cancelled" || rawStatus === "cancelled" ? "cancelled"
    : rawStatus === "Error" || rawStatus === "error"         ? "error"
    : "processing";

  const updates: Partial<NfseInvoice> = {
    status,
    nfse_number:     json.number     ?? null,
    nfse_series:     json.series     ?? null,
    nfse_check_code: json.checkCode  ?? null,
    pdf_url:         json.pdfUrl     ?? json.links?.find((l: { rel: string; href: string }) => l.rel === "pdf")?.href ?? null,
    xml_url:         json.xmlUrl     ?? json.links?.find((l: { rel: string; href: string }) => l.rel === "xml")?.href ?? null,
    ...(status === "issued"    && { issued_at:    new Date().toISOString() }),
    ...(status === "cancelled" && { cancelled_at: new Date().toISOString() }),
    ...(status === "error"     && { error_message: json.errors?.[0]?.message ?? "Erro na emissão" }),
  };

  const { data: updated } = await supabase
    .from("nfse_invoices")
    .update(updates)
    .eq("id", localId)
    .select()
    .single();

  return updated as NfseInvoice;
}

// ── Cancel ────────────────────────────────────────────────────────

export async function cancelNfse(clinicId: string, localId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const cfg = await getNfseConfig(clinicId);
  if (!cfg) throw new Error("Configuração NFSe não encontrada.");

  const { data } = await supabase.from("nfse_invoices").select("nfse_external_id").eq("id", localId).single();
  const externalId = data?.nfse_external_id as string | null;
  if (!externalId) throw new Error("Nota ainda não foi emitida.");

  const res = await fetch(
    `${NFSEIO_BASE}/companies/${cfg.company_id}/serviceinvoices/${externalId}`,
    { method: "DELETE", headers: { Authorization: cfg.api_key } },
  );

  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message ?? `Erro ao cancelar: HTTP ${res.status}`);
  }

  await supabase.from("nfse_invoices").update({
    status:       "cancelled",
    cancelled_at: new Date().toISOString(),
  }).eq("id", localId);
}
