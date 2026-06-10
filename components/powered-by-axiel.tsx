// Rodapé "Powered by AXIEL" — loop viral PLG nas superfícies públicas
// (booking público e portal do paciente). Oculto para clínicas com a
// feature `white_label` (Enterprise) — a decisão vem do servidor via
// flag `show_powered_by` no payload da clínica.

type PoweredByAxielProps = {
  /** Superfície onde o rodapé aparece — define texto e utm_medium */
  variant: "booking" | "portal";
  /** Locale atual da página (pt-BR por padrão — superfícies públicas BR) */
  locale?: string;
};

// Base do link: domínio real do app (NEXT_PUBLIC_APP_URL é inlined no build).
// Fallback para o domínio institucional usado nos e-mails (axielcore.com).
const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://axielcore.com").replace(/\/$/, "");

const COPY: Record<PoweredByAxielProps["variant"], { pt: string; en: string }> = {
  booking: {
    pt: "⚡ Agendamento por AXIEL — crie o sistema da sua clínica",
    en: "⚡ Scheduling by AXIEL — build your clinic's system",
  },
  portal: {
    pt: "Portal por AXIEL",
    en: "Portal by AXIEL",
  },
};

export function PoweredByAxiel({ variant, locale = "pt-BR" }: PoweredByAxielProps) {
  const isEnglish = locale.toLowerCase().startsWith("en");
  const label = isEnglish ? COPY[variant].en : COPY[variant].pt;
  const href = `${BASE_URL}?utm_source=powered_by&utm_medium=${variant}&utm_campaign=viral`;

  return (
    <div className="mt-8 pb-4 text-center">
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="text-[11px] text-black/30 hover:text-black/50 transition"
      >
        {label}
      </a>
    </div>
  );
}
