"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRedirect({ delayMs }: { delayMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push("/dashboard"), delayMs);
    return () => clearTimeout(t);
  }, [router, delayMs]);
  return null;
}
