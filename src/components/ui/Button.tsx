import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

// Brand tokens from DESIGN.md (see globals.css @theme) — same terracotta/forest
// language as the landing and auth pages.
const variantClasses: Record<ButtonVariant, string> = {
  // Round 13: terracotta with a hard dark lip (the Home "Plan my walk" language); secondary is a forest-edged cream pill.
  primary:
    "bg-terra text-on-accent shadow-[0_3px_0_var(--tk-lip)] hover:bg-terra/90 active:translate-y-[2px] active:shadow-[0_1px_0_var(--tk-lip)] disabled:bg-terra/40 disabled:shadow-none",
  secondary:
    "border-[1.5px] border-forest bg-cream text-forest hover:bg-tk-bar disabled:border-forest/30 disabled:text-forest/40",
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
      className={`inline-flex h-12 items-center justify-center rounded-full px-5 font-app-sans text-[15px] font-semibold transition-colors ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
