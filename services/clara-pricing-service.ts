/**
 * Fonte única de preço por cidade da Clara: lê `clara_city_pricing` (banco) e
 * devolve no formato PricingLocation[] que o bot já consome. Assim o preço que a
 * Clara cota vem do BANCO, não da tabela cravada em whatsapp-bot-defaults.ts (que
 * fica só como seed/fallback). Read-only, admin client (webhooks sem sessão).
 */
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";
import type { PricingLocation, PricingPlan } from "@/lib/whatsapp-bot-defaults";

const log = createLogger("clara-pricing");

type Row = {
  city: string;
  public_name: string;
  price_cents: number;
  currency: string;
  price_prefix: string | null;
  includes: string | null;
  sort_order: number;
};

// Rótulo de preço, sem centavos quando inteiro. Orlando usa "$"; demais cidades
// "US$" (deixa claro ao paciente do Brasil que é dólar). Prefixo 'from' vira o
// sufixo neutro "+", entendido em qualquer idioma como "a partir de".
function priceLabel(r: Row): string {
  const amount = r.price_cents % 100 === 0 ? String(r.price_cents / 100) : (r.price_cents / 100).toFixed(2);
  const symbol = r.city.toLowerCase().includes("orlando") ? "$" : "US$";
  const base = `${symbol}${amount}`;
  return r.price_prefix === "from" ? `${base}+` : base;
}

// Orlando primeiro, depois São Paulo, Maringá; o resto em ordem alfabética.
const CITY_ORDER: Record<string, number> = { orlando: 0, "são paulo": 1, "sao paulo": 1, maringá: 2, maringa: 2 };
const cityRank = (city: string) => CITY_ORDER[city.toLowerCase()] ?? 9;

/**
 * Preços por cidade do banco → PricingLocation[]. [] quando a clínica não tem
 * linhas (aí o chamador cai no fallback da config cravada). Nunca lança.
 */
export async function getClaraCityPricing(clinicId: string): Promise<PricingLocation[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("clara_city_pricing")
      .select("city, public_name, price_cents, currency, price_prefix, includes, sort_order")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .eq("can_offer", true)
      .order("sort_order", { ascending: true });
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return [];

    const byCity = new Map<string, PricingPlan[]>();
    for (const r of rows) {
      if (!byCity.has(r.city)) byCity.set(r.city, []);
      byCity.get(r.city)!.push({ name: r.public_name, price: priceLabel(r), description: r.includes ?? "" });
    }
    return [...byCity.entries()]
      .sort((a, b) => cityRank(a[0]) - cityRank(b[0]) || a[0].localeCompare(b[0]))
      .map(([city, plans]) => ({ city, plans }));
  } catch (e) {
    log.error("getClaraCityPricing failed", e, { clinic_id: clinicId });
    return [];
  }
}
