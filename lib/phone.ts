// Normalização ÚNICA de telefone para armazenamento e dedup: só dígitos.
// Site público, portal, agenda e Hotmart gravavam formatos diferentes
// ("(11) 98765-4321", "+5511987654321", "11987654321") e o mesmo paciente
// virava 2-3 registros porque a busca por telefone não batia.
export function normalizePhoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}
