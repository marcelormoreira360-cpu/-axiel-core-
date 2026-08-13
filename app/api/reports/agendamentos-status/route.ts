import { getCurrentClinic } from "@/services/clinic-service";
import { isFinanceApiAllowed } from "@/lib/require-finance-access";
import { getAppointmentStatusReport } from "@/services/appointment-report-service";

export const runtime = "nodejs";

// Relatório mensal (Fase 1) do ciclo de status: no-show, cancelamento com aviso
// vs tardio, sessões concluídas por profissional (proxy de ocupação) e receita
// perdida. Gateado ao módulo financeiro (dono/gestor/admin). JSON simples; a UI
// visual completa é o próximo passo (a camada de dados abaixo já resolve).
export async function GET(req: Request) {
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });
  if (!(await isFinanceApiAllowed())) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const practitionerId = url.searchParams.get("practitioner_id");

  const report = await getAppointmentStatusReport({
    clinicId: clinic.id,
    from,
    to,
    practitionerId,
  });

  return Response.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
