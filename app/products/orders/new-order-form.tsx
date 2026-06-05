"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createProductOrderAction } from "./actions";

type Product = { id: string; name: string; price_cents: number };
type Patient = { id: string; full_name: string };
type CartLine = { product_id: string; name: string; unit_price_cents: number; quantity: number };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function NewOrderForm({ products, patients }: { products: Product[]; patients: Patient[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [patientId, setPatientId] = useState("");
  const [pick, setPick] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [taxStr, setTaxStr] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0), [cart]);
  const taxCents = useMemo(() => {
    const v = parseFloat(taxStr.replace(",", "."));
    return isNaN(v) ? 0 : Math.round(v * 100);
  }, [taxStr]);
  const total = subtotal + taxCents;

  function addProduct() {
    if (!pick) return;
    const p = products.find((x) => x.id === pick);
    if (!p) return;
    setCart((c) => {
      const existing = c.find((l) => l.product_id === p.id);
      if (existing) return c.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { product_id: p.id, name: p.name, unit_price_cents: p.price_cents, quantity: 1 }];
    });
    setPick("");
  }

  function setQty(id: string, qty: number) {
    setCart((c) => c.map((l) => (l.product_id === id ? { ...l, quantity: Math.max(1, qty) } : l)));
  }
  function remove(id: string) {
    setCart((c) => c.filter((l) => l.product_id !== id));
  }

  function submit() {
    setError(null);
    if (cart.length === 0) { setError("Adicione ao menos um produto."); return; }
    const fd = new FormData();
    fd.set("patient_id", patientId);
    fd.set("tax_reais", taxStr);
    fd.set("notes", notes);
    fd.set("items", JSON.stringify(cart.map((l) => ({ product_id: l.product_id, quantity: l.quantity }))));
    startTransition(async () => {
      const res = await createProductOrderAction(fd);
      if (res.error) { setError(res.error); return; }
      router.push("/products/orders");
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Paciente */}
      <div>
        <label className="text-[12px] font-medium text-[#6B6A66] mb-1.5 block">Paciente (opcional)</label>
        <select
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-axiel-line text-[13px] outline-none focus:border-[#0F6E56] bg-axiel-surface"
        >
          <option value="">Venda avulsa (sem paciente)</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      {/* Adicionar produto */}
      <div>
        <label className="text-[12px] font-medium text-[#6B6A66] mb-1.5 block">Produtos</label>
        <div className="flex gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-axiel-line text-[13px] outline-none focus:border-[#0F6E56] bg-axiel-surface"
          >
            <option value="">Selecione um produto…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price_cents)}</option>)}
          </select>
          <button
            onClick={addProduct}
            disabled={!pick}
            className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium text-[#0F6E56] border border-[#0F6E56]/20 bg-[#E1F5EE] hover:bg-[#d0f0e6] disabled:opacity-50 rounded-lg px-3 py-2 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>

      {/* Carrinho */}
      {cart.length > 0 && (
        <div className="border border-axiel-line rounded-xl overflow-hidden bg-axiel-surface">
          {cart.map((l) => (
            <div key={l.product_id} className="flex items-center gap-3 px-4 py-3 border-b border-axiel-line last:border-b-0">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{l.name}</p>
                <p className="text-[11px] text-[#A09E98]">{brl(l.unit_price_cents)} cada</p>
              </div>
              <input
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) => setQty(l.product_id, parseInt(e.target.value || "1", 10))}
                className="w-16 px-2 py-1 rounded-md border border-axiel-line text-[13px] text-center outline-none focus:border-[#0F6E56] bg-axiel-surface"
              />
              <p className="w-24 text-right text-[13px] font-semibold text-[#0F1A2E]">{brl(l.unit_price_cents * l.quantity)}</p>
              <button onClick={() => remove(l.product_id)} className="text-[#D3D1C7] hover:text-rose-500 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Taxa + notas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-medium text-[#6B6A66] mb-1.5 block">Taxa/frete (R$, opcional)</label>
          <input
            value={taxStr}
            onChange={(e) => setTaxStr(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className="w-full px-3 py-2 rounded-lg border border-axiel-line text-[13px] outline-none focus:border-[#0F6E56] bg-axiel-surface"
          />
        </div>
        <div>
          <label className="text-[12px] font-medium text-[#6B6A66] mb-1.5 block">Observações</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className="w-full px-3 py-2 rounded-lg border border-axiel-line text-[13px] outline-none focus:border-[#0F6E56] bg-axiel-surface"
          />
        </div>
      </div>

      {/* Totais */}
      <div className="border-t border-axiel-line pt-4 space-y-1">
        <div className="flex justify-between text-[13px] text-[#6B6A66]"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
        {taxCents > 0 && <div className="flex justify-between text-[13px] text-[#6B6A66]"><span>Taxa/frete</span><span>{brl(taxCents)}</span></div>}
        <div className="flex justify-between text-[15px] font-semibold text-[#0F1A2E]"><span>Total</span><span>{brl(total)}</span></div>
      </div>

      {error && <p className="text-[13px] text-rose-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => router.push("/products/orders")}
          className="text-[13px] font-medium text-[#6B6A66] border border-axiel-line hover:bg-axiel-background rounded-lg px-4 py-2 transition"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={isPending || cart.length === 0}
          className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-lg px-5 py-2 transition"
        >
          {isPending ? "Criando…" : "Criar pedido"}
        </button>
      </div>
    </div>
  );
}
