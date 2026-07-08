import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { getPatientById, getClinicPatientsForPicker } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { updatePatientAction, anonymizePatientAction } from "./actions";
import { AnonymizePatientButton } from "@/components/anonymize-patient-button";
import { getTranslations } from "next-intl/server";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clinic = await getCurrentClinic();
  const patient = await getPatientById(id, clinic?.id); // A-06
  if (!patient) notFound();

  const t = await getTranslations("patientEdit");
  const confirmMsg = t("anonymizeConfirm", { name: patient.full_name });

  const referrerOptions = clinic?.id ? await getClinicPatientsForPicker(clinic.id, id) : [];

  const action = updatePatientAction.bind(null, id);

  return (
    <Shell>
      <Link
        href={`/patients/${id}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        {patient.full_name}
      </Link>

      <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden max-w-xl">
        <div className="px-[20px] py-[16px] border-b border-black/[.06]">
          <p className="text-[15px] font-medium text-[#0F1A2E]">{t("title")}</p>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
        </div>

        <form action={action} className="px-[20px] py-[20px] space-y-[14px]">
          {/* Nome */}
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("fullName")} *</label>
            <input
              type="text"
              name="full_name"
              required
              defaultValue={patient.full_name}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
            />
          </div>

          {/* Email e telefone */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("email")}</label>
              <input
                type="email"
                name="email"
                defaultValue={patient.email ?? ""}
                placeholder={t("emailPh")}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("phone")}</label>
              <input
                type="text"
                name="phone"
                defaultValue={patient.phone ?? ""}
                placeholder={t("phonePh")}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
          </div>

          {/* CPF (necessário para cobrança Pix via Asaas) */}
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("cpf")}</label>
            <input
              type="text"
              name="cpf"
              defaultValue={patient.cpf ?? ""}
              placeholder={t("cpfPh")}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>

          {/* Data de nascimento e status */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("dob")}</label>
              <input
                type="date"
                name="date_of_birth"
                defaultValue={patient.date_of_birth ?? ""}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("status")}</label>
              <select
                name="status"
                defaultValue={patient.status}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
              >
                <option value="active">{t("statusActive")}</option>
                <option value="inactive">{t("statusInactive")}</option>
                <option value="archived">{t("statusArchived")}</option>
              </select>
            </div>
          </div>

          {/* Demografia (fonte única — lida por todos os relatórios) */}
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("sex")}</label>
              <input
                type="text"
                name="sex"
                defaultValue={patient.sex ?? ""}
                placeholder={t("sexPh")}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("city")}</label>
              <input
                type="text"
                name="city"
                defaultValue={patient.city ?? ""}
                placeholder={t("cityPh")}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("weight")}</label>
              <input
                type="text"
                inputMode="decimal"
                name="weight_kg"
                defaultValue={patient.weight_kg ?? ""}
                placeholder={t("weightPh")}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("height")}</label>
              <input
                type="text"
                inputMode="decimal"
                name="height_cm"
                defaultValue={patient.height_cm ?? ""}
                placeholder={t("heightPh")}
                className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
            </div>
          </div>

          {/* Idioma das mensagens ao paciente (e-mail, WhatsApp, push) */}
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("locale")}</label>
            <select
              name="locale"
              defaultValue={patient.locale ?? ""}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
            >
              <option value="">{t("localeAuto")}</option>
              <option value="pt-BR">{t("localePtBR")}</option>
              <option value="en">{t("localeEn")}</option>
              <option value="pt-PT">{t("localePtPT")}</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("notes")}</label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={patient.notes ?? ""}
              placeholder={t("notesPh")}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition resize-none"
            />
          </div>

          {/* Indicado por (indicação paciente→paciente) */}
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("referredBy")}</label>
            <select
              name="referred_by_patient_id"
              defaultValue={patient.referred_by_patient_id ?? ""}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
            >
              <option value="">{t("referredByNone")}</option>
              {referrerOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <p className="text-[10px] text-[#A09E98] mt-[4px]">{t("referredByHint")}</p>
          </div>

          <div className="flex gap-[8px] pt-[4px]">
            <button
              type="submit"
              className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[20px] py-[9px] transition"
            >
              {t("save")}
            </button>
            <Link
              href={`/patients/${id}`}
              className="text-[13px] font-medium text-[#6B6A66] bg-[#F4F3EF] hover:bg-[#EEECEA] dark:hover:bg-white/[.08] rounded-[8px] px-[20px] py-[9px] transition"
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      </div>

      {/* ── Zona de perigo (LGPD) ──────────────────────────────────────────── */}
      <div className="bg-white border border-red-100 dark:border-red-500/25 rounded-[12px] overflow-hidden max-w-xl mt-6">
        <div className="px-[20px] py-[16px] border-b border-red-100 dark:border-red-500/25 bg-red-50/40 dark:bg-red-500/[.08]">
          <p className="text-[14px] font-semibold text-red-700 dark:text-red-400">{t("dangerTitle")}</p>
          <p className="text-[11px] text-red-500 mt-[2px]">
            {t("dangerSubtitle")}
          </p>
        </div>
        <div className="px-[20px] py-[16px] flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#0F1A2E]">{t("anonymizeTitle")}</p>
            <p className="text-[11px] text-[#A09E98] mt-[2px]">
              {t("anonymizeDesc")}
            </p>
          </div>
          <AnonymizePatientButton
            action={anonymizePatientAction.bind(null, id)}
            confirmMsg={confirmMsg}
            label={t("anonymizeBtn")}
          />
        </div>
      </div>
    </Shell>
  );
}
