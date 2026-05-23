import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Shell } from "@/components/shell";
import { EmptyState } from "@/components/empty-state";
import { LeadPipelineBoard } from "@/components/lead-pipeline-board";
import { getLeads } from "@/services/lead-service";
import { getLeadPipelineSummary } from "@/modules/leads/lead-pipeline";

export default async function LeadsPage() {
  const leads = await getLeads();
  const summary = getLeadPipelineSummary(leads);

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Leads</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {leads.length > 0 ? `${leads.length} lead${leads.length !== 1 ? "s" : ""} no pipeline` : "Nenhum lead ainda"}
          </p>
        </div>
        <Link
          href="/leads/new"
          className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
        >
          + Adicionar lead
        </Link>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-7 w-7" />}
          title="Nenhum lead ainda"
          text="Conecte seus canais de marketing para começar a capturar leads."
          href="/leads/new"
          action="Criar primeiro lead"
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-[10px] mb-[22px]">
            {[
              { label: "Total", value: summary.total, accent: true },
              { label: "New", value: summary.newLeads },
              { label: "Scheduled", value: summary.scheduled },
              { label: "Converted", value: summary.converted },
            ].map((stat) => (
              <div
                key={stat.label}
                className={[
                  "rounded-[10px] border px-[14px] py-[12px]",
                  stat.accent
                    ? "bg-[#0F1A2E] border-transparent"
                    : "bg-white border-black/[.07]",
                ].join(" ")}
              >
                <p className={`text-[10px] font-medium tracking-[.08em] uppercase mb-[6px] ${stat.accent ? "text-white/50" : "text-[#A09E98]"}`}>
                  {stat.label}
                </p>
                <p className={`text-[26px] font-semibold tracking-[-0.04em] leading-none ${stat.accent ? "text-white" : "text-[#0F1A2E]"}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <LeadPipelineBoard leads={leads} />
        </>
      )}
    </Shell>
  );
}
