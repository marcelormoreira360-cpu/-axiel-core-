export function limitVisibleItems<T>(items: T[], maxItems = 5) {
  return items.slice(0, maxItems);
}

export function shortPatientText(value: string | null | undefined, fallback: string, maxLength = 180) {
  const clean = value?.trim();
  if (!clean) return fallback;
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 3)}...` : clean;
}
