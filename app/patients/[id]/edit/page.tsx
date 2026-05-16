import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { getPatientById } from "@/services/patient-service";
import { updatePatientAction } from "./actions";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatientById(id);
  if (!patient) notFound();

  const action = updatePatientAction.bind(null, id);

  return (
    <Shell>
      <Link
        href={`/patients/${id}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        {patient.full_name}
      </Link>

      <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden max-w-xl">
        <div className="px-[20px] py-[16px] border-b border-black/[.06]">
          <p className="text-[15px] font-medium text-[#0F1A2E]">Editar paciente</p>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">Atualize os dados cadastrais</p>
        </div>

        <form action={action} className="px-[20px] py-[20px] space-y-[14px]">
          {/* Nome */}
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">Nome completo *</label>
            <input
              type="text"
              name="full_name"
              required
              defaultValue={patient.full_name}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
            />
          </div>

          {/* Email e telefone */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">Email</label>
              <input
                type="email"
                name="email"
                defaultValue={patient.email ?? ""}
                placeholder="email@exemplo.com"
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">Telefone</label>
              <input
                type="text"
                name="phone"
                defaultValue={patient.phone ?? ""}
                placeholder="(11) 99999-9999"
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
          </div>

          {/* Data de nascimento e status */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">Data de nascimento</label>
              <input
                type="date"
                name="date_of_birth"
                defaultValue={patient.date_of_birth ?? ""}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">Status</label>
              <select
                name="status"
                defaultValue={patient.status}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">Notas clínicas</label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={patient.notes ?? ""}
              placeholder="Observações relevantes sobre o paciente..."
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition resize-none"
            />
          </div>

          <div className="flex gap-[8px] pt-[4px]">
            <button
              type="submit"
              className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[20px] py-[9px] transition"
            >
              Salvar alterações
            </button>
            <Link
              href={`/patients/${id}`}
              className="text-[13px] font-medium text-[#6B6A66] bg-[#F4F3EF] hover:bg-[#EEECEA] rounded-[8px] px-[20px] py-[9px] transition"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}
