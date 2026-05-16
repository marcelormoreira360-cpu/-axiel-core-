import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonStyles, type ButtonVariant } from "@/modules/ui/button-styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

type SimpleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function ButtonPrimary({ children, className, ...props }: SimpleButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center bg-axiel-primary text-white px-lg py-md rounded-xl shadow-sm hover:opacity-90 transition disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonSecondary({ children, className, ...props }: SimpleButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center border border-gray-200 text-axiel-text-primary px-lg py-md rounded-xl hover:bg-gray-50 transition disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
