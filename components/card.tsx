import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { AXIEL_CARD_CLASS } from "@/modules/ui/card-styles";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(AXIEL_CARD_CLASS, className)} {...props} />;
}
