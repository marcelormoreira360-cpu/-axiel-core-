export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost";

const baseButton =
  "inline-flex items-center justify-center gap-sm rounded-xl text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-axiel-secondary/20 disabled:cursor-not-allowed disabled:opacity-50";

const sizes = {
  sm: "min-h-10 px-md py-sm",
  md: "min-h-12 px-lg py-md",
  lg: "min-h-14 px-xl py-md text-base"
} as const;

const variants: Record<ButtonVariant, string> = {
  primary: "bg-axiel-primary text-white shadow-sm hover:opacity-90",
  secondary: "border border-gray-200 text-axiel-text-primary hover:bg-gray-50",
  tertiary: "bg-transparent text-axiel-text-secondary hover:bg-axiel-background hover:text-axiel-text-primary",
  ghost: "bg-transparent text-axiel-text-secondary hover:bg-black/5 hover:text-axiel-text-primary"
};

export function buttonStyles({
  variant = "primary",
  size = "md"
}: {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
} = {}) {
  return [baseButton, sizes[size], variants[variant]].join(" ");
}
