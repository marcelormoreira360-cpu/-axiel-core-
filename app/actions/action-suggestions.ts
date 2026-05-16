"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateActionSuggestionStatus } from "@/services/action-suggestion-service";
import type { ActionSuggestionStatus } from "@/lib/types";

export async function setActionSuggestionStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ActionSuggestionStatus;

  if (!id || !["pending", "accepted", "ignored", "completed"].includes(status)) {
    throw new Error("Invalid action update.");
  }

  await updateActionSuggestionStatus(id, status);
  revalidatePath("/dashboard");
  revalidatePath("/actions");
  revalidatePath("/patients");
  revalidatePath("/leads");
}

export async function startActionSuggestion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const url = String(formData.get("url") ?? "/dashboard");

  if (!id) {
    throw new Error("Invalid action.");
  }

  await updateActionSuggestionStatus(id, "accepted");
  revalidatePath("/dashboard");
  revalidatePath("/actions");
  redirect(url.startsWith("/") ? url : "/dashboard");
}
