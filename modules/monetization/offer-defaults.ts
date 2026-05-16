export const MONETIZATION_NOTE = "Simple billing structure only. No payment processing is implemented yet.";

export const DEFAULT_OFFERS = [
  { name: "4 Session Package", offer_type: "session_package", number_of_sessions: 4, price: "0" },
  { name: "8 Session Package", offer_type: "session_package", number_of_sessions: 8, price: "0" },
  { name: "Monthly Membership", offer_type: "membership", number_of_sessions: 1, price: "0" },
] as const;
