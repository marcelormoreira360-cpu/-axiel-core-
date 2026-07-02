"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { markOrderDeliveredAction } from "./actions";

// Botão "Marcar entregue" para pedidos pagos.
export function OrderDeliverButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function deliver() {
    setError(null);
    startTransition(async () => {
      const res = await markOrderDeliveredAction(orderId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="text-right">
      <button
        onClick={deliver}
        disabled={isPending}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] border border-[#0F6E56]/20 bg-[#E1F5EE] dark:bg-[#0F6E56]/20 hover:bg-[#d0f0e6] dark:hover:bg-[#0F6E56]/30 disabled:opacity-50 rounded-md px-2 py-1 transition"
      >
        <Check className="h-3 w-3" /> {isPending ? "…" : "Marcar entregue"}
      </button>
      {error && <p className="text-[9px] text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
