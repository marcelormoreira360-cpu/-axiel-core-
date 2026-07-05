// Deduplicação de webhooks da Meta (Instagram / Facebook Messenger / WhatsApp).
//
// A Meta reenvia o webhook quando não recebe 200 rápido (a chamada ao LLM
// demora), e cada reenvio do MESMO evento gerava uma nova resposta do bot
// (com fraseado diferente, porque o LLM é regenerado a cada tentativa).
//
// O gate: antes de processar cada mensagem com id único (mid no IG/FB, id do
// message object no WhatsApp), registramos o id em meta_processed_messages
// (migration 116) via INSERT ... ON CONFLICT DO NOTHING. Se a linha JÁ existia,
// o evento é um retry e deve ser pulado. Mensagens sem id seguem o fluxo normal.
//
// Falha de banco NÃO bloqueia o bot (fail-open): melhor arriscar uma resposta
// duplicada do que silenciar o atendimento por indisponibilidade da tabela.

type DedupInsertResult = { data: unknown[] | null; error: { code?: string; message?: string } | null };

// Superfície mínima do client Supabase usada pelo dedup — os webhooks passam o
// client admin (service_role) que já usam; o teste passa um fake.
export type MetaDedupClient = {
  from: (table: string) => {
    upsert: (
      values: { mid: string },
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => { select: (columns: string) => PromiseLike<DedupInsertResult> };
  };
};

/**
 * true se este id de mensagem JÁ foi processado (retry da Meta — pular o evento).
 * false se é a primeira vez (registra e segue), se não há id, ou se o banco falhou.
 */
export async function isDuplicateMetaMessage(
  supabase: MetaDedupClient,
  mid: string | null | undefined,
): Promise<boolean> {
  if (!mid) return false; // sem id único: processa normalmente

  try {
    // upsert com ignoreDuplicates = INSERT ... ON CONFLICT DO NOTHING RETURNING:
    // 1 linha retornada = inserido agora (primeira vez); 0 linhas = já existia (retry).
    const { data, error } = await supabase
      .from("meta_processed_messages")
      .upsert({ mid }, { onConflict: "mid", ignoreDuplicates: true })
      .select("mid");

    if (error) {
      console.error("[meta-dedup] insert failed (processando mesmo assim):", error.message ?? error.code);
      return false;
    }
    return (data?.length ?? 0) === 0;
  } catch (e) {
    console.error("[meta-dedup] exception (processando mesmo assim):", e);
    return false;
  }
}
