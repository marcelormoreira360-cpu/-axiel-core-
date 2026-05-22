import { redirect } from "next/navigation";

// Redirect to the unified billing page — avoids duplication
export default function BillingSettingsPage() {
  redirect("/billing");
}
