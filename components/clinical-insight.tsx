import type { ClinicalInsight } from "@/modules/insights/clinical-insight";
import { Card } from "@/components/card";
import { getTerm } from "@/modules/ui/terminology";

export function ClinicalInsightView({ insight }: { insight: ClinicalInsight }) {
  return (
    <div className="space-y-5">
      <Card className="bg-axiel-ink text-white">
        <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">{getTerm("insight").toUpperCase()}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{insight.title}</h1>
        <p className="mt-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">{insight.notice}</p>
        <p className="mt-4 text-sm text-white/50">Created {new Date(insight.generated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {insight.patient_overview.map((item) => (
          <Card key={item.title} className="p-5">
            <p className="text-sm text-black/45">{item.title}</p>
            <p className="mt-2 text-base font-semibold leading-6 text-black/75">{item.body}</p>
          </Card>
        ))}
      </section>

      <Card>
        <h2 className="text-2xl font-semibold">Key Notes</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {insight.key_observations.map((observation) => (
            <span key={observation} className="rounded-full bg-axiel-soft px-4 py-2 text-sm font-semibold text-black/65">
              {observation}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-semibold">What may be connected</h2>
        <div className="mt-5 space-y-4">
          {insight.patterns.map((pattern) => (
            <div key={pattern.title} className="rounded-3xl bg-axiel-soft p-5">
              <h3 className="font-semibold text-black/80">{pattern.title}</h3>
              <p className="mt-2 text-sm leading-6 text-black/60">{pattern.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-semibold">{getTerm("nextStep", "plural")}</h2>
        <div className="mt-5 space-y-3">
          {insight.simple_next_steps.map((point) => (
            <p key={point} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md text-sm leading-6 text-black/65">
              {point}
            </p>
          ))}
        </div>
      </Card>

      <Card className="border-dashed">
        <p className="text-sm leading-6 text-black/55">{insight.closing_note}</p>
      </Card>
    </div>
  );
}
