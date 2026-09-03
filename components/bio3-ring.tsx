import { Brain, Atom, PersonStanding } from "lucide-react";
import { bandForDysfunction } from "@/modules/neuro-id/bands";

// ── Bio³ Circular (rosca de equilíbrio, autoexplicativa) ──────────────────────
// Substitui a pirâmide no painel do PACIENTE. Três fatias IGUAIS de 120° (mesmo peso,
// sem hierarquia — "três dimensões, um sistema"). Cada fatia mostra ÍCONE + NOME do eixo
// + % de EQUILÍBRIO, tem uma borda externa arredondada colorida e um nó na junção. A COR
// vem da banda da DISFUNÇÃO crua (solto verde / tenso âmbar / bloqueado terracota) — o pior
// eixo salta em terracota, e a prioridade também aparece pela borda mais grossa da fatia. No
// centro, o indivíduo (pequeno, num anel pontilhado do tamanho do boneco) onde convergem.
//
// Ordem do array = [fisico, bioquimico, emocional]. Posições:
//   fisico (Biomecânico)      → inferior-direito
//   bioquimico (Biofuncional) → inferior-esquerdo
//   emocional (Bioemocional)  → topo

export type Bio3RingIcon = "person" | "atom" | "brain";

export type Bio3RingDatum = {
  /** disfunção 0–100 (fonte da cor/estado). */
  dys: number | null;
  /** equilíbrio 0–100 já convertido (100 − disfunção) — número exibido na fatia. */
  balance: number | null;
  isPriority: boolean;
  /** nome do eixo (Biomecânico/Biofuncional/Bioemocional). */
  label: string;
  icon: Bio3RingIcon;
};

const ICONS: Record<Bio3RingIcon, typeof Brain> = { person: PersonStanding, atom: Atom, brain: Brain };

const CX = 100;
const CY = 100;
const OUTER = 92;
const INNER = 25; // fatias chegam perto do boneco (sem vazio branco no miolo)
const RIM = 88;
const HALF = 55; // meia-abertura → fatia de 110°, gap de 10°
const CORE_R = 17; // círculo central: só o tamanho do boneco
// Layout: Bioemocional topo · Biomecânico base-direita · Biofuncional base-esquerda.
const CENTERS = [30, 150, -90]; // fisico, bioquimico, emocional
const BOUNDARIES = [-30, 90, -150]; // junções entre fatias (nós)
const ANCHOR_R = 60; // centro da pilha vertical (ícone → nome → %) dentro da fatia
const NEUTRAL = { fill: "#EFEEE9", text: "#8A8880", stroke: "#C9C7BF" };

function pol(r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}
function wedgePath(a0: number, a1: number) {
  const oS = pol(OUTER, a0), oE = pol(OUTER, a1);
  const iE = pol(INNER, a1), iS = pol(INNER, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M${oS.x.toFixed(2)} ${oS.y.toFixed(2)}`,
    `A${OUTER} ${OUTER} 0 ${large} 1 ${oE.x.toFixed(2)} ${oE.y.toFixed(2)}`,
    `L${iE.x.toFixed(2)} ${iE.y.toFixed(2)}`,
    `A${INNER} ${INNER} 0 ${large} 0 ${iS.x.toFixed(2)} ${iS.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}
function rimPath(a0: number, a1: number) {
  const s = pol(RIM, a0), e = pol(RIM, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)}A${RIM} ${RIM} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export function Bio3Ring({
  data,
  className = "w-full max-w-[224px] h-auto mx-auto sm:w-[188px] sm:mx-0",
  ariaLabel,
}: {
  data: Bio3RingDatum[];
  className?: string;
  ariaLabel: string;
}) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={ariaLabel}>
      <style>{`
        .b3-wedge { opacity: 1; }
        @media (prefers-reduced-motion: no-preference) {
          .b3-wedge { animation: b3in .5s ease both; }
          .b3-wedge.b3-i0 { animation-delay: 0s; }
          .b3-wedge.b3-i1 { animation-delay: .1s; }
          .b3-wedge.b3-i2 { animation-delay: .2s; }
          .b3-node { animation: b3in .5s ease .3s both; }
          @keyframes b3in { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>

      {data.map((d, i) => {
        const c = CENTERS[i];
        const band = bandForDysfunction(d.dys);
        const col = band?.colors ?? NEUTRAL;
        const a0 = c - HALF;
        const a1 = c + HALF;
        const an = pol(ANCHOR_R, c); // âncora da pilha vertical
        const Icon = ICONS[d.icon];
        const title = d.balance === null
          ? d.label
          : `${d.label} · ${Math.round(d.balance)}% de equilíbrio · disfunção identificada: ${100 - Math.round(d.balance)}%`;
        return (
          <g key={i} className={`b3-wedge b3-i${i}`}>
            <title>{title}</title>
            <path d={wedgePath(a0, a1)} fill={col.fill} stroke={col.stroke} strokeOpacity={0.25} strokeWidth={0.5} strokeLinejoin="round" />
            <path d={rimPath(a0, a1)} fill="none" stroke={col.stroke} strokeWidth={d.isPriority ? 6 : 5} strokeLinecap="round" />
            <g transform={`translate(${(an.x - 7).toFixed(1)} ${(an.y - 26).toFixed(1)})`}>
              <Icon size={14} color={col.text} strokeWidth={1.8} aria-hidden />
            </g>
            <text x={an.x.toFixed(1)} y={(an.y - 3).toFixed(1)} textAnchor="middle" fontSize={7.2} fontWeight={500} fill={col.text}>
              {d.label}
            </text>
            <text x={an.x.toFixed(1)} y={(an.y + 11).toFixed(1)} textAnchor="middle" fontSize={15} fontWeight={600} fill={col.text}>
              {d.balance === null ? "—" : `${Math.round(d.balance)}%`}
            </text>
          </g>
        );
      })}

      {/* nós nas junções das fatias */}
      {BOUNDARIES.map((b, i) => {
        const p = pol(RIM, b);
        return <circle key={`n${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={3.4} fill="#FFFFFF" stroke={NEUTRAL.stroke} strokeWidth={1.1} />;
      })}

      {/* núcleo — "Você" (o paciente no centro dos três pilares) num anel pontilhado */}
      <g className="b3-node">
        <circle cx={CX} cy={CY} r={CORE_R} fill="#FFFFFF" stroke="#E9E7E0" strokeWidth={0.75} />
        <circle cx={CX} cy={CY} r={CORE_R} fill="none" stroke={NEUTRAL.stroke} strokeWidth={0.9} strokeDasharray="1.5 3" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="#5B5952">Você</text>
      </g>
    </svg>
  );
}
