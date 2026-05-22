import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── CPF Utilities ────────────────────────────────────────────────────────────

/** Formats a raw digit string as 000.000.000-00 */
export function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Validates a CPF string (with or without punctuation).
 * Returns true if the CPF passes the two-digit check algorithm.
 */
export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // reject all-same-digit sequences

  const calc = (factor: number) =>
    digits
      .slice(0, factor - 1)
      .split("")
      .reduce((sum, d, i) => sum + Number(d) * (factor - i), 0);

  const mod = (n: number) => {
    const r = (n * 10) % 11;
    return r === 10 || r === 11 ? 0 : r;
  };

  return mod(calc(10)) === Number(digits[9]) && mod(calc(11)) === Number(digits[10]);
}
