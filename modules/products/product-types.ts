export type ProductStatus = "active" | "inactive";
export type ProductCategoryName =
  | "Supplements"
  | "Exams / Tests"
  | "Devices"
  | "Kits"
  | "Digital Products"
  | "Session Add-ons"
  | "Other";

export type ProductSuggestionStatus = "in_review" | "approved" | "ignored";
export type PatientProductStatus = "active" | "paused" | "completed" | "canceled";
export type ProductOrderStatus = "draft" | "pending" | "paid" | "delivered" | "canceled";
export type ProductPaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

export type Product = {
  id: string;
  name: string;
  category: ProductCategoryName | string;
  description?: string;
  priceCents: number;
  costCents?: number;
  currency: string;
  sku?: string;
  inventoryQuantity: number;
  isActive: boolean;
  approvedLanguage?: string;
  restrictedClaims?: string;
  safetyNotes?: string;
};

export type PatientProduct = {
  id: string;
  productName: string;
  reason: string;
  nextStep: string;
  status: PatientProductStatus;
  reviewDate?: string;
};

export type ProductSuggestion = {
  id: string;
  suggestedCategory: string;
  reason: string;
  safetyQuestions: string[];
  followUpTiming?: string;
  nextStep?: string;
  status: ProductSuggestionStatus;
};

export type ProductOrder = {
  id: string;
  patientName?: string;
  status: ProductOrderStatus;
  paymentStatus: ProductPaymentStatus;
  totalCents: number;
  currency: string;
  createdAt: string;
};
