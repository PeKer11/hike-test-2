import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

// Brand tokens from DESIGN.md (see globals.css @theme) — same terracotta/forest
// language as the landing and auth pages.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-terra text-cream hover:bg-terra/90 disabled:bg-terra/40",
  secondary:
    "bg-forest/10 text-forest hover:bg-forest/15 disabled:text-forest/40",
  ghost:
    "bg-transparent text-charcoal/70 hover:bg-charcoal/5 disabled:text-charcoal/30",
  danger: "bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition-colors ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
