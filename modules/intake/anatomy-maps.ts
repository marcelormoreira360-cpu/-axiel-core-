// Mapas anatômicos disponíveis como campo de questionário e anotação na sessão.
// As imagens ficam em public/anatomy/. Os rótulos são traduzidos via i18n (intake.maps.*).
export type AnatomyMapKey = "corpo" | "coluna" | "visceras";

export const ANATOMY_MAP_KEYS: AnatomyMapKey[] = ["corpo", "coluna", "visceras"];

export function anatomyMapSrc(key: string | null | undefined): string | null {
  if (!key) return null;
  return ANATOMY_MAP_KEYS.includes(key as AnatomyMapKey) ? `/anatomy/${key}.png` : null;
}

export function isAnatomyMapKey(key: string | null | undefined): key is AnatomyMapKey {
  return !!key && ANATOMY_MAP_KEYS.includes(key as AnatomyMapKey);
}
