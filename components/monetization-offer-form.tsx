"use client";

import { useRef, useState } from "react";

export function MonetizationOfferForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [offerType, setOfferType] = useState("session_package");

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-[14px] bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[18px]"
    >
      <div className="mb-[4px]">
        <p className="text-[14px] font-medium text-[#0F1A2E]">Nova oferta</p>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">Pacotes de sessões e assinaturas.</p>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">Nome da oferta</label>
        <input
          name="name"
          required
          placeholder="Ex: Pacote 4 sessões"
          className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
        />
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">Tipo</label>
          <select
            name="offer_type"
            value={offerType}
            onChange={(e) => setOfferType(e.target.value)}
            className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
          >
            <option value="session_package">Pacote de sessões</option>
            <option value="membership">Assinatura recorrente</option>
          </select>
        </div>
        {offerType === "membership" ? (
          <div>
            <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">Cobrança</label>
            <select
              name="billing_interval"
              className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
            >
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">Sessões</label>
            <input
              name="number_of_sessions"
              type="number"
              min="1"
              max="500"
              required
              defaultValue="4"
              className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-[1fr_90px]">
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">Valor (R$)</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0,00"
            className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">Moeda</label>
          <input
            name="currency"
            defaultValue="BRL"
            maxLength={3}
            className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] uppercase outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">Descrição (opcional)</label>
        <textarea
          name="description"
          rows={2}
          placeholder="Descrição interna da oferta"
          className="w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 py-2.5 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition resize-none"
        />
      </div>

      <button
        type="submit"
        className="w-full h-10 flex items-center justify-center text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] transition"
      >
        Salvar oferta
      </button>
    </form>
  );
}
