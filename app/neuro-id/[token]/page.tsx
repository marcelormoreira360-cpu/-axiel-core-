import type { Metadata } from "next";
import { getUnifiedLinkByToken } from "@/services/unified-form-link-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import UnifiedPublicClient from "./unified-public-client";

export const metadata: Metadata = {
  title: "Perfil Neuro ID | AXIEL Core",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

function StatusCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] p-6 dark:bg-[#0E1117]">
      <div className="w-full max-w-[400px] rounded-[16px] border border-black/[.07] bg-white px-[24px] py-[32px] text-center dark:border-white/[.08] dark:bg-[#161B26]">
        <p className="mb-[12px] text-[32px]">{icon}</p>
        <h1 className="mb-[8px] text-[18px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{title}</h1>
        <p className="text-[13px] text-[#A09E98] dark:text-[#6B6A66]">{desc}</p>
      </div>
    </div>
  );
}

export default async function UnifiedFormLinkPage({ params }: Props) {
  const { token } = await params;
  const data = await getUnifiedLinkByToken(token);

  if (data.status === "completed") {
    return <StatusCard icon="✅" title="Você já respondeu" desc="Este questionário já foi enviado. Obrigado." />;
  }
  if (data.status === "expired") {
    return <StatusCard icon="⏰" title="Link expirado" desc="Peça um novo link à clínica para responder." />;
  }
  if (data.status !== "ok") {
    return <StatusCard icon="🔗" title="Link inválido" desc="Verifique o endereço ou peça um novo link à clínica." />;
  }

  // Nome da clínica para o cabeçalho (marca).
  let clinicName = "";
  try {
    const admin = createSupabaseAdminClient();
    const { data: clinic } = await admin.from("clinics").select("name").eq("id", data.clinicId).maybeSingle();
    clinicName = (clinic?.name as string) ?? "";
  } catch { /* usa header genérico */ }

  const greeting =
    data.kind === "patient" && data.patientName
      ? `Olá, ${data.patientName.split(/\s+/)[0]}. Responda pensando nos últimos 30 dias.`
      : "Responda pensando nos últimos 30 dias. Leva alguns minutos.";

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-[28px] dark:bg-[#0E1117]">
      <div className="mx-auto mb-2 max-w-6xl px-4">
        {clinicName && (
          <p className="text-[11px] font-medium uppercase tracking-[.10em] text-[#A09E98] dark:text-[#6B6A66]">{clinicName}</p>
        )}
        <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#0F1A2E] dark:text-[#E8E6E2]">
          Perfil Clínico Integrado de 30 Dias
        </h1>
        <p className="mt-[2px] text-[13px] text-[#A09E98] dark:text-[#6B6A66]">{greeting}</p>
      </div>

      <UnifiedPublicClient token={token} kind={data.kind} />

      <p className="mx-auto mt-6 max-w-6xl px-4 text-center text-[11px] text-[#D3D1C7] dark:text-white/20">
        Seus dados são tratados com segurança. Este questionário não é um serviço de emergência.
      </p>
    </div>
  );
}
