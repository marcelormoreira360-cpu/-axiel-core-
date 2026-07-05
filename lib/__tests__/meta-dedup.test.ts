import { describe, it, expect, vi } from "vitest";
import { isDuplicateMetaMessage, type MetaDedupClient } from "@/lib/meta-dedup";

// Fake do client Supabase: simula o INSERT ... ON CONFLICT DO NOTHING RETURNING
// (upsert com ignoreDuplicates + select) sobre um Set de mids em memória.
function fakeClient(store: Set<string>): MetaDedupClient {
  return {
    from: (table: string) => ({
      upsert: (values: { mid: string }) => ({
        select: async () => {
          expect(table).toBe("meta_processed_messages");
          if (store.has(values.mid)) return { data: [], error: null }; // conflito: 0 linhas
          store.add(values.mid);
          return { data: [{ mid: values.mid }], error: null };
        },
      }),
    }),
  };
}

function failingClient(): MetaDedupClient {
  return {
    from: () => ({
      upsert: () => ({
        select: async () => ({ data: null, error: { code: "42P01", message: "relation does not exist" } }),
      }),
    }),
  };
}

describe("meta-dedup", () => {
  it("primeira vez: registra o mid e NÃO é duplicata", async () => {
    const store = new Set<string>();
    expect(await isDuplicateMetaMessage(fakeClient(store), "mid.abc123")).toBe(false);
    expect(store.has("mid.abc123")).toBe(true);
  });

  it("retry da Meta (mesmo mid): é duplicata e deve ser pulado", async () => {
    const store = new Set<string>();
    const client = fakeClient(store);
    expect(await isDuplicateMetaMessage(client, "mid.abc123")).toBe(false);
    expect(await isDuplicateMetaMessage(client, "mid.abc123")).toBe(true);
    expect(await isDuplicateMetaMessage(client, "mid.abc123")).toBe(true);
  });

  it("mids diferentes não colidem", async () => {
    const store = new Set<string>();
    const client = fakeClient(store);
    expect(await isDuplicateMetaMessage(client, "mid.aaa")).toBe(false);
    expect(await isDuplicateMetaMessage(client, "mid.bbb")).toBe(false);
  });

  it("mensagem sem mid processa normalmente (nunca é duplicata)", async () => {
    const store = new Set<string>();
    expect(await isDuplicateMetaMessage(fakeClient(store), undefined)).toBe(false);
    expect(await isDuplicateMetaMessage(fakeClient(store), null)).toBe(false);
    expect(await isDuplicateMetaMessage(fakeClient(store), "")).toBe(false);
    expect(store.size).toBe(0);
  });

  it("erro de banco não bloqueia o bot (fail-open: processa mesmo assim)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await isDuplicateMetaMessage(failingClient(), "mid.abc123")).toBe(false);
    spy.mockRestore();
  });

  it("exceção do client não bloqueia o bot (fail-open)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwing: MetaDedupClient = {
      from: () => {
        throw new Error("boom");
      },
    };
    expect(await isDuplicateMetaMessage(throwing, "mid.abc123")).toBe(false);
    spy.mockRestore();
  });
});
