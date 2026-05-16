import { Leaf } from "lucide-react";
import type { ReactNode } from "react";

export function CalmMessage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-start gap-[10px] bg-[#F0FAF6] border border-[#9FE1CB] rounded-[10px] px-[14px] py-3 ${className}`.trim()}
    >
      <Leaf className="h-4 w-4 text-[#0F6E56] mt-[1px] shrink-0" aria-hidden="true" />
      <p className="text-[12px] leading-relaxed text-[#085041]">{children}</p>
    </div>
  );
}
