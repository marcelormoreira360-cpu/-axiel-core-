"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" className="w-full justify-start" onClick={signOut}>
      Sign out
    </Button>
  );
}
