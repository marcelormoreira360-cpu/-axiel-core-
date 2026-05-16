const restrictedTerms = [
  "cure",
  "treats",
  "treat",
  "diagnose",
  "diagnosis",
  "prescribe",
  "prescription",
  "fixes",
  "heals",
  "guaranteed",
];

export function validateProductLanguage(text: string) {
  const lower = text.toLowerCase();
  const matches = restrictedTerms.filter((term) => lower.includes(term));

  return {
    isSafe: matches.length === 0,
    warnings: matches.map((term) => `Review wording: "${term}" may sound like a medical claim.`),
  };
}

export function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
