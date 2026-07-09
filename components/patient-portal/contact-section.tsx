"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, Check, X } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { updatePatientContactAction } from "@/app/p/[token]/actions";

// ── Meus dados ────────────────────────────────────────────────────────────────
export function ContactSection({
  patient,
  rawToken,
}: {
  patient: PatientPortalData["patient"];
  rawToken: string;
}) {
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();

  // Contact edit state
  const [editingContact, setEditingContact] = useState(false);
  const [fullName, setFullName] = useState(patient.full_name ?? "");
  const [phone, setPhone]   = useState(patient.phone ?? "");
  const [email, setEmail]         = useState(patient.email ?? "");
  const [dob, setDob]             = useState(patient.date_of_birth ?? "");
  const [addressLine, setAddress] = useState(patient.address_line ?? "");
  const [city, setCity]           = useState(patient.city ?? "");
  const [state, setState]         = useState(patient.state ?? "");
  const [zipCode, setZipCode]     = useState(patient.zip_code ?? "");
  const [country, setCountry]     = useState(patient.country ?? "Brasil");
  const [contactMsg, setContactMsg] = useState<string | null>(null);
  const [contactErrored, setContactErrored] = useState(false);
  const [, startContactTransition] = useTransition();

  function handleSaveContact() {
    startContactTransition(async () => {
      setContactMsg(null);
      const result = await updatePatientContactAction(rawToken, {
        full_name: fullName,
        phone,
        email,
        date_of_birth: dob,
        address_line: addressLine,
        city,
        state,
        zip_code: zipCode,
        country,
      });
      if (result.ok) {
        setContactErrored(false);
        setContactMsg(t("contactSaved"));
        setEditingContact(false);
      } else {
        setContactErrored(true);
        setContactMsg(result.error ?? t("saveErr"));
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{t("myDataTitle")}</p>
        {!editingContact && (
          <button onClick={() => setEditingContact(true)} className="flex items-center gap-1 text-xs text-black/40 hover:text-black/70 transition">
            <Pencil className="h-3 w-3" /> {t("edit")}
          </button>
        )}
      </div>
      {contactMsg && (
        <p className={`text-xs ${contactErrored ? "text-red-500" : "text-[#0F6E56]"}`}>{contactMsg}</p>
      )}
      {editingContact ? (
        <div className="space-y-2">
          {/* Contato */}
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30 pt-1">{t("contactSection")}</p>
          <div>
            <label className="text-xs text-black/40 block mb-1">{t("fullName")}</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("fullNamePlaceholder")}
              className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-black/40 block mb-1">{t("phone")}</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999"
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
            </div>
            <div>
              <label className="text-xs text-black/40 block mb-1">{t("email")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")}
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
            </div>
          </div>
          <div>
            <label className="text-xs text-black/40 block mb-1">{t("dob")}</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
          </div>

          {/* Endereço */}
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30 pt-2">{t("addressSection")}</p>
          <div>
            <label className="text-xs text-black/40 block mb-1">{t("addressLine")}</label>
            <input type="text" value={addressLine} onChange={(e) => setAddress(e.target.value)} placeholder={t("addressPlaceholder")}
              className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-black/40 block mb-1">{t("city")}</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")}
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
            </div>
            <div>
              <label className="text-xs text-black/40 block mb-1">{t("stateLabel")}</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder={t("statePlaceholder")}
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-black/40 block mb-1">{t("zip")}</label>
              <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder={t("zipPlaceholder")}
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
            </div>
            <div>
              <label className="text-xs text-black/40 block mb-1">{t("country")}</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("countryPlaceholder")}
                className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSaveContact} className="flex items-center gap-1 rounded-xl bg-[#0F1A2E] text-white px-4 py-2 text-sm font-medium hover:bg-black transition">
              <Check className="h-3.5 w-3.5" /> {t("save")}
            </button>
            <button onClick={() => { setEditingContact(false); setContactMsg(null); }} className="flex items-center gap-1 rounded-xl border border-black/[.10] px-4 py-2 text-sm text-black/50 hover:bg-black/[.04] transition">
              <X className="h-3.5 w-3.5" /> {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#0F1A2E]">{patient.full_name}</p>
          <p className="text-sm text-[#0F1A2E]">{patient.phone || <span className="text-black/30 italic">{t("phoneNotInformed")}</span>}</p>
          <p className="text-sm text-[#0F1A2E]">{patient.email || <span className="text-black/30 italic">{t("emailNotInformed")}</span>}</p>
          {patient.date_of_birth && (
            <p className="text-sm text-[#0F1A2E]">
              {new Date(patient.date_of_birth + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          {(patient.address_line || patient.city) && (
            <p className="text-sm text-black/60">
              {[patient.address_line, patient.city, patient.state, patient.zip_code].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
