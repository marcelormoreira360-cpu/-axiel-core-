// Mapas anatômicos disponíveis como campo de questionário e anotação na sessão.
// As imagens ficam em public/anatomy/. Os rótulos são traduzidos via i18n (intake.maps.*).
export type AnatomyMapKey = "corpo" | "coluna" | "visceras" | "sna";

export const ANATOMY_MAP_KEYS: AnatomyMapKey[] = ["corpo", "coluna", "visceras", "sna"];

// Nome real do arquivo em public/anatomy/ — DEVE bater EXATAMENTE com o que está
// versionado no git (a Vercel/Linux diferencia maiúsculas de minúsculas).
// Conferido via `git ls-files`: corpo/visceras/sna são minúsculos; Vertebras é maiúsculo.
const MAP_FILES: Record<AnatomyMapKey, string> = {
  corpo: "corpo.png",
  coluna: "Vertebras.png",
  visceras: "visceras.png",
  sna: "sna.png",
};

export function anatomyMapSrc(key: string | null | undefined): string | null {
  if (!key || !ANATOMY_MAP_KEYS.includes(key as AnatomyMapKey)) return null;
  return `/anatomy/${MAP_FILES[key as AnatomyMapKey]}`;
}

export function isAnatomyMapKey(key: string | null | undefined): key is AnatomyMapKey {
  return !!key && ANATOMY_MAP_KEYS.includes(key as AnatomyMapKey);
}
