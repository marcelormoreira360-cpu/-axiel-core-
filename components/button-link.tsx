import Link, { type LinkProps } from "next/link";
import { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonStyles, type ButtonVariant } from "@/modules/ui/button-styles";

type ButtonLinkProps = LinkProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg";
  };

export function ButtonLink({ children, className, variant = "primary", size = "md", ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonStyles({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}
