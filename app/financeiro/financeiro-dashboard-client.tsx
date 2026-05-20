"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RegisterPaymentModal } from "./register-payment-modal";

interface Props {
  patients: { id: string; full_name: string }[];
}

export function FinanceiroDashboardClient({ patients }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-black transition"
      >
        + Novo pagamento
      </button>

      {open && (
        <RegisterPaymentModal
          patients={patients}
          onClose={() => setOpen(false)}
          onSuccess={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}
