import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { getRlsStatus, summarizeRlsStatus } from "@/services/security-service";

export default async function SecuritySettingsPage() {
  const rows = await getRlsStatus();
  const summary = summarizeRlsStatus(rows);

  return (
    <div className="space-y-6">
      <SimplePageHeader
        eyebrow="Security"
        title="Data protection"
        helper="Quick view of Row Level Security coverage across AXIEL Core."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-black/50">Tables checked</p>
          <p className="mt-3 text-4xl font-semibold text-axiel-ink">{summary.total}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-black/50">Protected</p>
          <p className="mt-3 text-4xl font-semibold text-axiel-ink">{summary.protected}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-black/50">Needs attention</p>
          <p className="mt-3 text-4xl font-semibold text-axiel-ink">{summary.needsAttention.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-axiel-ink">RLS status</h2>
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.tablename} className="flex items-center justify-between rounded-2xl border border-axiel-line p-3">
              <span className="text-sm font-medium text-axiel-ink">{row.tablename}</span>
              <span className={row.rls_enabled ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
                {row.rls_enabled ? "Protected" : "RLS off"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
