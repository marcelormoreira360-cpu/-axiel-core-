"use client";

import { useState, useEffect } from "react";

export function InboxBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/inbox/count");
        if (!res.ok) return;
        const data = await res.json();
        setCount(data.count ?? 0);
      } catch {
        /* silent */
      }
    }

    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-auto flex items-center justify-center h-[16px] min-w-[16px] rounded-full bg-[#0F6E56] text-white text-[9px] font-bold px-1 leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}
