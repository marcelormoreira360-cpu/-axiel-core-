import { createSupabaseServerClient } from "@/lib/supabase-server";
import { toAppError } from "@/lib/errors";

export type RlsStatus = {
  schemaname: string;
  tablename: string;
  rls_enabled: boolean;
  rls_forced: boolean;
};

export async function getRlsStatus(): Promise<RlsStatus[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("security_rls_status")
    .select("*")
    .order("tablename", { ascending: true });

  if (error) throw toAppError(error, "Security status could not be loaded.");
  return (data ?? []) as RlsStatus[];
}

export function summarizeRlsStatus(rows: RlsStatus[]) {
  const disabled = rows.filter((row) => !row.rls_enabled);
  return {
    total: rows.length,
    protected: rows.length - disabled.length,
    needsAttention: disabled,
    isHealthy: disabled.length === 0,
  };
}
