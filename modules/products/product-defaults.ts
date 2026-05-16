import type { Product, ProductCategoryName, ProductSuggestion } from "./product-types";

export const productCategories: ProductCategoryName[] = [
  "Supplements",
  "Exams / Tests",
  "Devices",
  "Kits",
  "Digital Products",
  "Session Add-ons",
  "Other",
];

export const demoProducts: Product[] = [
  {
    id: "prod-1",
    name: "Magnesium Support",
    category: "Supplements",
    description: "Support item for relaxation and normal nervous system function.",
    priceCents: 3900,
    currency: "USD",
    sku: "MG-SUPPORT",
    inventoryQuantity: 18,
    isActive: true,
    approvedLanguage: "Supports relaxation and normal nervous system function.",
    safetyNotes: "Review current use and patient context before adding.",
  },
  {
    id: "prod-2",
    name: "Sleep Check-in Kit",
    category: "Kits",
    description: "Simple patient support kit connected to follow-up routines.",
    priceCents: 5900,
    currency: "USD",
    sku: "SLEEP-KIT",
    inventoryQuantity: 4,
    isActive: true,
    approvedLanguage: "May help support a calmer evening routine.",
    safetyNotes: "Use only after professional review.",
  },
  {
    id: "prod-3",
    name: "Progress Tracker",
    category: "Digital Products",
    description: "Digital support resource for ongoing check-ins.",
    priceCents: 1900,
    currency: "USD",
    sku: "PROGRESS-DIGITAL",
    inventoryQuantity: 999,
    isActive: true,
    approvedLanguage: "Helps patients track progress between Sessions.",
  },
];

export const demoProductSuggestions: ProductSuggestion[] = [
  {
    id: "sug-1",
    suggestedCategory: "Sleep-support options",
    reason: "Recent answers mention irregular sleep and low energy.",
    safetyQuestions: ["Any current products being used?", "Any sensitivity or restriction to review?"],
    followUpTiming: "Review in 14 days",
    nextStep: "Review sleep-support options with the patient.",
    status: "in_review",
  },
];
